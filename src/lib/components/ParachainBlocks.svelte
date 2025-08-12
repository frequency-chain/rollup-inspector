<script lang="ts">
	import { type BlockHeader, type PolkadotClient } from 'polkadot-api';
	import type { SystemEvent } from '@polkadot-api/observable-client';
	import BlockDetails from './BlockDetails.svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import type { BlockInfo } from 'polkadot-api';
	import { onMount } from 'svelte';
	import { getExtrinsicDecoder, type DecodedExtrinsic } from '@polkadot-api/tx-utils';
	import { extractTimestampFromExtrinsics } from '$lib/utils/timestampExtractor';
	import {
		getRelayBlockByStateRoot,
		getParachainUpdatesStream,
		getRelayBlockMappingStream
	} from '$lib/services/relayBlockManager';
	import type { ParachainBlockUpdate } from '$lib/services/relayChainParser';
	import { filter, map } from 'rxjs';

	let {
		parachainClient
	}: {
		parachainClient: PolkadotClient;
	} = $props();

	export type BlockDisplay = {
		number: number;
		events: SystemEvent[];
		author: string | null;
		absoluteSlot: number;
		collatorSlot: number;
		hash: string;
		header: BlockHeader;
		timestamp?: number;
		relayIncludedAtNumber?: number;
		relayIncludedAtHash?: string;
		relayIncludedAtTimestamp?: number;
		relayBackedAtNumber?: number;
		relayBackedAtHash?: string;
		relayBackedAtTimestamp?: number;
		relayParentHash?: string;
		relayParentNumber?: number;
		relayParentTimestamp?: number;
		relayParentStateRoot?: string;
	};

	let blocksByNumber = new SvelteMap<number, BlockDisplay[]>();
	let destroyed = $state<boolean>(false);
	let parachainCollators = $derived(
		parachainClient
			.getUnsafeApi()
			.apis.AuraApi.authorities()
			.then((x) => x.map((y: { asHex: () => string }) => y.asHex()))
	);

	// Get parachain ID from chain state
	let parachainId = $state<number | null>(null);

	// Fetch parachain ID from chain state once connected
	async function fetchParachainId() {
		try {
			// Try to get parachain ID from ParachainInfo pallet
			const id = await parachainClient.getUnsafeApi().query.ParachainInfo.ParachainId.getValue();
			parachainId = Number(id);
			console.info('Parachain ID:', parachainId);
		} catch (error) {
			console.warn('Could not fetch parachain ID from chain state:', error);
			// You could set a default or ask user to input manually
			parachainId = null;
		}
	}

	// Extract relay parent state root from extrinsics (set_validation_data inherent)
	function getRelayStateRootFromExtrinsics(extrinsics: DecodedExtrinsic[]): string | undefined {
		try {
			const setValidationData = extrinsics.find(
				(ext) =>
					(ext.call?.type as string) === 'ParachainSystem' &&
					ext.call?.value?.type === 'set_validation_data'
			);
			const validationData = setValidationData!.call.value.value?.data?.validation_data;
			return validationData.relay_parent_storage_root.asHex();
		} catch (error) {
			console.warn('Could not extract relay state root from extrinsics:', error);
			return undefined;
		}
	}

	async function addBlock(block: BlockInfo) {
		try {
			// Get block header
			const [header, blockBody, events, extrinsicDecoder] = await Promise.all([
				parachainClient.getBlockHeader(block.hash),
				parachainClient.getBlockBody(block.hash),
				parachainClient
					.getUnsafeApi()
					.query.System.Events.getValue({ at: block.hash }) as unknown as SystemEvent[],
				parachainClient
					.getUnsafeApi()
					.apis.Metadata.metadata()
					.then((x) => getExtrinsicDecoder(x.asBytes()))
			]);

			const extrinsics = blockBody.map(extrinsicDecoder);

			// Extract timestamp
			const timestamp = extractTimestampFromExtrinsics(extrinsics) || undefined;
			// Extract relay parent state root from extrinsics (validation data inherent)
			const relayStateRoot = getRelayStateRootFromExtrinsics(extrinsics);

			// Extract author from the header digest
			const slotHex = (header.digests![0]!.value! as { payload: string }).payload.replace('0x', '');
			const absoluteSlot = parseInt('0x' + slotHex.match(/../g)!.reverse().join(''));
			const collators = await parachainCollators;
			const collatorSlot = absoluteSlot % collators.length;
			const authorHex = collators[collatorSlot];
			const author = authorHex;

			// Get full relay block info using state root in case it already exists
			const relayParentBlock = relayStateRoot
				? getRelayBlockByStateRoot(relayStateRoot)
				: undefined;

			const blockDisplay: BlockDisplay = {
				number: block.number,
				events,
				author,
				absoluteSlot,
				collatorSlot,
				hash: block.hash,
				header,
				timestamp,
				relayParentHash: relayParentBlock?.hash,
				relayParentNumber: relayParentBlock?.number,
				relayParentTimestamp: relayParentBlock?.timestamp,
				relayParentStateRoot: relayStateRoot
			};

			// Only update if component is still mounted
			if (!destroyed) {
				// Get existing blocks for this number or create new array
				const existingBlocks = blocksByNumber.get(block.number) || [];

				// Check if this block already exists (by hash)
				const existingIndex = existingBlocks.findIndex((b) => b.hash === block.hash);

				if (existingIndex >= 0) {
					// Update existing block (preserve relay chain info if already set)
					const existing = existingBlocks[existingIndex];
					existingBlocks[existingIndex] = {
						...blockDisplay,
						relayIncludedAtNumber:
							existing.relayIncludedAtNumber ?? blockDisplay.relayIncludedAtNumber,
						relayIncludedAtHash: existing.relayIncludedAtHash ?? blockDisplay.relayIncludedAtHash,
						relayBackedAtNumber: existing.relayBackedAtNumber ?? blockDisplay.relayBackedAtNumber,
						relayBackedAtHash: existing.relayBackedAtHash ?? blockDisplay.relayBackedAtHash
					};
				} else {
					// Add new block (supports forks - multiple blocks per number)
					existingBlocks.push(blockDisplay);
				}

				// Update the map
				blocksByNumber.set(block.number, [...existingBlocks]);

				// Cleanup old blocks (keep last 500 block numbers)
				if (blocksByNumber.size > 500) {
					const sortedBlockNumbers = Array.from(blocksByNumber.keys()).sort((a, b) => b - a);
					const numbersToRemove = sortedBlockNumbers.slice(500);
					numbersToRemove.forEach((num) => blocksByNumber.delete(num));
				}
			}
		} catch (error) {
			console.error('Error processing block:', error);
		}
	}

	function applyRelayInfoUpdate(update: ParachainBlockUpdate) {
		// Find and update matching parachain block
		const updateBlocks = blocksByNumber
			.values()
			.find((blocks) => blocks.some((block) => block.hash === update.blockHash));

		if (updateBlocks) {
			const updatedBlocks = updateBlocks.map((block) => {
				if (block.hash === update.blockHash) {
					return {
						...block,
						...update
					};
				}
				return block;
			});

			blocksByNumber.set(updatedBlocks[0].number, updatedBlocks);
		}
	}

	function applyRelayStateRoot(mapping: {
		stateRoot: string;
		hash: string;
		number: number;
		timestamp?: number;
	}) {
		// Find and update matching parachain block
		blocksByNumber
			.values()
			.filter((blocks) =>
				blocks.some(
					(block) => !block.relayParentHash && block.relayParentStateRoot === mapping.stateRoot
				)
			)
			.forEach((blocks) => {
				const updatedBlocks = blocks.map((block) => {
					if (block.relayParentStateRoot === mapping.stateRoot && !block.relayParentHash) {
						return {
							...block,
							relayParentNumber: mapping.number,
							relayParentHash: mapping.hash,
							relayParentTimestamp: mapping.timestamp
						};
					}
					return block;
				});

				blocksByNumber.set(updatedBlocks[0].number, updatedBlocks);
			});
	}

	onMount(() => {
		if (!parachainClient) {
			console.error('NO CLIENT FOUND TO SUBSCRIBE TO BLOCKS!');
			return;
		}

		// Fetch parachain ID once on mount
		fetchParachainId();

		const parachainSub = parachainClient.blocks$.subscribe(addBlock);

		// Subscribe to parachain updates, filtering for our parachain ID
		const updatesSub = getParachainUpdatesStream()
			.pipe(
				filter((x) => x.parachainId === parachainId),
				map((x) => x.update)
			)
			.subscribe(applyRelayInfoUpdate);

		// Subscribe to relay block mappings to update relay parent information
		const mappingSub = getRelayBlockMappingStream().subscribe(applyRelayStateRoot);

		return () => {
			destroyed = true;
			parachainSub?.unsubscribe();
			updatesSub?.unsubscribe();
			mappingSub?.unsubscribe();
		};
	});

	// Derived value for sorted block numbers
	let sortedBlockNumbers = $derived(Array.from(blocksByNumber.keys()).sort((a, b) => b - a));
</script>

{#if !parachainClient}
	<div class="text-gray-500">Not connected.</div>
{:else if sortedBlockNumbers.length === 0}
	<div class="text-gray-500">Waiting for blocks...</div>
{:else}
	{#each sortedBlockNumbers as blockNumber (blockNumber)}
		<BlockDetails {blockNumber} blocks={blocksByNumber.get(blockNumber) || []} />
	{/each}
{/if}

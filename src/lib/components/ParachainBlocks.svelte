<script lang="ts">
	import { type BlockHeader, type PolkadotClient } from 'polkadot-api';
	import type { SystemEvent } from '@polkadot-api/observable-client';
	import BlockDetails from './BlockDetails.svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import {
		parseRelayChainEvents,
		createParachainBlockUpdates,
		type ParachainBlockUpdate
	} from '$lib/services/relayChainParser';
	import type { BlockInfo } from 'polkadot-api';
	import { onMount } from 'svelte';
	import { getExtrinsicDecoder, type DecodedExtrinsic } from '@polkadot-api/tx-utils';

	let {
		parachainClient,
		relayClient
	}: {
		parachainClient: PolkadotClient;
		relayClient: PolkadotClient;
	} = $props();

	type BlockDisplay = {
		number: number;
		events: SystemEvent[];
		author: string | null;
		absoluteSlot?: number;
		collatorSlot?: number;
		hash: string;
		header: BlockHeader;
		relayIncludedAt?: number;
		relayBackedAt?: number;
		relayParentHash?: string;
		relayParentNumber?: number;
	};

	let blocksByNumber = new SvelteMap<number, BlockDisplay[]>();
	let relayNumbersByHash = new SvelteMap<string, number>(); // hash -> block number
	let relayHashesByNumber = new SvelteMap<number, string>(); // block number -> hash
	let relayHashesByStateRoot = new SvelteMap<string, string>(); // hash -> State root
	let destroyed = $state<boolean>(false);
	// let relayChainMetadata = $derived(relayClient.getUnsafeApi().apis.Metadata.metadata());
	let parachainMetadata = $derived(parachainClient.getUnsafeApi().apis.Metadata.metadata());
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
			console.log('Parachain ID:', parachainId);
		} catch (error) {
			console.warn('Could not fetch parachain ID from chain state:', error);
			// You could set a default or ask user to input manually
			parachainId = null;
		}
	}

	// Extract relay parent info from extrinsics (set_validation_data inherent)
	function extractRelayParentFromExtrinsics(extrinsics: DecodedExtrinsic[]): {
		relayParentHash?: string;
		relayParentNumber?: number;
	} {
		try {
			const setValidationData = extrinsics.find(
				(ext) =>
					(ext.call?.type as string) === 'ParachainSystem' &&
					ext.call?.value?.type === 'set_validation_data'
			);
			const validationData = setValidationData!.call.value.value?.data?.validation_data;
			return {
				relayParentNumber: Number(validationData.relay_parent_number),
				relayParentHash: relayHashesByStateRoot.get(
					validationData.relay_parent_storage_root.asHex()
				)
			};
		} catch (error) {
			console.debug('Could not extract relay parent from extrinsics:', error);
			return {};
		}
	}

	async function addBlock(block: BlockInfo) {
		try {
			// Get block header and events (we'll need to get extrinsics separately)
			const [header, events] = await Promise.all([
				parachainClient.getBlockHeader(block.hash),
				parachainClient
					.getUnsafeApi()
					.query.System.Events.getValue({ at: block.hash }) as unknown as SystemEvent[]
			]);

			// Get array of hex-encoded extrinsics and decode them
			let extrinsics: DecodedExtrinsic[] = [];
			try {
				const blockBodyHex = await parachainClient.getBlockBody(block.hash);

				if (blockBodyHex && Array.isArray(blockBodyHex)) {
					// Get metadata to create extrinsic decoder
					const extrinsicDecoder = getExtrinsicDecoder((await parachainMetadata).asBytes());

					extrinsics = blockBodyHex
						.map((extHex: string, index: number) => {
							try {
								return extrinsicDecoder(extHex);
							} catch (decodeErr) {
								console.debug(`Failed to decode extrinsic ${index}:`, decodeErr);
								return null;
							}
						})
						.filter((x) => x !== null);
				}
			} catch (err) {
				console.debug('Could not get block body:', err);
			}

			// Extract author from the header digest
			const slotHex = (header.digests![0]!.value! as { payload: string }).payload.replace('0x', '');
			const absoluteSlot = parseInt('0x' + slotHex.match(/../g)!.reverse().join(''));
			const collators = await parachainCollators;
			const collatorSlot = absoluteSlot % collators.length;
			const authorHex = collators[collatorSlot];
			const author = authorHex;

			// Extract relay parent info from extrinsics (validation data inherent)
			const { relayParentHash, relayParentNumber } = extractRelayParentFromExtrinsics(extrinsics);

			const blockDisplay: BlockDisplay = {
				number: block.number,
				events,
				author,
				absoluteSlot,
				collatorSlot,
				hash: block.hash,
				header,
				relayIncludedAt: undefined, // Will be filled by relay chain events
				relayBackedAt: undefined, // Will be filled by relay chain events
				relayParentHash,
				relayParentNumber
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
						relayIncludedAt: existing.relayIncludedAt ?? blockDisplay.relayIncludedAt,
						relayBackedAt: existing.relayBackedAt ?? blockDisplay.relayBackedAt
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

	async function addRelayBlock(block: BlockInfo) {
		try {
			// Get the relay block header to extract state root
			const header = await relayClient.getBlockHeader(block.hash);

			// Store relay block info
			relayNumbersByHash.set(block.hash, block.number);
			relayHashesByNumber.set(block.number, block.hash);

			// Store mapping from state root to block hash
			if (header.stateRoot) {
				relayHashesByStateRoot.set(header.stateRoot, block.hash);
			}

			// Cleanup old relay blocks (keep last 1000)
			if (relayNumbersByHash.size > 1000) {
				const entries = Array.from(relayNumbersByHash.entries());
				const sortedEntries = entries.sort((a, b) => b[1] - a[1]); // Sort by block number desc
				const toKeep = sortedEntries.slice(0, 1000);

				// Clear all maps
				relayNumbersByHash.clear();
				relayHashesByNumber.clear();
				relayHashesByStateRoot.clear();

				// Rebuild maps with kept entries
				for (const [hash, blockNum] of toKeep) {
					relayNumbersByHash.set(hash, blockNum);
					relayHashesByNumber.set(blockNum, hash);

					// Re-fetch header to get state root for kept blocks
					try {
						const keptHeader = await relayClient.getBlockHeader(hash);
						if (keptHeader.stateRoot) {
							relayHashesByStateRoot.set(keptHeader.stateRoot, hash);
						}
					} catch (err) {
						console.debug('Could not get header for kept relay block:', hash, err);
					}
				}
			}
		} catch (error) {
			console.warn('Error processing relay block:', error);
		}

		// Try to match parachain blocks with relay blocks
		// This would require additional logic to determine which parachain blocks
		// were included/backed in which relay blocks
		await updateParachainBlocksWithRelayInfo(block);
	}

	async function updateParachainBlocksWithRelayInfo(relayBlock: BlockInfo) {
		try {
			// Parse relay chain events to find parachain inclusions/backings
			const inclusionInfos = await parseRelayChainEvents(relayClient, relayBlock);

			// Use the parachain ID from chain state
			if (!parachainId) {
				console.warn('Parachain ID not available from chain state');
				return;
			}

			// Create block updates for this parachain
			const updates = createParachainBlockUpdates(inclusionInfos, parachainId);

			// Apply updates to existing parachain blocks
			applyRelayInfoUpdates(updates);
		} catch (error) {
			console.warn('Failed to update parachain blocks with relay info:', error);
		}
	}

	function applyRelayInfoUpdates(updates: Map<string, ParachainBlockUpdate>) {
		for (const [blockHash, update] of updates) {
			// Find and update matching parachain blocks
			blocksByNumber.forEach((blocks, blockNumber) => {
				const hasUpdates = blocks.some(
					(block) => block.hash === blockHash || block.header?.parentHash === blockHash
				);

				if (hasUpdates) {
					const updatedBlocks = blocks.map((block) => {
						if (block.hash === blockHash || block.header?.parentHash === blockHash) {
							return {
								...block,
								relayIncludedAt: update.relayIncludedAt ?? block.relayIncludedAt,
								relayBackedAt: update.relayBackedAt ?? block.relayBackedAt
							};
						}
						return block;
					});

					blocksByNumber.set(blockNumber, updatedBlocks);
				}
			});
		}
	}

	onMount(() => {
		if (!parachainClient || !relayClient) {
			console.error('NO CLIENT FOUND TO SUBSCRIBE TO BLOCKS!');
			return;
		}

		// Fetch parachain ID once on mount
		fetchParachainId();

		const parachainSub = parachainClient.blocks$.subscribe(addBlock);
		const relaySub = relayClient.blocks$.subscribe(addRelayBlock);

		return () => {
			destroyed = true;
			parachainSub?.unsubscribe();
			relaySub?.unsubscribe();
		};
	});

	// Derived value for sorted block numbers
	let sortedBlockNumbers = $derived(Array.from(blocksByNumber.keys()).sort((a, b) => b - a));
</script>

{#if !parachainClient}
	<div class="text-gray-500">Not connected.</div>
{:else}
	{#each sortedBlockNumbers as blockNumber (blockNumber)}
		<BlockDetails {blockNumber} blocks={blocksByNumber.get(blockNumber) || []} />
	{/each}
{/if}

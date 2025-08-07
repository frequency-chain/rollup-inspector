<script lang="ts">
	import type { BlockInfo, BlockHeader, PolkadotClient } from 'polkadot-api';
	import type { SystemEvent } from '@polkadot-api/observable-client';
	import BlockDetails from './BlockDetails.svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import {
		parseRelayChainEvents,
		createParachainBlockUpdates,
		type ParachainBlockUpdate
	} from '$lib/services/relayChainParser';

	let {
		parachainClient,
		relayClient,
		parachainSpec
	}: {
		parachainClient: PolkadotClient;
		relayClient: PolkadotClient;
		parachainSpec: string;
	} = $props();

	type BlockDisplay = {
		number: number;
		events: SystemEvent[];
		author: string | null;
		hash: string;
		header: BlockHeader;
		relayIncludedAt?: number;
		relayBackedAt?: number;
	};

	let blocksByNumber = new SvelteMap<number, BlockDisplay[]>();
	let relayBlocks = new SvelteMap<string, number>(); // hash -> block number
	let destroyed = $state<boolean>(false);

	// Extract parachain ID from spec once at load time
	let parachainId = $derived(() => {
		try {
			const spec = JSON.parse(parachainSpec);
			return spec.para_id || spec.paraId || spec.id;
		} catch (error) {
			console.warn('Could not parse parachain ID from spec:', error);
			return null;
		}
	});

	async function addBlock(block: BlockInfo) {
		try {
			const [header, events] = await Promise.all([
				parachainClient.getBlockHeader(block.hash),
				parachainClient
					.getUnsafeApi()
					.query.System.Events.getValue({ at: block.hash }) as unknown as SystemEvent[]
			]);

			const blockDisplay: BlockDisplay = {
				number: block.number,
				events,
				author: null, // TODO: Extract author if needed
				hash: block.hash,
				header,
				relayIncludedAt: undefined, // Will be filled by relay chain events
				relayBackedAt: undefined // Will be filled by relay chain events
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
		// Store relay block info
		relayBlocks.set(block.hash, block.number);

		// Cleanup old relay blocks (keep last 1000)
		if (relayBlocks.size > 1000) {
			const entries = Array.from(relayBlocks.entries());
			const sortedEntries = entries.sort((a, b) => b[1] - a[1]); // Sort by block number desc
			const toKeep = sortedEntries.slice(0, 1000);
			relayBlocks.clear();
			toKeep.forEach(([hash, blockNum]) => relayBlocks.set(hash, blockNum));
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

			// Use the parachain ID from the spec
			if (!parachainId()) {
				console.warn('Parachain ID not available from spec');
				return;
			}

			// Create block updates for this parachain
			const updates = createParachainBlockUpdates(inclusionInfos, parachainId());

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

	$effect(() => {
		if (!parachainClient || !relayClient) {
			console.error('NO CLIENT FOUND TO SUBSCRIBE TO BLOCKS!');
			return;
		}

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

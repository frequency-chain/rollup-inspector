<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import type { BlockDisplay } from './ParachainBlocks.svelte';
	import ExpectedForkDetails from './ExpectedForkDetails.svelte';
	import BlockRelayInfo from './BlockRelayInfo.svelte';
	import BlockTimeline from './BlockTimeline.svelte';
	import BlockHash from './BlockHash.svelte';
	import { timestampToISO } from '$lib/utils/timestampExtractor';

	let {
		blockNumber,
		blocks,
		isFinalized = false
	}: {
		blockNumber: number;
		blocks: BlockDisplay[];
		isFinalized?: boolean;
	} = $props();

	let slotGroups = $derived.by(() => {
		const groups = new SvelteMap<number, BlockDisplay[]>();
		for (const block of blocks) {
			if (block.absoluteSlot !== undefined) {
				const existing = groups.get(block.absoluteSlot) || [];
				existing.push(block);
				groups.set(block.absoluteSlot, existing);
			}
		}
		return groups;
	});

	let ungrouped = $derived(blocks.filter((block) => block.absoluteSlot === undefined));

	let expectedForks = $derived.by(() => {
		const forks: BlockDisplay[][] = [];
		for (const group of slotGroups.values()) {
			if (group.length > 1) {
				const relayParentHashes = new Set(group.map((b) => b.relayParentHash).filter((h) => h));
				if (relayParentHashes.size > 1) {
					forks.push(group);
				}
			}
		}
		return forks;
	});

	let unexpectedForks = $derived.by(() => {
		const unexpected: BlockDisplay[] = [...ungrouped];
		for (const group of slotGroups.values()) {
			if (group.length === 1) {
				unexpected.push(...group);
			} else if (group.length > 1) {
				const relayParentHashes = new Set(group.map((b) => b.relayParentHash).filter((h) => h));
				if (relayParentHashes.size <= 1) {
					unexpected.push(...group);
				}
			}
		}
		return unexpected;
	});
</script>

<div class="mb-6 border rounded-lg bg-white shadow">
	<div class="p-4 border-b">
		<h3 class="text-lg font-semibold">
			Block #{blockNumber.toLocaleString()}
			{isFinalized ? '(finalized)' : ''}
		</h3>
	</div>

	<!-- Two Column Layout within each block -->
	<div class="flex flex-col lg:flex-row">
		<!-- Timeline Column (Left) -->
		<div class="lg:w-1/3 p-4 bg-gray-50">
			<h4 class="font-medium mb-3">Timeline</h4>
			<BlockTimeline {blocks} />
			
			<!-- Summary info -->
			<div class="mt-3 space-y-2 text-sm">
				<div>Total Blocks: {blocks.length}</div>
				{#if expectedForks.length > 0}
					<div class="text-blue-600">Expected Forks: {expectedForks.length}</div>
				{/if}
				{#if unexpectedForks.length > 1}
					<div class="text-orange-600">Unexpected Forks: {unexpectedForks.length}</div>
				{/if}
			</div>
		</div>

		<!-- Details Column (Right) -->
		<div class="lg:w-2/3 p-4">
			<h4 class="font-medium mb-3">Block Details</h4>
			
			<!-- Expected Forks -->
			{#each expectedForks as forkGroup (forkGroup[0].absoluteSlot)}
				<ExpectedForkDetails {forkGroup} />
			{/each}

			<!-- Unexpected Forks -->
			{#if unexpectedForks.length > 1}
				<div class="mb-2 text-sm text-orange-600">
					⚠️ Unexpected fork - {unexpectedForks.length} competing blocks
				</div>
			{/if}

			{#each unexpectedForks as block (block.hash)}
				<div class="mb-2 ml-4 border-l-2 border-gray-300 pl-4">
					<div class="rounded border bg-white p-2 shadow">
						<div>Author: {block.author ?? 'Unknown'}</div>
						<div class="text-purple-600">
							🎰 Slot: {block.collatorSlot} (Absolute #{block.absoluteSlot})
						</div>

						<div class="text-gray-600">
							<div class="flex items-center gap-2">
								<span>Candidate Hash:</span>
								<BlockHash hash={block.hash} size={16} />
							</div>
							{#if block.timestamp}
								<div class="ml-7 text-xs text-gray-400">{timestampToISO(block.timestamp)}</div>
							{/if}
						</div>
						<div>Event Count: {block.events.length}</div>

						<BlockRelayInfo {block} />
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>

<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import BlockSlot from './BlockSlot.svelte';
	import BlockTimeline from './BlockTimeline.svelte';
	import type { BlockDisplay } from '$lib/utils/blockDisplay';

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
				existing.unshift(block);
				groups.set(block.absoluteSlot, existing);
			}
		}
		return groups;
	});

	let slotGroupsOrdered = $derived.by(() =>
		[...slotGroups.entries()].sort((a, b) => b[0] - a[0]).map((x) => x[1])
	);

	let finalizedTime = $derived(
		// Cannot be more than one
		blocks.find((x) => !!x.relayIncludedAtNumber)?.relayIncludedAtTimestamp
	);

	// Min
	let firstTime = $derived(Math.min(...blocks.map((x) => x.timestamp || Number.MAX_SAFE_INTEGER)));

	let timeToInclusion = $derived(finalizedTime && firstTime && finalizedTime - firstTime);
</script>

<div class="mb-6 overflow-hidden rounded-lg border bg-white shadow">
	<div class="border-b bg-gray-50 px-6 py-4">
		<h3 class="text-lg font-semibold text-gray-800">
			Block #{blockNumber.toLocaleString()}
			{#if isFinalized}<span class="ml-2 text-sm text-blue-600">(finalized)</span>{/if}
		</h3>
	</div>

	<!-- Two Column Layout within each block -->
	<div class="flex flex-col xl:flex-row">
		<!-- Timeline Column (Left) -->
		<div class="border-r border-gray-200 p-6 xl:w-1/2">
			<h4 class="mb-4 font-medium text-gray-700">Timeline</h4>
			<!-- Summary info -->
			<div class="my-4 space-y-2 text-sm">
				<div>
					<span class="text-gray-600">Total Candidates:</span>
					<span class="font-medium">{blocks.length}</span>
				</div>
				<div>
					<span class="text-gray-600">Time to Inclusion:</span>
					<span class="font-medium"
						>{timeToInclusion ? Math.round(timeToInclusion / 1_000) + 's' : '...'}</span
					>
				</div>
				{#if slotGroups.size > 1}
					<div>
						<span class="text-gray-600">Unexpected Forks:</span>
						<span class="font-medium text-orange-600">{slotGroups.size}</span>
					</div>
				{/if}
			</div>
			<div class="overflow-x-auto">
				<BlockTimeline {blocks} />
			</div>
		</div>

		<!-- Details Column (Right) -->
		<div class="p-6 xl:w-1/2">
			<h4 class="mb-4 font-medium text-gray-700">Block Details</h4>

			{#if slotGroups.size > 1}
				<div
					class="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800"
				>
					⚠️ Unexpected forks detected - {slotGroups.size} competing slots
				</div>
			{/if}

			<div class="space-y-4 rounded-lg bg-gray-100 p-4 shadow">
				<!-- Expected Forks -->
				{#each slotGroupsOrdered as slotBlocks (slotBlocks[0].absoluteSlot)}
					<BlockSlot blocks={slotBlocks} />
				{/each}
			</div>
		</div>
	</div>
</div>

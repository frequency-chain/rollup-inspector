<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import type { BlockDisplay } from './ParachainBlocks.svelte';
	import ExpectedForkDetails from './ExpectedForkDetails.svelte';
	import BlockTimeline from './BlockTimeline.svelte';
	import BlockCard from './BlockCard.svelte';

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
			<div class="overflow-x-auto">
				<BlockTimeline {blocks} />
			</div>

			<!-- Summary info -->
			<div class="mt-4 space-y-2 text-sm">
				<div>
					<span class="text-gray-600">Total Candidates:</span>
					<span class="font-medium">{blocks.length}</span>
				</div>
				{#if expectedForks.length > 0}
					<div>
						<span class="text-gray-600">Expected Forks:</span>
						<span class="font-medium text-blue-600">{expectedForks.length}</span>
					</div>
				{/if}
				{#if unexpectedForks.length > 1}
					<div>
						<span class="text-gray-600">Unexpected Forks:</span>
						<span class="font-medium text-orange-600">{unexpectedForks.length}</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- Details Column (Right) -->
		<div class="p-6 xl:w-1/2">
			<h4 class="mb-4 font-medium text-gray-700">Block Details</h4>

			<div class="space-y-4">
				<!-- Expected Forks -->
				{#each expectedForks as forkGroup (forkGroup[0].absoluteSlot)}
					<div class="rounded-lg p-2 shadow">
						<ExpectedForkDetails {forkGroup} />
					</div>
				{/each}

				<!-- Unexpected Forks -->
				{#if unexpectedForks.length > 1}
					<div
						class="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800"
					>
						⚠️ Unexpected fork detected - {unexpectedForks.length} competing blocks
					</div>
				{/if}

				<div class="space-y-3">
					{#each unexpectedForks as block (block.hash)}
						<BlockCard {block} />
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>

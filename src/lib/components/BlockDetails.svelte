<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import type { BlockDisplay } from './ParachainBlocks.svelte';
	import ExpectedForkDetails from './ExpectedForkDetails.svelte';

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

<div class="mb-4">
	<h3 class="mb-2 text-lg font-semibold">
		Block #{blockNumber.toLocaleString()}
		{isFinalized ? '(finalized)' : ''}
	</h3>

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
				<div class="mb-1 text-gray-600">
					Hash: {block.hash}
				</div>
				<div>Event Count: {block.events.length}</div>
				<div>Author: {block.author ?? 'Unknown'}</div>
				{#if block.absoluteSlot !== undefined && block.collatorSlot !== undefined}
					<div class="text-sm text-purple-600">
						🎰 Slot: {block.collatorSlot} (Absolute #{block.absoluteSlot})
					</div>
				{/if}

				<!-- Relay Parent Information -->
				{#if block.relayParentNumber !== undefined}
					<div class="mt-1 text-sm text-green-600">
						<div>🔗 Based on relay block: #{block.relayParentNumber}</div>
						<div class="text-xs text-gray-500">
							Relay Block Hash: {block.relayParentHash}
						</div>
					</div>
				{/if}

				<!-- Relay Chain Inclusion/Backing Information -->
				<!-- Relay Chain Information -->
				{#if block.relayIncludedAtHash || block.relayBackedAtHash}
					<div class="mt-1 text-blue-600">
						{#if block.relayIncludedAtHash}
							<div>
								📦 Included in relay block: #{block.relayIncludedAtNumber}
								{block.relayIncludedAtHash}
							</div>
						{/if}
						{#if block.relayBackedAtHash}
							<div>
								✅ Backed in relay block: #{block.relayBackedAtNumber}
								{block.relayBackedAtHash}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/each}
</div>

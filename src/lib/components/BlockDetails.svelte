<script lang="ts">
	import type { SystemEvent } from '@polkadot-api/observable-client';
	import type { BlockHeader } from 'polkadot-api';
	import { SvelteMap } from 'svelte/reactivity';

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
		<div class="mb-2 text-sm text-blue-600">
			⚡ Expected fork - {forkGroup.length} blocks from same slot
		</div>
		<div class="mb-2 ml-4 border-l-2 border-blue-300 pl-4">
			<div class="rounded border bg-blue-50 p-2 shadow">
				<div>Event Count: {forkGroup[0].events.length}</div>
				<div>Author: {forkGroup[0].author ?? 'Unknown'}</div>
				{#if forkGroup[0].absoluteSlot !== undefined && forkGroup[0].collatorSlot !== undefined}
					<div class="text-sm text-purple-600">
						🎰 Slot: {forkGroup[0].collatorSlot} (Absolute #{forkGroup[0].absoluteSlot})
					</div>
				{/if}

				<!-- Fork candidates section -->
				<div class="mt-2 text-sm text-gray-700">
					<div class="font-medium">Fork Candidates:</div>
					{#each forkGroup as block (block.hash)}
						<div class="mt-1 ml-2 border-t pt-1 text-xs">
							<div class="text-gray-600">Candidate: {block.hash}</div>
							{#if block.relayParentHash}
								<div class="text-green-600">
									Prior Relay: {block.relayParentHash}
								</div>
							{/if}
						</div>
					{/each}
				</div>

				<!-- Relay Chain Inclusion/Backing Information -->
				{#if forkGroup.some((b) => b.relayIncludedAt !== undefined || b.relayBackedAt !== undefined)}
					<div class="mt-1 text-sm text-blue-600">
						{#each forkGroup as block (block.hash)}
							{#if block.relayIncludedAt !== undefined}
								<div>
									📦 {block.hash} included in relay block: #{block.relayIncludedAt}
								</div>
							{/if}
							{#if block.relayBackedAt !== undefined}
								<div>
									✅ {block.hash} backed in relay block: #{block.relayBackedAt}
								</div>
							{/if}
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/each}

	<!-- Unexpected Forks -->
	{#if unexpectedForks.length > 1}
		<div class="mb-2 text-sm text-orange-600">
			⚠️ Unexpected fork - {unexpectedForks.length} competing blocks
		</div>
	{/if}

	{#each unexpectedForks as block (block.hash)}
		<div class="mb-2 ml-4 border-l-2 border-gray-300 pl-4">
			{#if unexpectedForks.length > 1}
				<div class="mb-1 text-xs text-gray-600">
					Hash: {block.hash}
				</div>
			{/if}

			<div class="rounded border bg-white p-2 shadow">
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
				{#if block.relayIncludedAt !== undefined || block.relayBackedAt !== undefined}
					<div class="mt-1 text-sm text-blue-600">
						{#if block.relayIncludedAt !== undefined}
							<div>📦 Included in relay block: #{block.relayIncludedAt}</div>
						{/if}
						{#if block.relayBackedAt !== undefined}
							<div>✅ Backed in relay block: #{block.relayBackedAt}</div>
						{/if}
					</div>
				{/if}

				<div class="mt-1 text-xs break-all text-gray-500">Hash: {block.hash}</div>
			</div>
		</div>
	{/each}
</div>

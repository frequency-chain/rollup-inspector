<script lang="ts">
	import type { BlockDisplay } from './ParachainBlocks.svelte';

	let {
		forkGroup
	}: {
		forkGroup: BlockDisplay[];
	} = $props();
</script>

<div class="mb-2 ml-4 border-l-2 border-blue-300 pl-4">
	<div class="rounded border p-2 shadow">
		<div>Author: {forkGroup[0].author ?? 'Unknown'}</div>
		<div class="text-sm text-purple-600">
			🎰 Slot: {forkGroup[0].collatorSlot} (Absolute #{forkGroup[0].absoluteSlot})
		</div>

		<!-- Fork candidates section -->
		<div class="mt-2 text-sm text-gray-700">
			<div class="font-medium">Expected Fork Candidates:</div>
			{#each forkGroup as block (block.hash)}
				<div class="mt-1 ml-2 border-t pt-1 text-xs">
					<div class="text-gray-600">Candidate Hash: {block.hash}</div>
					<div>Event Count: {block.events.length}</div>

					<!-- Individual relay parent info for each fork -->
					{#if block.relayParentNumber !== undefined}
						<div class="mt-1 text-sm text-green-600">
							<div>🔗 Based on relay block: #{block.relayParentNumber}</div>
							<div class="text-xs text-gray-500">
								Relay Block Hash: {block.relayParentHash}
							</div>
						</div>
					{/if}

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
			{/each}
		</div>
	</div>
</div>

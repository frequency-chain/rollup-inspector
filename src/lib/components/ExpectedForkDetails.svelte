<script lang="ts">
	import BlockRelayInfo from './BlockRelayInfo.svelte';
	import type { BlockDisplay } from './ParachainBlocks.svelte';
	import BlockHash from './BlockHash.svelte';
	import { timestampToISO } from '$lib/utils/timestampExtractor';

	let {
		forkGroup
	}: {
		forkGroup: BlockDisplay[];
	} = $props();
</script>

<div class="mb-2 ml-4 border-l-2 border-blue-300 pl-4">
	<div class="rounded border p-2 shadow">
		<div>Author: {forkGroup[0].author ?? 'Unknown'}</div>
		<div class="text-purple-600">
			🎰 Slot: {forkGroup[0].collatorSlot} (Absolute #{forkGroup[0].absoluteSlot})
		</div>

		<!-- Fork candidates section -->
		<div class="mt-2 text-sm text-gray-700">
			<div class="font-medium">Expected Fork Candidates:</div>
			{#each forkGroup as block (block.hash)}
				<div class="mt-1 ml-2 border-t pt-1 text-sm">
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
			{/each}
		</div>
	</div>
</div>

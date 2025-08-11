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

<div class="space-y-3">
	<div class="text-sm font-medium text-blue-700 mb-3">
		Expected Fork Candidates (Slot {forkGroup[0].collatorSlot} - #{forkGroup[0].absoluteSlot})
	</div>
	
	{#each forkGroup as block (block.hash)}
		<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
			<div class="space-y-2">
				<div>
					<span class="font-medium text-gray-600">Author:</span>
					<span class="font-mono break-all">{block.author ?? 'Unknown'}</span>
				</div>

				<div>
					<span class="font-medium text-gray-600">Slot:</span>
					<span class="font-mono text-purple-600">
						{block.collatorSlot} (#{block.absoluteSlot})
					</span>
				</div>
				
				<div>
					<span class="font-medium text-gray-600">Events:</span>
					<span class="font-mono">{block.events.length}</span>
				</div>

				{#if block.timestamp}
					<div>
						<span class="font-medium text-gray-600">Block Timestamp:</span>
						<span class="text-sm text-gray-500">{timestampToISO(block.timestamp)}</span>
					</div>
				{/if}

				<div>
					<BlockHash hash={block.hash} size={24} />
				</div>

				<div class="border-t border-gray-300 pt-3">
					<BlockRelayInfo {block} />
				</div>
			</div>
		</div>
	{/each}
</div>

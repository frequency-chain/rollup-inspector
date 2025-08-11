<script lang="ts">
	import type { BlockDisplay } from './ParachainBlocks.svelte';
	import BlockRelayInfo from './BlockRelayInfo.svelte';
	import BlockHash from './BlockHash.svelte';
	import { timestampToISO } from '$lib/utils/timestampExtractor';

	let {
		block,
		hideAuthorAndSlot = false
	}: {
		block: BlockDisplay;
		hideAuthorAndSlot?: boolean;
	} = $props();
</script>

<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
	<div class="space-y-2">
		<div>
			<BlockHash hash={block.hash} size={32} />
		</div>

		{#if block.timestamp}
			<div>
				<span class="font-medium text-gray-600">Block Timestamp:</span>
				<span class="font-mono text-gray-500">{timestampToISO(block.timestamp)}</span>
			</div>
		{/if}

		{#if !hideAuthorAndSlot}
			<div>
				<span class="font-medium text-gray-600">Author:</span>
				<span class="font-mono break-all">{block.author}</span>
			</div>
		{/if}

		{#if !hideAuthorAndSlot}
			<div>
				<span class="font-medium text-gray-600">Slot:</span>
				<span class="font-mono text-purple-600">
					{block.collatorSlot} (#{block.absoluteSlot})
				</span>
			</div>
		{/if}

		<div>
			<span class="font-medium text-gray-600">Events:</span>
			<span class="font-mono">{block.events.length}</span>
		</div>

		<div class="border-t border-gray-300 pt-3">
			<BlockRelayInfo {block} />
		</div>
	</div>
</div>

<script lang="ts">
	import BlockRelayInfo from './BlockRelayInfo.svelte';
	import BlockHash from './BlockHash.svelte';
	import { timestampToISO } from '$lib/utils/timestampExtractor';
	import type { BlockDisplay } from '$lib/utils/blockDisplay';

	let {
		block,
		hideAuthorAndSlot = false
	}: {
		block: BlockDisplay;
		hideAuthorAndSlot?: boolean;
	} = $props();
</script>

<div class="mb-6 overflow-x-auto border-t-2 border-l-2 border-gray-500 p-2 pl-4">
	<div class="space-y-1">
		<div>
			<BlockHash hash={block.hash} size={32} />
		</div>

		<div class="flex items-center gap-2">
			<span class="font-medium text-gray-600">Parent:</span>
			<BlockHash hash={block.header.parentHash} size={24} />
		</div>

		{#if block.timestamp}
			<div>
				<span class="font-medium text-gray-600">Block Timestamp:</span>
				<span class="font-mono text-gray-500">{timestampToISO(block.timestamp)}</span>
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

		{#if !hideAuthorAndSlot}
			<div>
				<span class="font-medium text-gray-600">Author:</span>
				<span class="font-mono break-all">{block.author}</span>
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

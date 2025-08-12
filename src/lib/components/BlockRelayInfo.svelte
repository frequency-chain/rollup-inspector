<script lang="ts">
	import type { BlockDisplay } from './ParachainBlocks.svelte';
	import { timestampToISO } from '$lib/utils/timestampExtractor';
	import RelayBlockHash from './RelayBlockHash.svelte';

	let {
		block
	}: {
		block: BlockDisplay;
	} = $props();
</script>

<!-- Relay Parent Information -->
{#if block.relayParentNumber && block.relayParentHash}
	<div class="mt-1 text-red-800">
		<div>🔗 Based on Relay Block: #{block.relayParentNumber}</div>
		<div class="ml-7 text-sm text-gray-500">
			<RelayBlockHash hash={block.relayParentHash} />
			{#if block.relayParentTimestamp}
				<div class="text-xs text-gray-400">{timestampToISO(block.relayParentTimestamp)}</div>
			{/if}
		</div>
	</div>
{/if}

{#if block.relayBackedAtHash}
	<div class="mt-1 text-green-700">
		✅ Backed in relay block: #{block.relayBackedAtNumber}
		<div class="ml-7 text-sm text-gray-500">
			<RelayBlockHash hash={block.relayBackedAtHash} />
			{#if block.relayBackedAtTimestamp}
				<div class="text-xs text-gray-400">{timestampToISO(block.relayBackedAtTimestamp)}</div>
			{/if}
		</div>
	</div>
{/if}

{#if block.relayIncludedAtHash}
	<div class="mt-1 text-blue-700">
		📦 Included in relay block: #{block.relayIncludedAtNumber}
		<div class="ml-7 text-sm text-gray-500">
			<RelayBlockHash hash={block.relayIncludedAtHash} />
			{#if block.relayIncludedAtTimestamp}
				<div class="text-xs text-gray-400">{timestampToISO(block.relayIncludedAtTimestamp)}</div>
			{/if}
		</div>
	</div>
{/if}

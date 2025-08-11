<script lang="ts">
	import type { BlockDisplay } from './ParachainBlocks.svelte';

	let {
		block
	}: {
		block: BlockDisplay;
	} = $props();
</script>

<!-- Relay Parent Information -->
{#if block.relayParentNumber !== undefined}
	<div class="mt-1 text-red-800">
		<div>🔗 Based on Relay Block: #{block.relayParentNumber}</div>
		<div class="ml-7 text-sm text-gray-500">
			Relay Block Hash: {block.relayParentHash}
		</div>
	</div>
{/if}

<!-- Relay Chain Information -->
{#if block.relayIncludedAtHash || block.relayBackedAtHash}
	{#if block.relayIncludedAtHash}
		<div class="mt-1 text-blue-700">
			📦 Included in relay block: #{block.relayIncludedAtNumber}
			<div class="ml-7 text-sm text-gray-500">Hash: {block.relayIncludedAtHash}</div>
		</div>
	{/if}
	{#if block.relayBackedAtHash}
		<div class="mt-1 text-green-700">
			✅ Backed in relay block: #{block.relayBackedAtNumber}
			<div class="ml-7 text-sm text-gray-500">Hash: {block.relayBackedAtHash}</div>
		</div>
	{/if}
{/if}

<script lang="ts">
	import type { BlockDisplay } from './ParachainBlocks.svelte';
	import BlockCard from './BlockCard.svelte';

	let {
		blocks
	}: {
		blocks: BlockDisplay[];
	} = $props();
</script>

<div class="space-y-3">
	<div class="mb-3 font-medium text-blue-700">
		Expected Forks (Count: {blocks.length})
	</div>

	<div>
		<span class="font-medium text-gray-600">Author:</span>
		<span class="font-mono break-all">{blocks[0].author}</span>
	</div>

	<div>
		<span class="font-medium text-gray-600">Slot:</span>
		<span class="font-mono text-purple-600">
			{blocks[0].collatorSlot} (#{blocks[0].absoluteSlot})
		</span>
	</div>

	{#each blocks as block (block.hash)}
		<BlockCard {block} hideAuthorAndSlot={true} />
	{/each}
</div>

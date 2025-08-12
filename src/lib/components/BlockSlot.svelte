<script lang="ts">
	import type { BlockDisplay } from '$lib/utils/blockDisplay';
	import BlockCard from './BlockCard.svelte';

	let {
		blocks
	}: {
		blocks: BlockDisplay[];
	} = $props();
</script>

<div class="space-y-1">
	<div>
		<span class="font-medium text-gray-600">Slot:</span>
		<span class="font-mono text-purple-600">
			{blocks[0].collatorSlot} (#{blocks[0].absoluteSlot})
		</span>
	</div>

	<div>
		<span class="font-medium text-gray-600">Candidate Count:</span>
		<span class="font-mono">
			{blocks.length}
		</span>
	</div>

	<div>
		<span class="font-medium text-gray-600">Author:</span>
		<span class="font-mono break-all">{blocks[0].author}</span>
	</div>

	{#each blocks as block (block.hash)}
		<BlockCard {block} hideAuthorAndSlot={true} />
	{/each}
</div>

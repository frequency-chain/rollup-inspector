<script lang="ts">
	import type { BlockDisplay } from './ParachainBlocks.svelte';
	import BlockCard from './BlockCard.svelte';

	let {
		forkGroup
	}: {
		forkGroup: BlockDisplay[];
	} = $props();
</script>

<div class="space-y-3">
	<div class="mb-3 text-sm font-medium text-blue-700">
		Expected Forks (Count: {forkGroup.length})
	</div>

	<div>
		<span class="font-medium text-gray-600">Author:</span>
		<span class="font-mono break-all">{forkGroup[0].author}</span>
	</div>

	<div>
		<span class="font-medium text-gray-600">Slot:</span>
		<span class="font-mono text-purple-600">
			{forkGroup[0].collatorSlot} (#{forkGroup[0].absoluteSlot})
		</span>
	</div>

	{#each forkGroup as block (block.hash)}
		<BlockCard {block} hideAuthorAndSlot={true} />
	{/each}
</div>

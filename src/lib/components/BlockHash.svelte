<script lang="ts">
	import { blo, type Address } from 'blo';

	let {
		hash,
		size = 16,
		showShortHash = false
	}: {
		hash: string;
		size?: number;
		showShortHash?: boolean;
	} = $props();

	let blockieImage = $derived(blo(hash as Address, size));
	let shortHash = $derived(hash.slice(0, 10) + '...');
</script>

<span class="inline-flex items-center gap-1">
	<img src={blockieImage} alt="" class="rounded" width={size} height={size} />
	{#if showShortHash}
		<span class="font-mono text-xs">{shortHash}</span>
	{:else}
		<span class="font-mono text-sm">{hash}</span>
	{/if}
</span>

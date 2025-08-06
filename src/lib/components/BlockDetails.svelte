<script lang="ts">
	import type { SystemEvent } from '@polkadot-api/observable-client';

	export let number: number;
	export let events: SystemEvent[];
	export let author: string | null = null;
	export let hash: string | null = null;
	export let isFinalized: boolean = false;
</script>

<div class="my-2 rounded border bg-white p-2 shadow">
	<div><strong>Block #{number}</strong> {isFinalized ? '(finalized)' : ''}</div>
	<div>Event Count: {events.length}</div>
	<div>Author: {author ?? 'Unknown'}</div>
	{#if hash}
		<div class="text-xs break-all text-gray-500">Hash: {hash}</div>
	{/if}
</div>

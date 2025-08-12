<script lang="ts">
	import { onMount } from 'svelte';
	import {
		getRelayBlockFinalizationStream,
		getRelayBlockByHash
	} from '$lib/services/relayBlockManager';
	import { filter, take, timeout, catchError } from 'rxjs';
	import { of } from 'rxjs';

	type Props = {
		hash: string;
		number?: number;
	};

	let { hash, number }: Props = $props();

	let isFinalized = $state<boolean | null>(null); // null = unknown, true = finalized, false = timed out

	onMount(() => {
		const relayBlock = getRelayBlockByHash(hash);
		if (relayBlock?.isFinalized) {
			isFinalized = true;
		} else {
			// Subscribe to finalization updates for this specific hash
			const subscription = getRelayBlockFinalizationStream()
				.pipe(
					filter((update) => update.hash === hash),
					take(1), // Only take the first finalization event for this hash
					timeout(120000), // Timeout after 120 seconds (2 minutes)
					catchError(() => {
						// If timeout occurs, mark as not finalized (timed out)
						isFinalized = false;
						return of(null);
					})
				)
				.subscribe((update) => {
					if (update) {
						isFinalized = update.isFinalized;
					}
				});

			return () => {
				subscription?.unsubscribe();
			};
		}
	});

	// Get icon and color based on finalization status
	let statusIcon = $derived(isFinalized === true ? '✅' : isFinalized === false ? '🚫' : '⏳');
	let statusColor = $derived(
		isFinalized === true
			? 'text-green-600'
			: isFinalized === false
				? 'text-gray-500'
				: 'text-yellow-400'
	);
	let statusTitle = $derived(
		isFinalized === true
			? 'Finalized'
			: isFinalized === false
				? 'Not finalized (timeout)'
				: 'Pending finalization'
	);
</script>

<span class="inline-flex items-center gap-1">
	<span class="font-mono text-sm">{hash}</span>
	{#if number}
		<span class="text-xs text-gray-500">#{number}</span>
	{/if}
	<span class={`text-sm ${statusColor}`} title={statusTitle}>
		{statusIcon}
	</span>
</span>

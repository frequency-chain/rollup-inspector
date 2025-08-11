<script lang="ts">
	import type { BlockDisplay } from './ParachainBlocks.svelte';
	import {
		timestampToISO,
		getTimeDifferenceInSeconds,
		formatTimeDifference
	} from '$lib/utils/timestampExtractor';
	import BlockHash from './BlockHash.svelte';

	let {
		blocks
	}: {
		blocks: BlockDisplay[];
	} = $props();

	// Create timeline events from all blocks
	let timelineEvents = $derived.by(() => {
		const events: Array<{
			type: 'block' | 'backed' | 'included';
			timestamp: number;
			hash?: string;
			blockNumber?: number;
		}> = [];

		// Add all parachain block events
		for (const block of blocks) {
			if (block.timestamp) {
				events.push({
					type: 'block',
					timestamp: block.timestamp,
					hash: block.hash,
					blockNumber: block.number
				});
			}

			// Add backing events (use relay chain timestamp for timing, parachain hash for identity)
			if (block.relayBackedAtTimestamp) {
				events.push({
					type: 'backed',
					timestamp: block.relayBackedAtTimestamp,
					hash: block.hash,
					blockNumber: block.relayBackedAtNumber
				});
			}

			// Add inclusion events (use relay chain timestamp for timing, parachain hash for identity)
			if (block.relayIncludedAtTimestamp) {
				events.push({
					type: 'included',
					timestamp: block.relayIncludedAtTimestamp,
					hash: block.hash,
					blockNumber: block.relayIncludedAtNumber
				});
			}
		}

		// Sort by timestamp
		events.sort((a, b) => a.timestamp - b.timestamp);

		return events;
	});

	// Get the earliest timestamp as T-0
	let baseTimestamp = $derived.by(() => {
		if (timelineEvents.length === 0) return null;
		return timelineEvents[0].timestamp;
	});
</script>

{#if timelineEvents.length > 0 && baseTimestamp}
	<div class="mb-4 rounded border bg-gray-50 p-3">
		<div class="mb-2 font-medium text-gray-700">Block Timeline</div>
		<div class="space-y-1 text-sm">
			{#each timelineEvents as event, index (event.hash + event.type)}
				<div class="flex items-start gap-2">
					<div class="w-12 text-right text-gray-500">
						{index === 0
							? 'T+0s'
							: formatTimeDifference(getTimeDifferenceInSeconds(event.timestamp, baseTimestamp))}
					</div>
					<div class="flex-1">
						{#if event.type === 'block'}
							<span class="text-blue-600">📦 Block announced</span>
							<span class="text-gray-500">#{event.blockNumber}</span>
							<BlockHash hash={event.hash || ''} size={14} />
						{:else if event.type === 'backed'}
							<span class="text-green-600">✅ Backed in relay</span>
							<span class="text-gray-500">#{event.blockNumber}</span>
							<BlockHash hash={event.hash || ''} size={14} />
						{:else if event.type === 'included'}
							<span class="text-purple-600">📮 Included in relay</span>
							<span class="text-gray-500">#{event.blockNumber}</span>
							<BlockHash hash={event.hash || ''} size={14} />
						{/if}
						<span class="ml-2 text-gray-400">{timestampToISO(event.timestamp)}</span>
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}

<script lang="ts">
	import type { BlockDisplay } from '$lib/utils/blockDisplay';
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
	<div class="mb-4 rounded-lg bg-gray-100 p-4 shadow">
		<div class="space-y-4">
			{#each timelineEvents as event, index (event.hash + event.type)}
				<div class="flex items-start gap-3 border-l-2 border-gray-500 pl-2">
					<div class="text-md w-14 text-right font-mono text-gray-500">
						{index === 0
							? '0s'
							: formatTimeDifference(getTimeDifferenceInSeconds(event.timestamp, baseTimestamp))}
					</div>
					<div class="flex-1">
						<div class="text-base">
							{#if event.type === 'block'}
								<span class="font-medium text-blue-600">📣 Block announced</span>
								<span class="text-gray-600">#{event.blockNumber}</span>
							{:else if event.type === 'backed'}
								<span class="font-medium text-green-600">✅ Backed in relay</span>
								<span class="text-gray-600">#{event.blockNumber}</span>
							{:else if event.type === 'included'}
								<span class="font-medium text-purple-600">📦 Included in relay</span>
								<span class="text-gray-600">#{event.blockNumber}</span>
							{/if}
						</div>
						<div class="mt-1 ml-2 text-sm text-gray-500">{timestampToISO(event.timestamp)}</div>
						<div class="mt-2 ml-2">
							<BlockHash hash={event.hash || ''} size={32} />
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}

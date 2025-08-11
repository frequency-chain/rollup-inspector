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
	<div class="mb-4 rounded-lg border bg-white shadow-sm">
		<div class="px-6 py-3 border-b bg-gray-50 rounded-t-lg">
			<h3 class="font-semibold text-gray-800">Block Timeline</h3>
		</div>
		<div class="p-6">
		<div class="space-y-2">
			{#each timelineEvents as event, index (event.hash + event.type)}
				<div class="flex items-start gap-3">
					<div class="w-14 text-right text-gray-500 font-mono text-sm">
						{index === 0
							? 'T+0s'
							: formatTimeDifference(getTimeDifferenceInSeconds(event.timestamp, baseTimestamp))}
					</div>
					<div class="flex-1">
						<div class="text-base">
							{#if event.type === 'block'}
								<span class="text-blue-600 font-medium">📦 Block announced</span>
								<span class="text-gray-600">#{event.blockNumber}</span>
							{:else if event.type === 'backed'}
								<span class="text-green-600 font-medium">✅ Backed in relay</span>
								<span class="text-gray-600">#{event.blockNumber}</span>
							{:else if event.type === 'included'}
								<span class="text-purple-600 font-medium">📮 Included in relay</span>
								<span class="text-gray-600">#{event.blockNumber}</span>
							{/if}
						</div>
						<div class="ml-2 mt-2">
							<BlockHash hash={event.hash || ''} size={24} />
						</div>
						<div class="ml-2 text-gray-500 text-sm mt-1">{timestampToISO(event.timestamp)}</div>
					</div>
				</div>
			{/each}
		</div>
		</div>
	</div>
{/if}

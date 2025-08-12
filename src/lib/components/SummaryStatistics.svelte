<script lang="ts">
	import type { BlockDisplay } from '$lib/utils/blockDisplay';
	import { SvelteMap } from 'svelte/reactivity';

	interface Props {
		blocksByNumber: SvelteMap<number, BlockDisplay[]>;
		parachainCollators: Promise<string[]>;
	}

	let { blocksByNumber, parachainCollators }: Props = $props();

	// Get all blocks as a flat array, cache the result to avoid repeated sorting
	let allBlocks = $derived.by(() => {
		const blocks: BlockDisplay[] = [];
		for (const blockArray of blocksByNumber.values()) {
			blocks.push(...blockArray);
		}
		// Sort once here since multiple calculations need sorted data
		return blocks.sort((a, b) => b.number - a.number);
	});

	// Cache included blocks to avoid repeated filtering/mapping
	let includedBlocks = $derived.by(() => {
		return Array.from(blocksByNumber.entries()).map(([_blockNumber, blocks]) => {
			// Prefer blocks that are included, otherwise take the last one
			return blocks.find((b) => b.relayIncludedAtTimestamp) || blocks[blocks.length - 1];
		});
	});

	// Calculate block range and count statistics
	let blockRangeStats = $derived.by(() => {
		const blockNumbers = Array.from(blocksByNumber.keys());
		if (blockNumbers.length === 0) return null;

		return {
			minBlock: blockNumbers[0],
			maxBlock: blockNumbers[blockNumbers.length - 1],
			blockCount: blockNumbers.length
		};
	});

	// Calculate average time to inclusion (parachain block timestamp to relay inclusion timestamp)
	let averageTimeToInclusion = $derived.by(() => {
		if (includedBlocks.length === 0) return null;

		const [totalTime, totalCount] = includedBlocks.reduce(
			([sum, count], block) => {
				if (block.relayIncludedAtTimestamp && block.timestamp)
					return [sum + (block.relayIncludedAtTimestamp - block.timestamp), count + 1];
				return [sum, count];
			},
			[0, 0]
		);

		return totalTime / totalCount / 1000; // Convert to seconds
	});

	// Calculate average time between blocks (using max timestamp per block number)
	let averageTimeBetweenBlocks = $derived.by(() => {
		// Map blocksByNumber to get max timestamp per block number
		const blockTimestamps = Array.from(blocksByNumber.entries())
			.map(([blockNumber, blocks]) => {
				let maxTimestamp = 0;
				for (const block of blocks) {
					if (block.timestamp && block.timestamp > maxTimestamp) {
						maxTimestamp = block.timestamp;
					}
				}
				return { blockNumber, timestamp: maxTimestamp > 0 ? maxTimestamp : null };
			})
			.filter((entry) => entry.timestamp !== null)
			.sort((a, b) => b.blockNumber - a.blockNumber); // Sort by block number descending

		if (blockTimestamps.length < 2) return null;

		let totalTime = 0;
		let intervals = 0;

		for (let i = 0; i < blockTimestamps.length - 1; i++) {
			const current = blockTimestamps[i];
			const next = blockTimestamps[i + 1];

			// Only count consecutive blocks
			if (current.blockNumber === next.blockNumber + 1) {
				totalTime += current.timestamp! - next.timestamp!;
				intervals++;
			}
		}

		return intervals > 0 ? totalTime / intervals / 1000 : null; // Convert to seconds
	});

	// Cache the resolved collators to avoid re-awaiting
	let resolvedCollators = $state<string[]>([]);
	$effect(() => {
		parachainCollators.then((collators) => {
			resolvedCollators = collators;
		});
	});

	// Calculate collator performance metrics (missed slots and efficiency)
	let collatorStats = $derived.by(() => {
		const stats = new SvelteMap<number, { missed: number; possible: number }>();

		if (resolvedCollators.length === 0) return stats;

		// Go from all the blocks to the unique set of absolute slots
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const slotSet = new Set();
		let minimum = Infinity;
		let maximum = -Infinity;

		// Single pass to build set and find min/max
		for (const block of allBlocks) {
			if (block.absoluteSlot !== undefined) {
				slotSet.add(block.absoluteSlot);
				if (block.absoluteSlot < minimum) minimum = block.absoluteSlot;
				if (block.absoluteSlot > maximum) maximum = block.absoluteSlot;
			}
		}

		if (slotSet.size < 2 || minimum === Infinity) return stats;

		const totalCollators = resolvedCollators.length;

		// Check for holes in the absolute slot sequence
		for (let i = minimum; i < maximum; i++) {
			const collatorSlot = i % totalCollators;
			const statData = stats.get(collatorSlot) || { missed: 0, possible: 0 };
			statData.possible++;
			if (!slotSet.has(i)) statData.missed++;
			stats.set(collatorSlot, statData);
		}

		return stats;
	});

	// Calculate transaction throughput (average extrinsics per included block)
	let transactionThroughput = $derived.by(() => {
		// Get one block per block number (the included one, or first if none included)
		if (includedBlocks.length === 0) return null;

		let totalExtrinsics = 0;

		for (const block of includedBlocks) {
			// Count extrinsic events (they have phase.type === 'ApplyExtrinsic')
			const extrinsicCount = block.events.filter(
				(event) =>
					event.phase &&
					typeof event.phase === 'object' &&
					'type' in event.phase &&
					event.phase.type === 'ApplyExtrinsic'
			).length;

			totalExtrinsics += extrinsicCount;
		}

		return totalExtrinsics / includedBlocks.length;
	});

	function formatTime(seconds: number | null): string {
		if (seconds === null) return 'N/A';
		return `${seconds.toFixed(1)}s`;
	}
</script>

<div class="mb-4 rounded-lg border bg-white shadow-sm">
	<div class="rounded-t-lg border-b bg-gray-50 px-6 py-3">
		<h3 class="font-semibold text-gray-800">Summary Statistics Covering Displayed Blocks</h3>
	</div>

	<div class="p-4">
		<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
			<!-- Left Column: Two half-height stats -->
			<div class="space-y-4">
				<!-- Average Time to Inclusion -->
				<div class="rounded-md bg-blue-50 p-2">
					<div class="text-sm font-medium text-blue-900">Average Time to Inclusion</div>
					<div class="text-xl font-bold text-blue-700">
						{formatTime(averageTimeToInclusion)}
					</div>
				</div>

				<!-- Average Time Between Blocks -->
				<div class="rounded-md bg-green-50 p-2">
					<div class="text-sm font-medium text-green-900">Average Time Between Blocks</div>
					<div class="text-xl font-bold text-green-700">
						{formatTime(averageTimeBetweenBlocks)}
					</div>
				</div>
			</div>

			<!-- Middle Column: Two half-height stats -->
			<div class="space-y-4">
				<!-- Block Range & Count -->
				<div class="rounded-md bg-slate-50 p-2">
					<div class="text-sm font-medium text-slate-900">Block Range & Count</div>
					{#if blockRangeStats}
						<div class="text-xl font-bold text-slate-700">
							#{blockRangeStats.minBlock} - #{blockRangeStats.maxBlock}
						</div>
						<div class="text-sm text-slate-600">{blockRangeStats.blockCount} blocks</div>
					{:else}
						<div class="text-xl font-bold text-slate-700">N/A</div>
					{/if}
				</div>

				<!-- Transaction Throughput -->
				<div class="rounded-md bg-orange-50 p-2">
					<div class="text-sm font-medium text-orange-900">Transaction Throughput</div>
					<div class="text-xl font-bold text-orange-700">
						{transactionThroughput !== null ? `${transactionThroughput.toFixed(1)}` : 'N/A'}
					</div>
					<div class="text-sm text-orange-600">avg extrinsics per block</div>
				</div>
			</div>

			<!-- Right Column: Collator Performance -->
			<div class="rounded-md bg-purple-50 p-3">
				<div class="text-sm font-medium text-purple-900">Collator Performance</div>
				<div class="text text-purple-700">
					{#if collatorStats.size === 0}
						<span class="text-purple-500">No data available</span>
					{:else}
						{#each Array.from(collatorStats.entries()).sort((a, b) => a[0] - b[0]) as [slot, data] (slot)}
							<div class="font-mono">
								<span>Slot {slot}:</span>
								<span class="font-medium"
									>{(
										Math.round((1000 * (data.possible - data.missed)) / data.possible) / 10
									).toLocaleString()}%</span
								>
								{#if data.missed}
									<span class="text-red-600">({data.missed} missed)</span>
								{/if}
							</div>
						{/each}
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

<script lang="ts">
	import type { PolkadotClient } from 'polkadot-api';
	import type { BlockInfo } from 'polkadot-api';
	import { onMount } from 'svelte';
	import { extractTimestampFromExtrinsics } from '$lib/utils/timestampExtractor';
	import { getExtrinsicDecoder } from '@polkadot-api/tx-utils';

	let {
		parachainClient,
		relayClient
	}: {
		parachainClient: PolkadotClient;
		relayClient: PolkadotClient;
	} = $props();

	// Track latest blocks
	let parachainLatestBlock = $state<{ number: number; timestamp?: number } | null>(null);
	let parachainFinalizedBlock = $state<{ number: number; timestamp?: number } | null>(null);
	let relayLatestBlock = $state<{ number: number; timestamp?: number } | null>(null);
	let relayFinalizedBlock = $state<{ number: number; timestamp?: number } | null>(null);

	// Current time for reactive updates (updated every second)
	let currentTime = $state(Date.now());

	$effect(() => {
		const interval = setInterval(() => {
			currentTime = Date.now();
		}, 1000);

		// cleanup when component is destroyed
		return () => clearInterval(interval);
	});

	async function updateParachainLatest(block: BlockInfo) {
		try {
			// Get block body to extract timestamp
			const blockBodyHex = await parachainClient.getBlockBody(block.hash);
			let timestamp: number | undefined;

			if (blockBodyHex && Array.isArray(blockBodyHex)) {
				const metadata = await parachainClient.getUnsafeApi().apis.Metadata.metadata();
				const extrinsicDecoder = getExtrinsicDecoder(metadata.asBytes());

				const extrinsics = blockBodyHex
					.map((extHex: string) => {
						try {
							return extrinsicDecoder(extHex);
						} catch {
							return null;
						}
					})
					.filter((x) => x !== null);

				timestamp = extractTimestampFromExtrinsics(extrinsics) || undefined;
			}

			parachainLatestBlock = {
				number: block.number,
				timestamp
			};
		} catch (error) {
			console.warn('Error updating parachain latest:', error);
		}
	}

	async function updateParachainFinalized(block: BlockInfo) {
		try {
			// Get block body to extract timestamp
			const blockBodyHex = await parachainClient.getBlockBody(block.hash);
			let timestamp: number | undefined;

			if (blockBodyHex && Array.isArray(blockBodyHex)) {
				const metadata = await parachainClient.getUnsafeApi().apis.Metadata.metadata();
				const extrinsicDecoder = getExtrinsicDecoder(metadata.asBytes());

				const extrinsics = blockBodyHex
					.map((extHex: string) => {
						try {
							return extrinsicDecoder(extHex);
						} catch {
							return null;
						}
					})
					.filter((x) => x !== null);

				timestamp = extractTimestampFromExtrinsics(extrinsics) || undefined;
			}

			parachainFinalizedBlock = {
				number: block.number,
				timestamp
			};
		} catch (error) {
			console.warn('Error updating parachain finalized:', error);
		}
	}

	async function updateRelayFinalized(block: BlockInfo) {
		try {
			// Extract timestamp directly from relay block body
			const blockBodyHex = await relayClient.getBlockBody(block.hash);
			let timestamp: number | undefined;

			if (blockBodyHex && Array.isArray(blockBodyHex)) {
				const metadata = await relayClient.getUnsafeApi().apis.Metadata.metadata();
				const extrinsicDecoder = getExtrinsicDecoder(metadata.asBytes());

				const extrinsics = blockBodyHex
					.map((extHex: string) => {
						try {
							return extrinsicDecoder(extHex);
						} catch {
							return null;
						}
					})
					.filter((x) => x !== null);

				timestamp = extractTimestampFromExtrinsics(extrinsics) || undefined;
			}

			relayFinalizedBlock = {
				number: block.number,
				timestamp
			};
		} catch (error) {
			console.warn('Error updating relay finalized:', error);
		}
	}

	async function updateRelayLatest(block: BlockInfo) {
		try {
			// Extract timestamp directly from relay block body
			const blockBodyHex = await relayClient.getBlockBody(block.hash);
			let timestamp: number | undefined;

			if (blockBodyHex && Array.isArray(blockBodyHex)) {
				const metadata = await relayClient.getUnsafeApi().apis.Metadata.metadata();
				const extrinsicDecoder = getExtrinsicDecoder(metadata.asBytes());

				const extrinsics = blockBodyHex
					.map((extHex: string) => {
						try {
							return extrinsicDecoder(extHex);
						} catch {
							return null;
						}
					})
					.filter((x) => x !== null);

				timestamp = extractTimestampFromExtrinsics(extrinsics) || undefined;
			}

			relayLatestBlock = {
				number: block.number,
				timestamp
			};
		} catch (error) {
			console.warn('Error updating relay latest:', error);
		}
	}

	onMount(() => {
		if (!parachainClient || !relayClient) return;

		const parachainSub = parachainClient.blocks$.subscribe(updateParachainLatest);
		const parachainFinalizedSub =
			parachainClient.finalizedBlock$.subscribe(updateParachainFinalized);
		const relaySub = relayClient.blocks$.subscribe(updateRelayLatest);
		const relayFinalizedSub = relayClient.finalizedBlock$.subscribe(updateRelayFinalized);

		return () => {
			parachainSub?.unsubscribe();
			parachainFinalizedSub?.unsubscribe();
			relaySub?.unsubscribe();
			relayFinalizedSub?.unsubscribe();
		};
	});

	// Helper function to format time ago (reactive to currentTime)
	function formatTimeAgo(timestamp?: number): string {
		if (!timestamp) return 'N/A';
		const seconds = Math.round((currentTime - timestamp) / 1000);
		if (seconds < 60) return `${seconds}s`;
		if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
		return `${Math.round(seconds / 3600)}h`;
	}
</script>

<!-- Chain Status Widget -->
<div class="mb-6 rounded-lg border bg-white shadow-sm">
	<div class="rounded-t-lg border-b bg-gray-50 px-6 py-3">
		<h2 class="font-semibold text-gray-800">Chain Status</h2>
	</div>

	<div class="p-6">
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<!-- First Row - Best Blocks -->
			<div class="rounded-lg border border-green-200 bg-green-50 p-4">
				<div class="mb-2 flex items-center gap-2">
					<div class="h-2 w-2 rounded-full bg-purple-400"></div>
					<span class="text-sm font-medium text-gray-600">Parachain Best</span>
				</div>
				<div class="mb-1 font-mono text-2xl font-bold text-green-800">
					{parachainLatestBlock?.number?.toLocaleString() ?? '—'}
				</div>
				<div class="text-sm text-green-600">{formatTimeAgo(parachainLatestBlock?.timestamp)}</div>
			</div>

			<div class="rounded-lg border border-green-200 bg-green-50 p-4">
				<div class="mb-2 flex items-center gap-2">
					<div class="h-2 w-2 rounded-full bg-orange-400"></div>
					<span class="text-sm font-medium text-gray-600">Relay Best</span>
				</div>
				<div class="mb-1 font-mono text-2xl font-bold text-green-800">
					{relayLatestBlock?.number?.toLocaleString() ?? '—'}
				</div>
				<div class="text-sm text-green-600">{formatTimeAgo(relayLatestBlock?.timestamp)}</div>
			</div>

			<!-- Second Row - Finalized Blocks -->
			<div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
				<div class="mb-2 flex items-center gap-2">
					<div class="h-2 w-2 rounded-full bg-purple-400"></div>
					<span class="text-sm font-medium text-gray-600">Parachain Finalized</span>
				</div>
				<div class="mb-1 font-mono text-2xl font-bold text-blue-800">
					{parachainFinalizedBlock?.number?.toLocaleString() ?? '—'}
				</div>
				<div class="text-sm text-blue-600">{formatTimeAgo(parachainFinalizedBlock?.timestamp)}</div>
			</div>

			<div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
				<div class="mb-2 flex items-center gap-2">
					<div class="h-2 w-2 rounded-full bg-orange-400"></div>
					<span class="text-sm font-medium text-gray-600">Relay Finalized</span>
				</div>
				<div class="mb-1 font-mono text-2xl font-bold text-blue-800">
					{relayFinalizedBlock?.number?.toLocaleString() ?? '—'}
				</div>
				<div class="text-sm text-blue-600">{formatTimeAgo(relayFinalizedBlock?.timestamp)}</div>
			</div>
		</div>
	</div>
</div>

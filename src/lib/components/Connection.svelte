<script lang="ts">
	import { createClient, type PolkadotClient } from 'polkadot-api';
	import { getSmProvider } from 'polkadot-api/sm-provider';
	import type { Chain, Client } from 'polkadot-api/smoldot';
	import { startFromWorker } from 'polkadot-api/smoldot/from-worker';
	import SmWorker from 'polkadot-api/smoldot/worker?worker';
	import { onDestroy } from 'svelte';

	interface Props {
		parachainSpec?: string;
		relaychainSpec?: string;
		chainName?: string;
		onApiReady?: (parachainClient: PolkadotClient, relaychainClient: PolkadotClient) => void;
	}

	let { parachainSpec = '', relaychainSpec = '', chainName = 'Chain', onApiReady = undefined }: Props = $props();

	type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

	let connectionState = $state<ConnectionState>('disconnected');
	let parachainClient = $state<PolkadotClient | null>(null);
	let relaychainClient = $state<PolkadotClient | null>(null);
	let worker = $state<Worker | null>(null);
	let relaychainChain = $state<Chain | null>(null);
	let parachainChain = $state<Chain | null>(null);
	let smoldot = $state<Client | null>(null);
	let error = $state<string | null>(null);

	async function connect(): Promise<void> {
		if (!parachainSpec || !relaychainSpec) return;

		try {
			connectionState = 'connecting';
			error = null;

			// Create web worker
			worker = new Worker(new URL('polkadot-api/smoldot/worker', import.meta.url));

			// Start smoldot from worker
			smoldot = startFromWorker(new SmWorker());

			// Add relaychain first
			relaychainChain = await smoldot.addChain({ chainSpec: relaychainSpec });

			// Add parachain with relaychain as potential relay
			parachainChain = await smoldot.addChain({ 
				chainSpec: parachainSpec,
				potentialRelayChains: [relaychainChain]
			});

			// Create clients for both chains
			parachainClient = createClient(getSmProvider(parachainChain));
			relaychainClient = createClient(getSmProvider(relaychainChain));

			connectionState = 'connected';
			onApiReady?.(parachainClient, relaychainClient);
		} catch (err) {
			console.error('Connection failed', err);
			error = err instanceof Error ? err.message : 'Connection failed';
			connectionState = 'error';
			cleanup();
		}
	}

	async function disconnect(): Promise<void> {
		cleanup();
		connectionState = 'disconnected';
	}

	function cleanup(): void {
		try {
			parachainChain?.remove();
			relaychainChain?.remove();
			smoldot?.terminate();
			worker?.terminate();
		} catch (err) {
			console.error('Cleanup error:', err);
		} finally {
			parachainClient = null;
			relaychainClient = null;
			parachainChain = null;
			relaychainChain = null;
			smoldot = null;
			worker = null;
			error = null;
		}
	}

	function toggle(): void {
		if (connectionState === 'connected') {
			disconnect();
		} else {
			connect();
		}
	}

	onDestroy(() => cleanup());
</script>

<div class="space-y-3 rounded-lg border p-4">
	<div class="flex items-center justify-between">
		<h3 class="font-medium">{chainName}</h3>
		<div class="flex items-center gap-2">
			<div
				class="h-2 w-2 rounded-full"
				class:bg-green-500={connectionState === 'connected'}
				class:bg-yellow-500={connectionState === 'connecting'}
				class:bg-red-500={connectionState === 'error'}
				class:bg-gray-400={connectionState === 'disconnected'}
			></div>
			<span class="text-sm text-gray-600 capitalize">{connectionState}</span>
		</div>
	</div>

	<div class="space-y-1">
		{#if relaychainSpec}
			<div class="text-xs text-gray-600">Relaychain:</div>
			<div class="rounded bg-gray-50 p-2 font-mono text-xs break-all text-gray-500">
				{relaychainSpec.length > 50 ? `${relaychainSpec.substring(0, 50)}...` : relaychainSpec}
			</div>
		{/if}
		{#if parachainSpec}
			<div class="text-xs text-gray-600">Parachain:</div>
			<div class="rounded bg-gray-50 p-2 font-mono text-xs break-all text-gray-500">
				{parachainSpec.length > 50 ? `${parachainSpec.substring(0, 50)}...` : parachainSpec}
			</div>
		{/if}
	</div>

	<button
		onclick={toggle}
		disabled={connectionState === 'connecting' || (!parachainSpec || !relaychainSpec)}
		class="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
	>
		{connectionState === 'connected'
			? 'Disconnect'
			: connectionState === 'connecting'
				? 'Connecting...'
				: 'Connect'}
	</button>

	{#if error}
		<div class="rounded bg-red-50 p-2 text-sm text-red-600">
			{error}
		</div>
	{/if}
</div>

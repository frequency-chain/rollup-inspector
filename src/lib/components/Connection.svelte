<script lang="ts">
	import { createClient, type PolkadotClient } from 'polkadot-api';
	import { getSmProvider } from 'polkadot-api/sm-provider';
	import type { Chain, Client } from 'polkadot-api/smoldot';
	import { startFromWorker } from 'polkadot-api/smoldot/from-worker';
	import { onDestroy } from 'svelte';

	interface Props {
		chainSpec: string;
		chainName?: string;
		onApiReady?: (api: PolkadotClient) => void;
	}

	let { chainSpec, chainName = 'Chain', onApiReady = undefined }: Props = $props();

	type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

	let connectionState = $state<ConnectionState>('disconnected');
	let client = $state<PolkadotClient | null>(null);
	let worker = $state<Worker | null>(null);
	let chain = $state<Chain | null>(null);
	let smoldot = $state<Client | null>(null);
	let error = $state<string | null>(null);

	async function connect(): Promise<void> {
		if (!chainSpec) return;

		try {
			connectionState = 'connecting';
			error = null;

			// Create web worker
			worker = new Worker(new URL('polkadot-api/smoldot/web-worker', import.meta.url), {
				type: 'module'
			});

			// Start smoldot from worker
			smoldot = startFromWorker(worker);

			// Add chain with the provided chainSpec
			chain = await smoldot.addChain({ chainSpec });

			// Create client with smoldot provider
			client = createClient(getSmProvider(chain));

			connectionState = 'connected';
			onApiReady?.(client);
		} catch (err) {
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
			chain?.remove();
			smoldot?.terminate();
			worker?.terminate();
		} catch (err) {
			console.error('Cleanup error:', err);
		} finally {
			client = null;
			chain = null;
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

	<div class="rounded bg-gray-50 p-2 font-mono text-xs break-all text-gray-500">
		{chainSpec.length > 100 ? `${chainSpec.substring(0, 100)}...` : chainSpec}
	</div>

	<button
		onclick={toggle}
		disabled={connectionState === 'connecting'}
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

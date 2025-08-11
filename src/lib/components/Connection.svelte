<script lang="ts">
	import { createClient, type PolkadotClient } from 'polkadot-api';
	import { getWsProvider } from 'polkadot-api/ws-provider/web';
	import { onDestroy } from 'svelte';

	export type onConnections = {
		parachainClient: PolkadotClient;
		relaychainClient: PolkadotClient;
	};

	interface Props {
		onApiReady?: (connections: onConnections) => void;
	}

	let { onApiReady = undefined }: Props = $props();

	type ConnectionState = 'disconnected' | 'connecting' | 'syncing' | 'connected' | 'error';

	let connectionState = $state<ConnectionState>('disconnected');
	let error = $state<string | null>(null);
	let syncStatus = $state<string>('');

	let relayRpcUrl = $state<string>('');
	let parachainRpcUrl = $state<string>('');

	let relaychainClient: PolkadotClient;
	let parachainClient: PolkadotClient;

	// RPC endpoint options
	const polkadotRpcEndpoints = [
		{ name: 'Blockops', url: 'wss://polkadot-public-rpc.blockops.network/ws' },
		{ name: 'Allnodes', url: 'wss://polkadot-rpc.publicnode.com' },
		{ name: 'Stakeworld', url: 'wss://dot-rpc.stakeworld.io' },
		{ name: 'IBP2', url: 'wss://polkadot.dotters.network' },
		{ name: 'IBP1', url: 'wss://rpc.ibp.network/polkadot' },
		{ name: 'Dwellir Tunisia', url: 'wss://polkadot-rpc-tn.dwellir.com' },
		{ name: 'Dwellir', url: 'wss://polkadot-rpc.dwellir.com' },
		{ name: 'LuckyFriday', url: 'wss://rpc-polkadot.luckyfriday.io' },
		{ name: 'RadiumBlock', url: 'wss://polkadot.public.curie.radiumblock.co/ws' },
		{ name: 'RockX', url: 'wss://rockx-dot.w3node.com/polka-public-dot/ws' },
		{ name: 'SubQuery', url: 'wss://polkadot.rpc.subquery.network/public/ws' },
		{ name: 'OnFinality', url: 'wss://polkadot.api.onfinality.io/public-ws' }
	];

	const frequencyRpcEndpoints = [
		{ name: 'Frequency 1', url: 'wss://1.rpc.frequency.xyz' },
		{ name: 'Frequency 0', url: 'wss://0.rpc.frequency.xyz' },
		{ name: 'OnFinality', url: 'wss://frequency-polkadot.api.onfinality.io/public-ws' }
	];

	async function connect() {
		if (!relayRpcUrl || !parachainRpcUrl) {
			error = 'Please provide both relay chain and parachain RPC URLs';
			return;
		}

		try {
			connectionState = 'connecting';
			error = null;
			syncStatus = 'Connecting to RPC endpoints...';

			// Create clients
			relaychainClient = createClient(getWsProvider(relayRpcUrl));
			parachainClient = createClient(getWsProvider(parachainRpcUrl));

			// Wait for connection to be established
			connectionState = 'syncing';
			syncStatus = 'Waiting for chain sync...';

			// Wait for both chains to be ready
			await waitForSync(relaychainClient, 'relay');
			await waitForSync(parachainClient, 'parachain');

			syncStatus = 'Sync complete!';
			connectionState = 'connected';

			onApiReady?.({
				parachainClient,
				relaychainClient
			});
		} catch (err) {
			console.error('Connection failed', err);
			error = err instanceof Error ? err.message : 'Connection failed';
			connectionState = 'error';
			cleanup();
		}
	}

	async function waitForSync(client: PolkadotClient, chainType: string): Promise<void> {
		try {
			syncStatus = `Syncing ${chainType} chain...`;
			// Try to get the latest finalized block hash as a connectivity test
			const finalizedHash = await client.getFinalizedBlock();
			console.debug(`${chainType} chain connected, finalized block:`, finalizedHash.hash);
		} catch (err) {
			throw new Error(`Failed to sync ${chainType} chain: ${err}`);
		}
	}

	function cleanup(): void {
		try {
			// Providers will be cleaned up automatically when disconnected
			error = null;
			connectionState = 'disconnected';
			syncStatus = '';
			relaychainClient?.destroy();
			parachainClient?.destroy();
		} catch (err) {
			console.error('Cleanup error:', err);
		}
	}

	function disconnect(): void {
		cleanup();
	}

	onDestroy(() => {
		cleanup();
	});

	function getStateColor(state: ConnectionState): string {
		switch (state) {
			case 'connected':
				return 'text-green-600';
			case 'connecting':
			case 'syncing':
				return 'text-yellow-600';
			case 'error':
				return 'text-red-600';
			default:
				return 'text-gray-600';
		}
	}

	function getStateText(state: ConnectionState): string {
		switch (state) {
			case 'connected':
				return 'Connected';
			case 'connecting':
				return 'Connecting...';
			case 'syncing':
				return 'Syncing...';
			case 'error':
				return 'Error';
			default:
				return 'Disconnected';
		}
	}
</script>

<div class="rounded-lg border bg-white shadow-sm">
	<div class="px-6 py-3 border-b bg-gray-50 rounded-t-lg">
		<h2 class="font-semibold text-gray-800">RPC Connection</h2>
	</div>
	
	<div class="p-6">
		<div class="mb-4">
			<label for="relay-rpc" class="mb-2 block text-sm font-medium text-gray-700">
				Relay Chain RPC URL
			</label>
			<input
				id="relay-rpc"
				list="polkadot-endpoints"
				bind:value={relayRpcUrl}
				placeholder="wss://polkadot-rpc.publicnode.com"
				class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				disabled={connectionState === 'connecting' || connectionState === 'syncing'}
			/>
			<datalist id="polkadot-endpoints">
				{#each polkadotRpcEndpoints as endpoint (endpoint.url)}
					<option value={endpoint.url}>{endpoint.name} ({endpoint.url})</option>
				{/each}
			</datalist>
		</div>

		<div class="mb-4">
			<label for="parachain-rpc" class="mb-2 block text-sm font-medium text-gray-700">
				Parachain RPC URL
			</label>
			<input
				id="parachain-rpc"
				list="frequency-endpoints"
				bind:value={parachainRpcUrl}
				placeholder="wss://1.rpc.frequency.xyz"
				class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				disabled={connectionState === 'connecting' || connectionState === 'syncing'}
			/>
			<datalist id="frequency-endpoints">
				{#each frequencyRpcEndpoints as endpoint (endpoint.url)}
					<option value={endpoint.url}>{endpoint.name} ({endpoint.url})</option>
				{/each}
			</datalist>
		</div>

		<div class="mb-4 flex space-x-4">
			<button
				onclick={connect}
				disabled={connectionState === 'connecting' || connectionState === 'syncing'}
				class="rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
			>
				{connectionState === 'connecting' || connectionState === 'syncing'
					? 'Connecting...'
					: 'Connect'}
			</button>

			{#if connectionState === 'connected'}
				<button
					onclick={disconnect}
					class="rounded-md bg-red-500 px-4 py-2 text-white hover:bg-red-600 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none"
				>
					Disconnect
				</button>
			{/if}
		</div>

		<div class="mb-2">
			<span class="text-sm text-gray-600">Status:</span>
			<span class={`ml-1 text-sm font-medium ${getStateColor(connectionState)}`}>
				{getStateText(connectionState)} | Sync: {syncStatus || 'None'}
			</span>
		</div>

		{#if error}
			<div class="rounded-md bg-red-50 p-3">
				<p class="text-sm text-red-600">{error}</p>
			</div>
		{/if}
	</div>
</div>

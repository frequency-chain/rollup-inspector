<script lang="ts">
	import { createClient, type PolkadotClient } from 'polkadot-api';
	import { getWsProvider } from 'polkadot-api/ws-provider/web';
	import { onDestroy } from 'svelte';
	import { clearAllRelayBlocks } from '$lib/services/relayBlockManager';

	// Import chain data
	import polkadotChains from '$lib/assets/polkadot.json';
	import kusamaChains from '$lib/assets/kusama.json';
	import westendChains from '$lib/assets/westend.json';
	import paseoChains from '$lib/assets/paseo.json';

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

	let relayRpcUrl = $state<string>('');
	let parachainRpcUrl = $state<string>('');

	let relaychainClient: PolkadotClient;
	let parachainClient: PolkadotClient;

	// Combine all chain data
	const allChains = [...polkadotChains, ...kusamaChains, ...westendChains, ...paseoChains];

	// Get relay chains (chains without relayChainInfo)
	const relayChains = allChains.filter((chain) => !chain.relayChainInfo);

	// Get selected relay chain info
	let selectedRelayChain = $derived.by(() => {
		if (!relayRpcUrl) return null;
		// Find relay chain that has this URL in its rpcs
		return relayChains.find((chain) => Object.values(chain.rpcs).includes(relayRpcUrl)) || null;
	});

	// Get parachains for selected relay chain
	let availableParachains = $derived.by(() => {
		if (!selectedRelayChain) return [];
		return allChains.filter(
			(chain) => chain.relayChainInfo && chain.relayChainInfo.id === selectedRelayChain.id
		);
	});

	// Generate endpoint options for datalists
	let relayEndpoints = $derived.by(() => {
		const endpoints: Array<{ chain: string; name: string; url: string }> = [];
		for (const chain of relayChains) {
			for (const [name, url] of Object.entries(chain.rpcs)) {
				endpoints.push({
					chain: chain.display,
					name,
					url
				});
			}
		}
		return endpoints;
	});

	let parachainEndpoints = $derived.by(() => {
		const endpoints: Array<{ chain: string; name: string; url: string }> = [];
		for (const chain of availableParachains) {
			for (const [name, url] of Object.entries(chain.rpcs)) {
				endpoints.push({
					chain: chain.display,
					name,
					url
				});
			}
		}
		return endpoints;
	});

	async function connect() {
		if (!relayRpcUrl || !parachainRpcUrl) {
			error = 'Please provide both relay chain and parachain RPC URLs';
			return;
		}

		try {
			connectionState = 'connecting';
			error = null;

			// Clear all previous chain data before connecting to new chains
			clearAllRelayBlocks();
			console.log('Cleared previous chain data before new connection');

			// Create clients
			relaychainClient = createClient(getWsProvider(relayRpcUrl));
			parachainClient = createClient(getWsProvider(parachainRpcUrl));

			// Wait for connection to be established
			connectionState = 'syncing';

			// Wait for both chains to be ready
			await waitForSync(relaychainClient, 'relay');
			await waitForSync(parachainClient, 'parachain');

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
	<div class="rounded-t-lg border-b bg-gray-50 px-6 py-3">
		<h2 class="font-semibold text-gray-800">RPC Connection</h2>
	</div>

	<div class="p-6">
		<div class="mb-4">
			<label for="relay-rpc" class="mb-2 block text-sm font-medium text-gray-700">
				Relay Chain RPC URL
			</label>
			<input
				id="relay-rpc"
				list="relay-endpoints"
				bind:value={relayRpcUrl}
				placeholder="Select or enter relay chain RPC URL"
				class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				disabled={connectionState === 'connecting' || connectionState === 'syncing'}
			/>
			<datalist id="relay-endpoints">
				{#each relayEndpoints as endpoint (endpoint.url)}
					<option value={endpoint.url}>{endpoint.chain} - {endpoint.name}</option>
				{/each}
			</datalist>
		</div>

		<div class="mb-4">
			<label for="parachain-rpc" class="mb-2 block text-sm font-medium text-gray-700">
				Parachain RPC URL
				{#if selectedRelayChain}
					<span class="text-xs text-gray-500">({selectedRelayChain.display} parachains)</span>
				{/if}
			</label>
			<input
				id="parachain-rpc"
				list="parachain-endpoints"
				bind:value={parachainRpcUrl}
				placeholder={selectedRelayChain
					? `Select or enter ${selectedRelayChain.display} parachain RPC URL`
					: 'Select relay chain first'}
				class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				disabled={connectionState === 'connecting' || connectionState === 'syncing'}
			/>
			<datalist id="parachain-endpoints">
				{#each parachainEndpoints as endpoint (endpoint.url)}
					<option value={endpoint.url}>{endpoint.chain} - {endpoint.name}</option>
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
				{getStateText(connectionState)}
			</span>
		</div>

		{#if error}
			<div class="rounded-md bg-red-50 p-3">
				<p class="text-sm text-red-600">{error}</p>
			</div>
		{/if}
	</div>
</div>

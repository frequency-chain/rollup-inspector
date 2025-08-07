<script lang="ts">
	import { createClient, type PolkadotClient } from 'polkadot-api';
	import { getSmProvider } from 'polkadot-api/sm-provider';
	import type { Chain } from 'polkadot-api/smoldot';
	import { onDestroy } from 'svelte';
	import { smoldotService } from '$lib/services/smoldot';

	interface Props {
		parachainSpec?: string;
		relaychainSpec?: string;
		onApiReady?: (parachainClient: PolkadotClient, relaychainClient: PolkadotClient) => void;
	}

	let { parachainSpec = '', relaychainSpec = '', onApiReady = undefined }: Props = $props();

	type ConnectionState = 'disconnected' | 'connecting' | 'syncing' | 'connected' | 'error';

	let connectionState = $state<ConnectionState>('disconnected');
	let parachainClient = $state<PolkadotClient | null>(null);
	let relaychainClient = $state<PolkadotClient | null>(null);
	let relayChain = $state<Chain | null>(null);
	let parachainChain = $state<Chain | null>(null);

	let error = $state<string | null>(null);
	let syncStatus = $state<string>('Initializing...');
	let databaseSaveTimers: number[] = [];

	async function connect(): Promise<void> {
		if (!parachainSpec || !relaychainSpec) return;

		try {
			connectionState = 'connecting';
			error = null;

			// Get smoldot client instance
			const smoldot = smoldotService.getClient();

			// Parse chain specs to get chain IDs for database keys
			const relaySpec = JSON.parse(relaychainSpec);
			const paraSpec = JSON.parse(parachainSpec);
			const relayChainId = relaySpec.id || relaySpec.name;
			const paraChainId = paraSpec.id || paraSpec.name;

			// Add relaychain first with database persistence
			const relaySmoldot = await smoldot.addChain({
				chainSpec: relaychainSpec,
				databaseContent: smoldotService.loadChainDatabase(relayChainId)
			});
			// The state creates a proxy, but we need the original for the smoldot lookup
			relayChain = relaySmoldot;

			// Add parachain with relaychain as potential relay and database persistence
			parachainChain = await smoldot.addChain({
				chainSpec: parachainSpec,
				potentialRelayChains: [relaySmoldot],
				databaseContent: smoldotService.loadChainDatabase(paraChainId)
			});

			// Create clients
			relaychainClient = createClient(getSmProvider(relayChain));
			parachainClient = createClient(getSmProvider(parachainChain));

			// Wait for both chains to sync
			connectionState = 'syncing';
			await waitForSync(relaychainClient, 'relay');
			await waitForSync(parachainClient, 'parachain');
			syncStatus = 'Sync complete!';

			// Start periodic database saving
			startDatabaseSaving(relaychainClient, relayChainId, 'relay');
			startDatabaseSaving(parachainClient, paraChainId, 'parachain');

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
			// Clear database save timers
			databaseSaveTimers.forEach((timer) => clearInterval(timer));
			databaseSaveTimers = [];

			// Only remove chains, don't terminate the smoldot service
			// as it may be used by other components
			parachainChain?.remove();
			relayChain?.remove();
		} catch (err) {
			console.error('Cleanup error:', err);
		} finally {
			parachainClient = null;
			relaychainClient = null;
			parachainChain = null;
			relayChain = null;
			error = null;
			syncStatus = 'Initializing...';
		}
	}

	function toggle(): void {
		if (connectionState === 'connected') {
			disconnect();
		} else {
			connect();
		}
	}

	async function waitForSync(
		client: PolkadotClient | null,
		specType: 'relay' | 'parachain'
	): Promise<void> {
		if (!client) return;

		syncStatus = `Waiting for ${specType} chain to sync...`;

		// Wait for relay chain to produce at least one finalized block beyond genesis
		await new Promise<void>((resolve) => {
			const sub = client!.finalizedBlock$.subscribe(() => {
				sub.unsubscribe();
				resolve();
			});
		});
	}

	function startDatabaseSaving(client: PolkadotClient, chainId: string, chainType: string): void {
		// Save database every 30 seconds
		const timer = window.setInterval(async () => {
			try {
				// Use the chainHead_unstable_finalizedDatabase JSON-RPC method
				const database = await client._request('chainHead_unstable_finalizedDatabase', [
					1024 * 1024
				]); // 1MB limit
				if (database && typeof database === 'string') {
					smoldotService.saveChainDatabase(chainId, database);
					console.log(`Database saved for ${chainType} chain: ${chainId}`);
				}
			} catch (err) {
				console.warn(`Failed to save database for ${chainType} chain ${chainId}:`, err);
			}
		}, 30000);

		databaseSaveTimers.push(timer);
	}

	onDestroy(() => cleanup());
</script>

<div class="space-y-3 rounded-lg border p-4">
	<div class="flex items-center justify-between">
		<h3 class="font-medium">Connection</h3>
		<div class="flex items-center gap-2">
			<div
				class="h-2 w-2 rounded-full"
				class:bg-green-500={connectionState === 'connected'}
				class:bg-yellow-500={connectionState === 'connecting'}
				class:bg-blue-500={connectionState === 'syncing'}
				class:bg-red-500={connectionState === 'error'}
				class:bg-gray-400={connectionState === 'disconnected'}
			></div>
			<span class="text-sm text-gray-600 capitalize">{connectionState}</span>
		</div>
	</div>

	<div class="space-y-1">
		{#if relaychainSpec}
			<div class="text-xs text-gray-600">Relaychain</div>
			<div class="rounded bg-gray-50 p-2 font-mono text-xs break-all text-gray-500">
				{relaychainSpec.length > 50 ? `${relaychainSpec.substring(0, 50)}...` : relaychainSpec}
			</div>
		{/if}
		{#if parachainSpec}
			<div class="text-xs text-gray-600">Parachain</div>
			<div class="rounded bg-gray-50 p-2 font-mono text-xs break-all text-gray-500">
				{parachainSpec.length > 50 ? `${parachainSpec.substring(0, 50)}...` : parachainSpec}
			</div>
		{/if}
	</div>

	<button
		onclick={toggle}
		disabled={connectionState === 'connecting' ||
			connectionState === 'syncing' ||
			!parachainSpec ||
			!relaychainSpec}
		class="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
	>
		{connectionState === 'connected'
			? 'Disconnect'
			: connectionState === 'connecting'
				? 'Connecting...'
				: connectionState === 'syncing'
					? 'Syncing...'
					: 'Connect'}
	</button>

	{#if connectionState === 'syncing'}
		<div class="rounded bg-blue-50 p-2 text-sm text-blue-600">
			{syncStatus}
		</div>
	{:else if error}
		<div class="rounded bg-red-50 p-2 text-sm text-red-600">
			{error}
		</div>
	{/if}
</div>

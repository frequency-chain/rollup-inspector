<script lang="ts">
	import Connection, { type onConnections } from '$lib/components/Connection.svelte';
	import type { PolkadotClient } from 'polkadot-api';
	import ParachainBlocks from '$lib/components/ParachainBlocks.svelte';
	import ChainStatus from '$lib/components/ChainStatus.svelte';

	let parachainClient = $state.raw<PolkadotClient | null>(null);
	let relayClient = $state.raw<PolkadotClient | null>(null);

	function onConnectionReady(connections: onConnections): void {
		parachainClient = connections.parachainClient;
		relayClient = connections.relaychainClient;
	}
</script>

<main class="min-h-screen bg-gray-50 p-4">
	<div class="mx-auto max-w-none">
		<h1 class="mb-6 text-center text-2xl font-bold text-gray-800">Parachain Block Inspector</h1>

		<!-- Connection and Status - 50/50 split on wide screens -->
		<div class="mb-6 flex flex-col xl:flex-row gap-6">
			<!-- Connection Section (Left) -->
			<div class="xl:w-1/2">
				<Connection onApiReady={onConnectionReady} />
			</div>
			
			<!-- Chain Status Section (Right) -->
			<div class="xl:w-1/2">
				{#if parachainClient && relayClient}
					<ChainStatus {parachainClient} {relayClient} />
				{:else}
					<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
						<h2 class="text-xl font-semibold text-gray-400">Chain Status</h2>
						<p class="mt-4 text-gray-500">Connect to view chain status</p>
					</div>
				{/if}
			</div>
		</div>

		{#if parachainClient && relayClient}
			<ParachainBlocks {parachainClient} {relayClient} />
		{/if}
	</div>
</main>

<script lang="ts">
	import Connection, { type onConnections } from '$lib/components/Connection.svelte';
	import type { PolkadotClient } from 'polkadot-api';
	import ParachainBlocks from '$lib/components/ParachainBlocks.svelte';

	let parachainClient = $state.raw<PolkadotClient | null>(null);
	let relayClient = $state.raw<PolkadotClient | null>(null);

	function onConnectionReady(connections: onConnections): void {
		parachainClient = connections.parachainClient;
		relayClient = connections.relaychainClient;
	}
</script>

<main class="mx-auto max-w-4xl p-6">
	<h1 class="mb-8 text-center text-2xl font-bold">Parachain Block Inspector</h1>

	<div class="mb-8">
		<Connection onApiReady={onConnectionReady} />
	</div>

	{#if parachainClient && relayClient}
		<div class="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
			<p class="text-green-800">Both connections ready!</p>
		</div>
		<ParachainBlocks {parachainClient} {relayClient} />
	{/if}
</main>

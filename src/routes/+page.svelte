<script lang="ts">
	import Connection from '$lib/components/Connection.svelte';
	import ChainSpecLoader from '$lib/components/ChainSpecLoader.svelte';
	import type { PolkadotClient } from 'polkadot-api';
	import ParachainBlocks from '$lib/components/ParachainBlocks.svelte';

	let parachainClient = $state<PolkadotClient | null>(null);
	let relaychainClient = $state<PolkadotClient | null>(null);

	let parachainChainSpec = $state<string>();
	let relaychainChainSpec = $state<string>();

	function onSpecsLoaded({
		parachainSpec,
		relaychainSpec
	}: {
		parachainSpec: string;
		relaychainSpec: string;
	}) {
		parachainChainSpec = parachainSpec;
		relaychainChainSpec = relaychainSpec;
	}

	function onConnectionReady(paraClient: PolkadotClient, relayClient: PolkadotClient): void {
		parachainClient = paraClient;
		relaychainClient = relayClient;
	}
</script>

<main class="mx-auto max-w-4xl p-6">
	<h1 class="mb-8 text-center text-2xl font-bold">Parachain Block Inspector</h1>

	<div class="mb-8">
		<ChainSpecLoader label="Load Chain Specifications" specLoaded={onSpecsLoaded} />
	</div>

	<div class="mb-8">
		<Connection
			parachainSpec={parachainChainSpec}
			relaychainSpec={relaychainChainSpec}
			onApiReady={onConnectionReady}
		/>
	</div>

	{#if parachainClient && relaychainClient}
		<div class="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
			<p class="text-green-800">Both connections ready!</p>
		</div>
		<ParachainBlocks client={parachainClient} />
	{/if}
</main>

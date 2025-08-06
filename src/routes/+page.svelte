<script lang="ts">
	import Connection from '$lib/components/Connection.svelte';
	import ChainSpecLoader from '$lib/components/ChainSpecLoader.svelte';
	import type { PolkadotClient } from 'polkadot-api';
	import ParachainBlocks from '$lib/components/ParachainBlocks.svelte';

	let parachainClient = $state<PolkadotClient | null>(null);
	let relaychainClient = $state<PolkadotClient | null>(null);

	let parachainChainSpec = $state<string | null>(null);
	let parachainName = $state<string>('Parachain');
	let relaychainChainSpec = $state<string | null>(null);
	let relaychainName = $state<string>('Relay Chain');

	function onParachainSpecLoaded({ spec, name }: { spec: string; name: string }) {
		parachainChainSpec = spec;
		parachainName = name;
	}

	function onRelaychainSpecLoaded({ spec, name }: { spec: string; name: string }) {
		relaychainChainSpec = spec;
		relaychainName = name;
	}

	function onConnectionReady(paraClient: PolkadotClient, relayClient: PolkadotClient): void {
		parachainClient = paraClient;
		relaychainClient = relayClient;
		console.log('Both chains connected via smoldot');
		
		paraClient.finalizedBlock$.subscribe((block) => {
			console.log('Parachain finalized block:', block.number, block.hash);
		});
		
		relayClient.finalizedBlock$.subscribe((block) => {
			console.log('Relay chain finalized block:', block.number, block.hash);
		});
	}
</script>

<main class="mx-auto max-w-4xl p-6">
	<h1 class="mb-8 text-center text-2xl font-bold">Parachain Block Inspector</h1>

	<div class="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
		<div>
			<ChainSpecLoader label="Load Raw Parachain Spec" specLoaded={onParachainSpecLoaded} />
		</div>
		<div>
			<ChainSpecLoader label="Load Raw Relay Chain Spec" specLoaded={onRelaychainSpecLoaded} />
		</div>
	</div>

	<div class="mb-8">
		<Connection
			parachainSpec={parachainChainSpec}
			relaychainSpec={relaychainChainSpec}
			chainName="Chain Connection"
			onApiReady={onConnectionReady}
		/>
	</div>

	{#if parachainClient && relaychainClient}
		<div class="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
			<p class="text-green-800">Both connections ready!</p>
			<ParachainBlocks client={parachainClient} />
		</div>
	{/if}
</main>

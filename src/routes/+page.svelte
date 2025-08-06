<script lang="ts">
	import Connection from '$lib/components/Connection.svelte';
	import { chainSpec as polkadotChainSpec } from 'polkadot-api/chains/polkadot';
	import type { PolkadotClient } from 'polkadot-api';

	let parachainApi = $state<PolkadotClient | null>(null);
	let relaychainApi = $state<PolkadotClient | null>(null);

	// You'll need to provide your parachain's chainSpec
	// This could be loaded from a file or fetched from an endpoint
	let parachainChainSpec = $state<string>(`{
    "name": "Your Parachain",
    "id": "your-parachain",
    "chainType": "Live",
    "bootNodes": [],
    "telemetryEndpoints": null,
    "protocolId": "your-parachain",
    "properties": {},
    "relay_chain": "polkadot",
    "para_id": 2000,
    "codeSubstitutes": {},
    "genesis": {}
  }`);

	function onParachainReady(api: PolkadotClient): void {
		parachainApi = api;
		console.log('Parachain connected via smoldot');

		// Subscribe to finalized blocks
		api.finalizedBlock$.subscribe((block) => {
			console.log('Parachain finalized block:', block.number, block.hash);
		});
	}

	function onRelaychainReady(api: PolkadotClient): void {
		relaychainApi = api;
		console.log('Relay chain connected via smoldot');

		// Subscribe to finalized blocks
		api.finalizedBlock$.subscribe((block) => {
			console.log('Relay chain finalized block:', block.number, block.hash);
		});
	}
</script>

<main class="mx-auto max-w-4xl p-6">
	<h1 class="mb-8 text-center text-2xl font-bold">Parachain Block Inspector</h1>

	<div class="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
		<Connection
			chainSpec={parachainChainSpec}
			chainName="Parachain (Smoldot)"
			onApiReady={onParachainReady}
		/>

		<Connection
			chainSpec={polkadotChainSpec}
			chainName="Polkadot (Smoldot)"
			onApiReady={onRelaychainReady}
		/>
	</div>

	{#if parachainApi && relaychainApi}
		<div class="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
			<p class="text-green-800">Both smoldot connections ready - start building your inspector!</p>
		</div>
	{/if}
</main>

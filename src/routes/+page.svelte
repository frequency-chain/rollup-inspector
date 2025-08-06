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

	function onParachainReady(client: PolkadotClient): void {
		parachainClient = client;
		console.log('Parachain connected via smoldot');
		client.finalizedBlock$.subscribe((block) => {
			console.log('Parachain finalized block:', block.number, block.hash);
		});
	}

	function onRelaychainReady(client: PolkadotClient): void {
		relaychainClient = client;
		console.log('Relay chain connected via smoldot');
		client.finalizedBlock$.subscribe((block) => {
			console.log('Relay chain finalized block:', block.number, block.hash);
		});
	}
</script>

<main class="mx-auto max-w-4xl p-6">
	<h1 class="mb-8 text-center text-2xl font-bold">Parachain Block Inspector</h1>

	<div class="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
		<div>
			<ChainSpecLoader label="Load Raw Parachain Spec" specLoaded={onParachainSpecLoaded} />
			{#if parachainChainSpec}
				<Connection
					chainSpec={parachainChainSpec}
					chainName={parachainName}
					onApiReady={onParachainReady}
				/>
			{/if}
		</div>
		<div>
			<ChainSpecLoader label="Load Raw Relay Chain Spec" specLoaded={onRelaychainSpecLoaded} />
			{#if relaychainChainSpec}
				<Connection
					chainSpec={relaychainChainSpec}
					chainName={relaychainName}
					onApiReady={onRelaychainReady}
				/>
			{/if}
		</div>
	</div>

	{#if parachainClient && relaychainClient}
		<div class="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
			<p class="text-green-800">Both connections ready!</p>
			<ParachainBlocks client={parachainClient} />
		</div>
	{/if}
</main>

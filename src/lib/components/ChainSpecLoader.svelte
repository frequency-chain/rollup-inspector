<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import { chainSpec as polkadotSpec } from 'polkadot-api/chains/polkadot';
	import { chainSpec as ksmcc3Spec } from 'polkadot-api/chains/ksmcc3';
	import { chainSpec as paseoSpec } from 'polkadot-api/chains/paseo';
	import { chainSpec as westend2Spec } from 'polkadot-api/chains/westend2';

	interface Props {
		label?: string;
		specLoaded: (data: { parachainSpec: string; relaychainSpec: string }) => void;
	}

	interface SpecPair {
		parachainSpec: string;
		relaychainSpec: string;
		parachainName: string;
		relaychainName: string;
	}

	let { label = 'Load Chain Specs', specLoaded = () => {} }: Props = $props();

	let loadMethod = $state<'select' | 'file' | 'url'>('select');
	let parachainUrl = $state<string>('');
	let relaychainUrl = $state<string>('');
	let isLoading = $state<boolean>(false);
	let error = $state<string | null>(null);
	let parachainFileInput = $state<FileList | null>(null);
	let relaychainFileInput = $state<FileList | null>(null);
	let selectedPair = $state<string>('');
	let availableSpecs = $state<Array<SpecPair>>([]);

	// Parse relaychain specs first
	const relaychainSpecs = new SvelteMap<string, string>();
	for (const content of [polkadotSpec, ksmcc3Spec, paseoSpec, westend2Spec]) {
		try {
			const spec = JSON.parse(content);
			console.debug('Loaded relay chain spec id', spec.id);
			relaychainSpecs.set(spec.id || spec.name, content);
		} catch (err) {
			console.error(`Failed to parse relaychain spec ${content}:`, err);
		}
	}

	$effect(() => {
		if (parachainFileInput) {
			const file = parachainFileInput.item(0);
			if (file) handleSpecFile(file, 'parachain');
		}
	});

	$effect(() => {
		if (relaychainFileInput) {
			const file = relaychainFileInput.item(0);
			if (file) handleSpecFile(file, 'relay');
		}
	});

	$effect(() => {
		try {
			// Load all specs using Vite's import.meta.glob
			const parachainModules = import.meta.glob('/src/lib/assets/specs/*.json', {
				eager: true,
				query: '?raw',
				import: 'default'
			}) as Record<string, string>;

			// Parse parachain specs and match with relay chains
			const pairs: SpecPair[] = [];
			for (const [path, content] of Object.entries(parachainModules)) {
				try {
					const spec = JSON.parse(content);
					// Extract relay chain reference (common patterns)
					let relayChainId = spec.relay_chain || spec.relayChain || spec.para_id?.relay_chain;

					// Find matching relay chain
					const relayChain = relayChainId ? relaychainSpecs.get(relayChainId) : null;
					if (relayChain) {
						pairs.push({
							parachainSpec: content,
							parachainName: spec.name,
							relaychainSpec: relayChain,
							relaychainName: relayChainId
						});
					} else {
						console.error(
							`Skipping parachain ${spec.name}: no matching relay chain found for ID '${relayChainId}'`
						);
					}
				} catch (err) {
					console.error(`Failed to parse parachain spec ${path}:`, err);
				}
			}

			availableSpecs = pairs;

			// Auto-select first pair if available
			if (pairs.length > 0 && !selectedPair) {
				selectedPair = `${pairs[0].parachainName}-${pairs[0].relaychainName}`;
			}
		} catch (err) {
			console.error('Failed to load available specs:', err);
		}
	});

	let parachainSpecData = $state<string | null>(null);
	let relaychainSpecData = $state<string | null>(null);

	function handlePairedSpecs(paraSpec: string, relaySpec: string) {
		specLoaded({
			parachainSpec: paraSpec,
			relaychainSpec: relaySpec
		});
	}

	function handleSpecString(spec: string, specType: 'relay' | 'parachain') {
		try {
			JSON.parse(spec);
			if (specType === 'relay') relaychainSpecData = spec;
			if (specType === 'parachain') parachainSpecData = spec;
			checkAndSubmitPairs();
		} catch (err) {
			console.error('Invalid spec JSON', err, spec);
			error = 'Invalid spec JSON';
		}
	}

	function checkAndSubmitPairs() {
		if (parachainSpecData && relaychainSpecData) {
			handlePairedSpecs(parachainSpecData, relaychainSpecData);
			// Reset for next load
			parachainSpecData = null;
			relaychainSpecData = null;
		}
	}

	async function loadFromUrls(): Promise<void> {
		if (!parachainUrl.trim() || !relaychainUrl.trim()) {
			error = 'Both URLs are required';
			return;
		}

		try {
			isLoading = true;
			error = null;

			const [parachainResponse, relaychainResponse] = await Promise.all([
				fetch(parachainUrl),
				fetch(relaychainUrl)
			]);

			if (!parachainResponse.ok) {
				throw new Error(
					`Parachain HTTP ${parachainResponse.status}: ${parachainResponse.statusText}`
				);
			}
			if (!relaychainResponse.ok) {
				throw new Error(
					`Relaychain HTTP ${relaychainResponse.status}: ${relaychainResponse.statusText}`
				);
			}

			const [parachainSpec, relaychainSpec] = await Promise.all([
				parachainResponse.text(),
				relaychainResponse.text()
			]);

			handleSpecString(parachainSpec, 'parachain');
			handleSpecString(relaychainSpec, 'relay');
		} catch (err) {
			console.error('Failed loading specs', err);
			error = err instanceof Error ? err.message : 'Failed to load chain specs';
		} finally {
			isLoading = false;
		}
	}

	function handleSpecFile(file: File, specType: 'parachain' | 'relay'): void {
		const reader = new FileReader();

		reader.onload = (e) => {
			handleSpecString(e.target?.result as string, specType);
		};

		reader.onerror = () => {
			console.error(specType + ' file load failed');
			error = 'Failed to read file for ' + specType;
		};

		reader.readAsText(file);
	}

	async function loadSelectedPair(): Promise<void> {
		if (!selectedPair) {
			error = 'Please select a spec pair';
			return;
		}

		try {
			isLoading = true;
			error = null;

			const pair = availableSpecs.find(
				(spec) => `${spec.parachainName}-${spec.relaychainName}` === selectedPair
			);

			if (pair) {
				handlePairedSpecs(pair.parachainSpec, pair.relaychainSpec);
			} else {
				throw new Error('Selected spec pair not found');
			}
		} catch (err) {
			console.error('Failed loading selected pair', err);
			error = err instanceof Error ? err.message : 'Failed to load chain specs';
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="space-y-6 rounded-lg border bg-white p-6">
	<h3 class="text-lg font-semibold text-gray-900">{label}</h3>

	<fieldset class="space-y-4">
		<legend class="sr-only">Load Method</legend>
		<div class="flex items-center space-x-6">
			<label class="flex items-center space-x-2">
				<input
					type="radio"
					bind:group={loadMethod}
					value="select"
					class="form-radio h-4 w-4 text-blue-600"
				/>
				<span class="text-gray-700">Select Preset</span>
			</label>
			<label class="flex items-center space-x-2">
				<input
					type="radio"
					bind:group={loadMethod}
					value="file"
					class="form-radio h-4 w-4 text-blue-600"
				/>
				<span class="text-gray-700">File Upload</span>
			</label>
			<label class="flex items-center space-x-2">
				<input
					type="radio"
					bind:group={loadMethod}
					value="url"
					class="form-radio h-4 w-4 text-blue-600"
				/>
				<span class="text-gray-700">URL Download</span>
			</label>
		</div>
	</fieldset>

	{#if loadMethod === 'select'}
		<div class="space-y-4">
			<div>
				<label for="spec-select" class="block text-sm font-medium text-gray-700"
					>Available Spec Pairs</label
				>
				<select
					id="spec-select"
					bind:value={selectedPair}
					class="mt-1 block w-full form-select rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
					disabled={isLoading}
				>
					<option value="">Select a parachain-relaychain pair...</option>
					{#each availableSpecs as spec (spec.parachainName + spec.relaychainName)}
						<option value="{spec.parachainName}-{spec.relaychainName}">
							{spec.parachainName} - {spec.relaychainName}
						</option>
					{/each}
				</select>
			</div>
			<button
				onclick={loadSelectedPair}
				disabled={isLoading || !selectedPair}
				class="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
			>
				{isLoading ? 'Loading…' : 'Load Selected Pair'}
			</button>
		</div>
	{:else if loadMethod === 'file'}
		<div class="space-y-4">
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<label for="parachain-file-input" class="block text-sm font-medium text-gray-700"
						>Parachain Spec</label
					>
					<input
						name="parachain-file-input"
						bind:files={parachainFileInput}
						type="file"
						accept=".json"
						class="file:form-file mt-1 form-input block w-full text-sm text-gray-700"
					/>
				</div>
				<div>
					<label for="relaychain-file-input" class="block text-sm font-medium text-gray-700"
						>Relaychain Spec</label
					>
					<input
						name="relaychain-file-input"
						bind:files={relaychainFileInput}
						type="file"
						accept=".json"
						class="file:form-file mt-1 form-input block w-full text-sm text-gray-700"
					/>
				</div>
			</div>
			<p class="text-xs text-gray-500">
				Select both parachain and relaychain JSON specification files
			</p>
		</div>
	{:else}
		<div class="space-y-4">
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<label for="parachain-url" class="block text-sm font-medium text-gray-700"
						>Parachain Spec URL</label
					>
					<input
						id="parachain-url"
						bind:value={parachainUrl}
						type="url"
						placeholder="https://example.com/parachain.json"
						class="mt-1 form-input block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						disabled={isLoading}
					/>
				</div>
				<div>
					<label for="relaychain-url" class="block text-sm font-medium text-gray-700"
						>Relaychain Spec URL</label
					>
					<input
						id="relaychain-url"
						bind:value={relaychainUrl}
						type="url"
						placeholder="https://example.com/relaychain.json"
						class="mt-1 form-input block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						disabled={isLoading}
					/>
				</div>
			</div>
			<button
				onclick={loadFromUrls}
				disabled={isLoading || !parachainUrl.trim() || !relaychainUrl.trim()}
				class="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
			>
				{isLoading ? 'Loading…' : 'Download Specs'}
			</button>
		</div>
	{/if}

	{#if error}
		<div class="rounded-md bg-red-50 p-3">
			<p class="text-sm font-medium text-red-800">{error}</p>
		</div>
	{/if}
</div>

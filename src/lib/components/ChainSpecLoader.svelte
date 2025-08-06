<script lang="ts">
	interface Props {
		label?: string;
		specLoaded: (data: { spec: string; name: string }) => void;
	}

	let { label = 'Load Chain Spec', specLoaded = () => {} }: Props = $props();

	let loadMethod = $state<'file' | 'url'>('file');
	let url = $state<string>('');
	let isLoading = $state<boolean>(false);
	let error = $state<string | null>(null);
	let fileInput = $state<FileList | null>(null);

	$effect(() => {
		if (fileInput) {
			const file = fileInput.item(0);
			if (file) handleFile(file);
		}
	});

	function handleSpecString(spec: string) {
		const parsedSpec = JSON.parse(spec);
		const urlParts = url.split('/');
		const fileName = urlParts[urlParts.length - 1] || 'chainspec';
		specLoaded({ spec, name: parsedSpec?.name || fileName });
	}

	async function loadFromUrl(): Promise<void> {
		if (!url.trim()) {
			error = 'URL is required';
			return;
		}

		try {
			isLoading = true;
			error = null;

			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			handleSpecString(await response.text());
		} catch (err) {
			console.error('Failed loading spec', err);
			error = err instanceof Error ? err.message : 'Failed to load chain spec';
		} finally {
			isLoading = false;
		}
	}

	function handleFile(file: File): void {
		const reader = new FileReader();

		reader.onload = (e) => {
			handleSpecString(e.target?.result as string);
		};

		reader.onerror = () => {
			console.error('Spec file load failed');
			error = 'Failed to read file';
		};

		reader.readAsText(file);
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

	{#if loadMethod === 'file'}
		<div class="space-y-2">
			<input
				bind:files={fileInput}
				type="file"
				accept=".json"
				class="file:form-file form-input block w-full text-sm text-gray-700"
			/>
			<p class="text-xs text-gray-500">Select a JSON chain specification file</p>
		</div>
	{:else}
		<div class="space-y-4">
			<div>
				<label for="spec-url" class="block text-sm font-medium text-gray-700">Spec URL</label>
				<input
					id="spec-url"
					bind:value={url}
					type="url"
					placeholder="https://example.com/chainspec.json"
					class="mt-1 form-input block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
					disabled={isLoading}
				/>
			</div>
			<button
				onclick={loadFromUrl}
				disabled={isLoading || !url.trim()}
				class="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
			>
				{isLoading ? 'Loading…' : 'Download Spec'}
			</button>
		</div>
	{/if}

	{#if error}
		<div class="rounded-md bg-red-50 p-3">
			<p class="text-sm font-medium text-red-800">{error}</p>
		</div>
	{/if}
</div>

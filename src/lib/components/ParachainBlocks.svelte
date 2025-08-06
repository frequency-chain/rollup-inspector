<script lang="ts">
	import type { BlockInfo, BlockHeader, PolkadotClient } from 'polkadot-api';
	import type { SystemEvent } from '@polkadot-api/observable-client';
	import BlockDetails from './BlockDetails.svelte';

	let { client }: { client: PolkadotClient } = $props();

	type BlockDisplay = {
		number: number;
		events: SystemEvent[];
		author: string | null;
		hash: string;
		header: BlockHeader;
	};

	let blocks = $state<BlockDisplay[]>([]);
	let destroyed = $state<boolean>(false);

	async function addBlock(block: BlockInfo) {
		const hash = block.hash;
		let author: string | null = null;

		const [header, events] = await Promise.all([
			client.getBlockHeader(hash),
			client.getUnsafeApi().query.System.Events.getValue({ at: hash }) as unknown as SystemEvent[]
		]);
		author = null;

		// Only update if component is still mounted
		if (!destroyed) {
			blocks = [
				{ number: block.number, events, author, hash, header },
				...blocks.filter((b) => b.hash !== hash)
			].slice(0, 500);
		}
	}

	$effect(() => {
		if (!client) return;

		blocks = [];
		destroyed = false;

		const sub = client.blocks$.subscribe((block: BlockInfo) => {
			addBlock(block);
		});

		return () => {
			sub?.unsubscribe();
			destroyed = true;
		};
	});
</script>

{#if !client}
	<div class="text-gray-500">Not connected.</div>
{:else}
	{#each blocks as block (block.hash)}
		<BlockDetails
			number={block.number}
			events={block.events}
			author={block.author}
			hash={block.hash}
		/>
	{/each}
{/if}

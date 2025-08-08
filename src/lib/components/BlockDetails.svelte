<script lang="ts">
	import type { SystemEvent } from '@polkadot-api/observable-client';
	import type { BlockHeader } from 'polkadot-api';

	type BlockDisplay = {
		number: number;
		events: SystemEvent[];
		author: string | null;
		hash: string;
		header: BlockHeader;
		relayIncludedAt?: number;
		relayBackedAt?: number;
		relayParentHash?: string;
		relayParentNumber?: number;
	};

	export let blockNumber: number;
	export let blocks: BlockDisplay[];
	export let isFinalized: boolean = false;
</script>

<div class="mb-4">
	<h3 class="mb-2 text-lg font-semibold">
		Block #{blockNumber.toLocaleString()}
		{isFinalized ? '(finalized)' : ''}
	</h3>

	{#if blocks.length > 1}
		<div class="mb-2 text-sm text-orange-600">
			⚠️ Fork detected - {blocks.length} competing blocks
		</div>
	{/if}

	{#each blocks as block (block.hash)}
		<div class="mb-2 ml-4 border-l-2 border-gray-300 pl-4">
			{#if blocks.length > 1}
				<div class="mb-1 text-xs text-gray-600">
					Hash: {block.hash.slice(0, 16)}...
				</div>
			{/if}

			<div class="rounded border bg-white p-2 shadow">
				<div>Event Count: {block.events.length}</div>
				<div>Author: {block.author ?? 'Unknown'}</div>

				<!-- Relay Parent Information -->
				{#if block.relayParentNumber !== undefined}
					<div class="mt-1 text-sm text-green-600">
						<div>🔗 Based on relay block: #{block.relayParentNumber}</div>
						<div class="text-xs text-gray-500">
							Relay Block Hash: {block.relayParentHash}
						</div>
					</div>
				{/if}

				<!-- Relay Chain Inclusion/Backing Information -->
				{#if block.relayIncludedAt !== undefined || block.relayBackedAt !== undefined}
					<div class="mt-1 text-sm text-blue-600">
						{#if block.relayIncludedAt !== undefined}
							<div>📦 Included in relay block: #{block.relayIncludedAt}</div>
						{/if}
						{#if block.relayBackedAt !== undefined}
							<div>✅ Backed in relay block: #{block.relayBackedAt}</div>
						{/if}
					</div>
				{/if}

				<div class="mt-1 text-xs break-all text-gray-500">Hash: {block.hash}</div>
			</div>
		</div>
	{/each}
</div>

import { type BlockHeader } from 'polkadot-api';
import type { SystemEvent } from '@polkadot-api/observable-client';
import type { ParachainInclusionInfo } from '$lib/services/relayChainParser';

export type BlockDisplay = {
	number: number;
	events: SystemEvent[];
	author: string | null;
	absoluteSlot: number;
	collatorSlot: number;
	hash: string;
	header: BlockHeader;
	timestamp?: number;
	relayIncludedAtNumber?: number;
	relayIncludedAtHash?: string;
	relayIncludedAtTimestamp?: number;
	relayBackedAtNumber?: number;
	relayBackedAtHash?: string;
	relayBackedAtTimestamp?: number;
	relayParentHash?: string;
	relayParentNumber?: number;
	relayParentTimestamp?: number;
	relayParentStateRoot?: string;
};

export function updateBlockDisplay(
	base: BlockDisplay,
	update: ParachainInclusionInfo
): BlockDisplay {
	switch (update.eventType) {
		case 'backed':
			return {
				...base,
				relayBackedAtNumber: update.relayBlockNumber ?? base.relayBackedAtNumber,
				relayBackedAtHash: update.relayBlockHash ?? base.relayBackedAtHash,
				relayBackedAtTimestamp: update.relayBlockTimestamp ?? base.relayBackedAtTimestamp
			};
		case 'included':
			return {
				...base,
				relayIncludedAtNumber: update.relayBlockNumber ?? base.relayIncludedAtNumber,
				relayIncludedAtHash: update.relayBlockHash ?? base.relayIncludedAtHash,
				relayIncludedAtTimestamp: update.relayBlockTimestamp ?? base.relayIncludedAtTimestamp
			};
	}
}

export function mergeBlockDisplay(base: BlockDisplay, update: BlockDisplay): BlockDisplay {
	// Update any potentially undefined thing, but as the update could have undefined SET, then we have to check.
	return {
		...base,
		timestamp: update.timestamp ?? base.timestamp,
		relayIncludedAtNumber: update.relayIncludedAtNumber ?? base.relayIncludedAtNumber,
		relayIncludedAtHash: update.relayIncludedAtHash ?? base.relayIncludedAtHash,
		relayIncludedAtTimestamp: update.relayIncludedAtTimestamp ?? base.relayIncludedAtTimestamp,
		relayBackedAtNumber: update.relayBackedAtNumber ?? base.relayBackedAtNumber,
		relayBackedAtHash: update.relayBackedAtHash ?? base.relayBackedAtHash,
		relayBackedAtTimestamp: update.relayBackedAtTimestamp ?? base.relayBackedAtTimestamp,
		relayParentHash: update.relayParentHash ?? base.relayParentHash,
		relayParentNumber: update.relayParentNumber ?? base.relayParentNumber,
		relayParentTimestamp: update.relayParentTimestamp ?? base.relayParentTimestamp,
		relayParentStateRoot: update.relayParentStateRoot ?? base.relayParentStateRoot
	};
}

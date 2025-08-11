/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PolkadotClient } from 'polkadot-api';
import type { SystemEvent } from '@polkadot-api/observable-client';

export interface ParachainInclusionInfo {
	paraId: number;
	blockHash: string;
	relayBlockHash: string;
	relayBlockNumber: number;
	eventType: 'included' | 'backed';
	candidateReceipt: any;
}

export interface ParachainBlockUpdate {
	blockHash: string;
	relayIncludedAtNumber?: number;
	relayIncludedAtHash?: string;
	relayIncludedAtTimestamp?: number;
	relayBackedAtNumber?: number;
	relayBackedAtHash?: string;
	relayBackedAtTimestamp?: number;
}

/**
 * Parse relay chain events to extract parachain inclusion/backing information
 */
export async function parseRelayChainEvents(
	relayClient: PolkadotClient,
	relayBlock: { hash: string; number: number }
): Promise<ParachainInclusionInfo[]> {
	try {
		const events = (await relayClient
			.getUnsafeApi()
			.query.System.Events.getValue({ at: relayBlock.hash })) as unknown as SystemEvent[];

		return events
			.map((event) => parseParaInclusionEvent(event, relayBlock.number, relayBlock.hash))
			.filter((info): info is ParachainInclusionInfo => info !== null);
	} catch (error) {
		console.warn('Failed to parse relay chain events:', error);
		return [];
	}
}

/**
 * Parse ParaInclusion pallet events
 */
function parseParaInclusionEvent(
	eventData: SystemEvent,
	relayBlockNumber: number,
	relayBlockHash: string
): ParachainInclusionInfo | null {
	if (eventData.event.type !== 'ParaInclusion') {
		return null;
	}

	const isIncluded = eventData.event.value.type === 'CandidateIncluded';
	const isBacked = eventData.event.value.type === 'CandidateBacked';

	if (!isIncluded && !isBacked) return null;

	const candidateReceipt = eventData.event.value.value[0].descriptor;
	const paraId = candidateReceipt.para_id;
	if (!paraId) return null;

	return {
		paraId: normalizeParaId(paraId),
		blockHash: candidateReceipt.para_head.asHex(),
		relayBlockHash,
		relayBlockNumber,
		eventType: isIncluded ? 'included' : 'backed',
		candidateReceipt
	};
}

/**
 * Normalize paraId to a number regardless of input format
 */
function normalizeParaId(paraId: any): number {
	if (typeof paraId === 'number') return paraId;
	if (typeof paraId === 'object' && paraId !== null) {
		return paraId.value || paraId.toNumber?.() || parseInt(paraId.toString());
	}
	return parseInt(paraId);
}

/**
 * Create parachain block updates from inclusion information
 */
export function createParachainBlockUpdates(
	inclusionInfos: ParachainInclusionInfo[],
	targetParachainId: number,
	getRelayTimestamp: (hash: string) => number | undefined = () => undefined
): Map<string, ParachainBlockUpdate> {
	const updates = new Map<string, ParachainBlockUpdate>();

	const relevantInfos = inclusionInfos.filter(
		(info) => info.paraId === targetParachainId && info.blockHash
	);

	for (const info of relevantInfos) {
		const blockHash = info.blockHash!;
		const existing = updates.get(blockHash) || { blockHash };

		if (info.eventType === 'included') {
			existing.relayIncludedAtNumber = info.relayBlockNumber;
			existing.relayIncludedAtHash = info.relayBlockHash;
			existing.relayIncludedAtTimestamp = getRelayTimestamp(info.relayBlockHash);
		} else if (info.eventType === 'backed') {
			existing.relayBackedAtNumber = info.relayBlockNumber;
			existing.relayBackedAtHash = info.relayBlockHash;
			existing.relayBackedAtTimestamp = getRelayTimestamp(info.relayBlockHash);
		}

		updates.set(blockHash, existing);
	}

	return updates;
}

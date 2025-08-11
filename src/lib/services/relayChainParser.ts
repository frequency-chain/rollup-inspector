import type { PolkadotClient } from 'polkadot-api';
import type { SystemEvent } from '@polkadot-api/observable-client';

/**
 * Represents a parachain ID that can be in various formats
 */
export type ParachainIdValue = number | { value?: number; toNumber?: () => number } | string;

/**
 * Represents a hash that can be in various formats from Polkadot-API
 */
export interface PolkadotHash {
	asHex(): string;
	toString(): string;
}

/**
 * Candidate receipt descriptor from ParaInclusion events
 */
export interface CandidateDescriptor {
	para_id: ParachainIdValue;
	para_head: PolkadotHash;
	relay_parent: PolkadotHash;
}

/**
 * Candidate receipt from ParaInclusion events
 */
export interface CandidateReceipt {
	descriptor: CandidateDescriptor;
}

/**
 * Information about parachain inclusion/backing events
 */
export interface ParachainInclusionInfo {
	paraId: number;
	blockHash: string;
	relayBlockHash: string;
	relayBlockNumber: number;
	relayBlockTimestamp?: number;
	eventType: 'included' | 'backed';
	candidateReceipt: CandidateReceipt;
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
	relayBlock: { hash: string; number: number; timestamp?: number }
): Promise<ParachainInclusionInfo[]> {
	try {
		const events = (await relayClient
			.getUnsafeApi()
			.query.System.Events.getValue({ at: relayBlock.hash })) as unknown as SystemEvent[];

		return events
			.map((event) => parseParaInclusionEvent(event, relayBlock.number, relayBlock.hash, relayBlock.timestamp))
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
	relayBlockHash: string,
	relayBlockTimestamp?: number
): ParachainInclusionInfo | null {
	if (eventData.event.type !== 'ParaInclusion') {
		return null;
	}

	const isIncluded = eventData.event.value.type === 'CandidateIncluded';
	const isBacked = eventData.event.value.type === 'CandidateBacked';

	if (!isIncluded && !isBacked) return null;

	const candidateReceipt = eventData.event.value.value[0] as CandidateReceipt;
	const descriptor = candidateReceipt.descriptor;
	const paraId = descriptor.para_id;
	if (!paraId) return null;

	return {
		paraId: normalizeParaId(paraId),
		blockHash: descriptor.para_head.asHex(),
		relayBlockHash,
		relayBlockNumber,
		relayBlockTimestamp,
		eventType: isIncluded ? 'included' : 'backed',
		candidateReceipt
	};
}

/**
 * Normalize paraId to a number regardless of input format
 */
function normalizeParaId(paraId: ParachainIdValue): number {
	if (typeof paraId === 'number') return paraId;
	if (typeof paraId === 'string') return parseInt(paraId, 10);
	if (typeof paraId === 'object' && paraId !== null) {
		if ('value' in paraId && typeof paraId.value === 'number') {
			return paraId.value;
		}
		if ('toNumber' in paraId && typeof paraId.toNumber === 'function') {
			return paraId.toNumber();
		}
		return parseInt(paraId.toString(), 10);
	}
	throw new Error(`Unable to normalize parachain ID: ${paraId}`);
}

/**
 * Create parachain block updates from inclusion information
 */
export function createParachainBlockUpdates(
	inclusionInfos: ParachainInclusionInfo[],
	targetParachainId: number
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
			existing.relayIncludedAtTimestamp = info.relayBlockTimestamp;
		} else if (info.eventType === 'backed') {
			existing.relayBackedAtNumber = info.relayBlockNumber;
			existing.relayBackedAtHash = info.relayBlockHash;
			existing.relayBackedAtTimestamp = info.relayBlockTimestamp;
		}

		updates.set(blockHash, existing);
	}

	return updates;
}

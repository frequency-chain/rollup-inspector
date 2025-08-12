import Loki, { type Collection } from 'lokijs';
import type { PolkadotClient } from 'polkadot-api';
import { getExtrinsicDecoder, type DecodedExtrinsic } from '@polkadot-api/tx-utils';
import { extractTimestampFromExtrinsics } from '$lib/utils/timestampExtractor';
import type { BlockInfo } from 'polkadot-api';
import { Subject } from 'rxjs';
import { parseRelayChainEvents, type ParachainInclusionInfo } from './relayChainParser';

// Make Resultset.disableFreeze a property with getter that returns Collection.disableFreeze property value. https://github.com/techfort/LokiJS/pull/918
if (
	!(
		'disableFreeze' in
		(Loki as unknown as { Resultset: { prototype: { disableFreeze: boolean } } }).Resultset
			.prototype
	)
) {
	Object.defineProperty(
		(Loki as unknown as { Resultset: { prototype: { disableFreeze: boolean } } }).Resultset
			.prototype,
		'disableFreeze',
		{
			get() {
				return this.collection.disableFreeze;
			}
		}
	);
}

/**
 * Relay block document in LokiJS
 */
export interface RelayBlockDoc extends BlockInfo {
	hash: string;
	number: number;
	stateRoot?: string;
	timestamp?: number;
	createdAt: number;
	extrinsics: DecodedExtrinsic[];
	isFinalized?: boolean;
}

/**
 * Singleton relay block manager using LokiJS
 */
let relayBlockManager: {
	readonly db: Loki;
	readonly collection: Collection<RelayBlockDoc>;
	relayClient?: PolkadotClient;
} | null = null;

/**
 * Subject for streaming parachain block updates for a specific parachain
 */
const parachainUpdatesSubject = new Subject<{
	parachainId: number;
	update: ParachainInclusionInfo;
}>();

/**
 * Subject for streaming relay block state root mappings
 */
const relayBlockMappingSubject = new Subject<{
	stateRoot: string;
	hash: string;
	number: number;
	timestamp?: number;
}>();

/**
 * Subject for streaming relay block finalization updates
 */
const relayBlockFinalizationSubject = new Subject<{
	hash: string;
	number: number;
	isFinalized: boolean;
}>();

/**
 * Initialize the singleton relay block manager
 */
function initializeRelayBlockManager(maxAge: number = 3600000) {
	if (relayBlockManager) return relayBlockManager;

	const db = new Loki('relayBlocks');

	const collection = db.addCollection<RelayBlockDoc>('blocks', {
		indices: ['hash', 'number', 'stateRoot'],
		ttl: maxAge, // Auto-cleanup after 1 hour by default
		ttlInterval: 60000, // Check for cleanup every minute
		disableFreeze: true,
		clone: false // Mutate for speed
	});

	relayBlockManager = { db, collection };
	return relayBlockManager;
}

/**
 * Get the singleton relay block manager (initializes if needed)
 */
function getRelayBlockManager() {
	if (!relayBlockManager) {
		initializeRelayBlockManager();
	}
	return relayBlockManager!;
}

/**
 * Add a relay block to the manager (private)
 */
function addRelayBlock(block: Omit<RelayBlockDoc, 'createdAt'>): void {
	const manager = getRelayBlockManager();

	// Remove existing block with same hash to avoid duplicates
	manager.collection.findAndRemove({ hash: block.hash });

	// Add new block with timestamp
	manager.collection.insert({
		...block,
		createdAt: Date.now()
	});

	// Keep only latest 1000 blocks if no TTL cleanup
	const count = manager.collection.count();
	if (count > 1000) {
		const oldestBlocks = manager.collection
			.chain()
			.simplesort('number')
			.limit(count - 800) // Keep 800 to avoid frequent cleanup
			.data();

		manager.collection.remove(oldestBlocks);
	}
}

/**
 * Get relay block by hash
 */
export function getRelayBlockByHash(hash: string): RelayBlockDoc | null {
	const manager = getRelayBlockManager();
	return manager.collection.findOne({ hash });
}

/**
 * Get relay block by number
 */
export function getRelayBlockByNumber(number: number): RelayBlockDoc | null {
	const manager = getRelayBlockManager();
	return manager.collection.findOne({ number });
}

/**
 * Get relay block by state root
 */
export function getRelayBlockByStateRoot(stateRoot: string): RelayBlockDoc | null {
	const manager = getRelayBlockManager();
	return manager.collection.findOne({ stateRoot });
}

/**
 * Get relay block timestamp by hash
 */
export function getRelayBlockTimestamp(hash: string): number | undefined {
	const block = getRelayBlockByHash(hash);
	return block?.timestamp;
}

/**
 * Get all relay blocks (for debugging)
 */
export function getAllRelayBlocks(): RelayBlockDoc[] {
	const manager = getRelayBlockManager();
	return manager.collection.find();
}

/**
 * Get relay block count
 */
export function getRelayBlockCount(): number {
	const manager = getRelayBlockManager();
	return manager.collection.count();
}

/**
 * Clear all relay block data (useful when switching chains)
 */
export function clearAllRelayBlocks(): void {
	const manager = getRelayBlockManager();
	manager.collection.clear();
	console.log('Cleared all relay block data');
}

/**
 * Process a new relay block from the chain and add it to manager
 */
export async function processAndAddRelayBlock(
	relayClient: PolkadotClient,
	blockInfo: BlockInfo
): Promise<RelayBlockDoc | null> {
	try {
		// Get block header
		const [header, blockBody, extrinsicDecoder] = await Promise.all([
			relayClient.getBlockHeader(blockInfo.hash),
			relayClient.getBlockBody(blockInfo.hash),
			relayClient
				.getUnsafeApi()
				.apis.Metadata.metadata()
				.then((x) => getExtrinsicDecoder(x.asBytes()))
		]);

		const extrinsics = blockBody.map(extrinsicDecoder);

		// Extract timestamp
		const timestamp = extractTimestampFromExtrinsics(extrinsics) || undefined;

		addRelayBlock({
			...blockInfo,
			stateRoot: header.stateRoot || undefined,
			timestamp,
			extrinsics
		});

		// Emit state root mapping for parachain blocks that need relay parent info
		if (header.stateRoot) {
			relayBlockMappingSubject.next({
				stateRoot: header.stateRoot,
				hash: blockInfo.hash,
				number: blockInfo.number,
				timestamp
			});
		}

		// Process relay block for parachain updates
		await processRelayBlockForParachainUpdates(relayClient, blockInfo);

		return getRelayBlockByHash(blockInfo.hash);
	} catch (error) {
		console.warn('Failed to process relay block:', blockInfo.hash, error);
		return null;
	}
}

/**
 * Start listening to relay chain blocks
 */
export function startRelayBlockManager(relayClient: PolkadotClient): () => void {
	const manager = getRelayBlockManager();
	manager.relayClient = relayClient;

	const subscription = relayClient.blocks$.subscribe(async (block) => {
		try {
			await processAndAddRelayBlock(relayClient, block);
		} catch (error) {
			console.warn('Error processing relay block:', error);
		}
	});

	// Subscribe to finalized blocks to track finalization
	const finalizedSubscription = relayClient.finalizedBlock$.subscribe((finalizedBlock) => {
		try {
			// Update the block in the collection
			getRelayBlockManager().collection.findAndUpdate({ hash: finalizedBlock.hash }, (doc) => {
				doc.isFinalized = true;
			});
			// Emit finalization update
			relayBlockFinalizationSubject.next({
				hash: finalizedBlock.hash,
				number: finalizedBlock.number,
				isFinalized: true
			});
		} catch (error) {
			console.warn('Error processing finalized relay block:', error);
		}
	});

	return () => {
		subscription?.unsubscribe();
		finalizedSubscription?.unsubscribe();
		manager.relayClient = undefined;
	};
}

/**
 * Process relay block for parachain updates
 */
async function processRelayBlockForParachainUpdates(
	relayClient: PolkadotClient,
	blockInfo: BlockInfo
) {
	try {
		const relayBlockWithTimestamp = {
			hash: blockInfo.hash,
			number: blockInfo.number,
			timestamp: getRelayBlockTimestamp(blockInfo.hash)
		};

		// Parse relay chain events to find parachain inclusions/backings
		const inclusionInfos = await parseRelayChainEvents(relayClient, relayBlockWithTimestamp);

		// Group inclusion infos by parachain ID
		const infosByParachain = new Map<number, ParachainInclusionInfo[]>();
		for (const info of inclusionInfos) {
			const existing = infosByParachain.get(info.paraId) || [];
			existing.push(info);
			infosByParachain.set(info.paraId, existing);
		}

		// Create block updates for each parachain found in this relay block
		for (const [parachainId, infos] of infosByParachain) {
			infos.forEach((update) => parachainUpdatesSubject.next({ parachainId, update }));
		}
	} catch (error) {
		console.warn('Failed to process relay block for parachain updates:', error);
	}
}

/**
 * Get the parachain updates stream
 */
export function getParachainUpdatesStream() {
	return parachainUpdatesSubject.asObservable();
}

/**
 * Get the relay block mapping stream (state root -> relay block info)
 */
export function getRelayBlockMappingStream() {
	return relayBlockMappingSubject.asObservable();
}

/**
 * Get the relay block finalization stream
 */
export function getRelayBlockFinalizationStream() {
	return relayBlockFinalizationSubject.asObservable();
}

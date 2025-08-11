import Loki, { type Collection } from 'lokijs';
import type { PolkadotClient } from 'polkadot-api';
import { getExtrinsicDecoder } from '@polkadot-api/tx-utils';
import { extractTimestampFromExtrinsics } from '$lib/utils/timestampExtractor';

/**
 * Relay block document in LokiJS
 */
export interface RelayBlockDoc {
	hash: string;
	number: number;
	stateRoot?: string;
	timestamp?: number;
	createdAt: number;
}

/**
 * Singleton relay block manager using LokiJS
 */
let relayBlockManager: {
	readonly db: Loki;
	readonly collection: Collection<RelayBlockDoc>;
} | null = null;

/**
 * Initialize the singleton relay block manager
 */
function initializeRelayBlockManager(maxAge: number = 3600000) {
	if (relayBlockManager) return relayBlockManager;

	const db = new Loki('relayBlocks');

	const collection = db.addCollection<RelayBlockDoc>('blocks', {
		indices: ['hash', 'number', 'stateRoot'],
		ttl: maxAge, // Auto-cleanup after 1 hour by default
		ttlInterval: 60000 // Check for cleanup every minute
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
 * Add a relay block to the manager
 */
export function addRelayBlock(block: Omit<RelayBlockDoc, 'createdAt'>): void {
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
	client: PolkadotClient,
	blockInfo: { hash: string; number: number }
): Promise<RelayBlockDoc | null> {
	try {
		// Get block header
		const header = await client.getBlockHeader(blockInfo.hash);

		// Extract timestamp
		let timestamp: number | undefined;
		try {
			const blockBodyHex = await client.getBlockBody(blockInfo.hash);
			if (blockBodyHex && Array.isArray(blockBodyHex)) {
				const metadata = await client.getUnsafeApi().apis.Metadata.metadata();
				const extrinsicDecoder = getExtrinsicDecoder(metadata.asBytes());

				const extrinsics = blockBodyHex
					.map((extHex: string) => {
						try {
							return extrinsicDecoder(extHex);
						} catch {
							return null;
						}
					})
					.filter((x) => x !== null);

				timestamp = extractTimestampFromExtrinsics(extrinsics) || undefined;
			}
		} catch (err) {
			console.warn('Could not extract timestamp from relay block:', blockInfo.hash, err);
		}

		const blockData: Omit<RelayBlockDoc, 'createdAt'> = {
			hash: blockInfo.hash,
			number: blockInfo.number,
			stateRoot: header.stateRoot || undefined,
			timestamp
		};

		addRelayBlock(blockData);
		return getRelayBlockByHash(blockInfo.hash);
	} catch (error) {
		console.warn('Failed to process relay block:', blockInfo.hash, error);
		return null;
	}
}

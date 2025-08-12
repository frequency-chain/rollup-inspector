import { describe, it, expect, vi } from 'vitest';
import {
	getRelayBlockByHash,
	getRelayBlockByNumber,
	getAllRelayBlocks,
	getRelayBlockCount,
	processAndAddRelayBlock
} from './relayBlockManager';

// Create a minimal mock PolkadotClient
const createMockClient = () => ({
	getBlockHeader: vi.fn().mockResolvedValue({ stateRoot: '0xstateroot123' }),
	getBlockBody: vi.fn().mockResolvedValue(['0x1234']), // Mock hex-encoded extrinsics
	getUnsafeApi: vi.fn().mockReturnValue({
		apis: {
			Metadata: {
				metadata: vi.fn().mockResolvedValue({
					asBytes: () => {
						// Create a minimal valid metadata bytes array
						// This is just enough to prevent the decoder from crashing
						const mockMetadata = new Uint8Array(100);
						mockMetadata[0] = 0x6d; // 'm' - metadata magic number
						return mockMetadata;
					}
				})
			}
		},
		query: {
			System: {
				Events: {
					getValue: vi.fn().mockResolvedValue([])
				}
			}
		}
	})
});

// Mock the extrinsic decoder to prevent metadata parsing issues
vi.mock('@polkadot-api/tx-utils', async () => {
	const actual = await vi.importActual('@polkadot-api/tx-utils');
	return {
		...actual,
		getExtrinsicDecoder: vi.fn(() => (hexString: string) => ({
			call: null,
			signature: null,
			version: 4
		}))
	};
});

// Mock the relay chain parser to prevent parsing issues in tests
vi.mock('./relayChainParser', () => ({
	parseRelayChainEvents: vi.fn().mockResolvedValue([]),
	createParachainBlockUpdates: vi.fn().mockReturnValue([])
}));

describe('relayBlockManager', () => {
	describe('basic functionality', () => {
		it('returns null for non-existent hash', () => {
			const result = getRelayBlockByHash('0xnonexistent123');
			expect(result).toBeNull();
		});

		it('can process and retrieve relay blocks', async () => {
			const mockClient = createMockClient() as any;
			const blockInfo = {
				hash: '0x1234test',
				number: 1000,
				parent: '0xparent123'
			};

			const result = await processAndAddRelayBlock(mockClient, blockInfo);
			expect(result).toBeTruthy();

			const retrieved = getRelayBlockByHash('0x1234test');
			expect(retrieved).toBeTruthy();
			expect(retrieved?.hash).toBe(blockInfo.hash);
			expect(retrieved?.number).toBe(blockInfo.number);
		});

		it('can retrieve blocks by number', async () => {
			const mockClient = createMockClient() as any;
			const blockInfo = {
				hash: '0x5678test',
				number: 2000,
				parent: '0xparent456'
			};

			const result = await processAndAddRelayBlock(mockClient, blockInfo);
			expect(result).toBeTruthy();

			const retrieved = getRelayBlockByNumber(2000);
			expect(retrieved).toBeTruthy();
			expect(retrieved?.hash).toBe(blockInfo.hash);
		});

		it('getAllRelayBlocks returns array', () => {
			const blocks = getAllRelayBlocks();
			expect(Array.isArray(blocks)).toBe(true);
		});

		it('getRelayBlockCount returns number', () => {
			const count = getRelayBlockCount();
			expect(typeof count).toBe('number');
			expect(count).toBeGreaterThanOrEqual(0);
		});
	});
});

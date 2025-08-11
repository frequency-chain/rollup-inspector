import { describe, it, expect, vi } from 'vitest';
import {
	addRelayBlock,
	getRelayBlockByHash,
	getRelayBlockByNumber,
	getAllRelayBlocks,
	getRelayBlockCount
} from './relayBlockManager';

describe('relayBlockManager', () => {
	describe('basic functionality', () => {
		it('can add and retrieve relay blocks', () => {
			const block = {
				hash: '0x1234test',
				number: 1000,
				timestamp: Date.now()
			};

			addRelayBlock(block);
			const retrieved = getRelayBlockByHash('0x1234test');

			expect(retrieved).toBeTruthy();
			expect(retrieved?.hash).toBe(block.hash);
			expect(retrieved?.number).toBe(block.number);
		});

		it('returns null for non-existent hash', () => {
			const result = getRelayBlockByHash('0xnonexistent123');
			expect(result).toBeNull();
		});

		it('can retrieve blocks by number', () => {
			const block = {
				hash: '0x5678test',
				number: 2000,
				timestamp: Date.now()
			};

			addRelayBlock(block);
			const retrieved = getRelayBlockByNumber(2000);

			expect(retrieved).toBeTruthy();
			expect(retrieved?.hash).toBe(block.hash);
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

import { describe, it, expect } from 'vitest';

describe('Fork Detection Logic', () => {
	// Mock block data structure similar to what's used in the app
	interface MockBlockDisplay {
		hash: string;
		number: number;
		absoluteSlot?: number;
		collatorSlot?: number;
		relayParentHash?: string;
		author?: string;
		timestamp?: number;
		events: any[];
	}

	// Utility functions for fork detection (extracted from component logic)
	const groupBlocksBySlot = (blocks: MockBlockDisplay[]) => {
		const groups = new Map<number, MockBlockDisplay[]>();
		for (const block of blocks) {
			if (block.absoluteSlot !== undefined) {
				const existing = groups.get(block.absoluteSlot) || [];
				existing.push(block);
				groups.set(block.absoluteSlot, existing);
			}
		}
		return groups;
	};

	const detectExpectedForks = (slotGroups: Map<number, MockBlockDisplay[]>) => {
		const forks: MockBlockDisplay[][] = [];
		for (const group of slotGroups.values()) {
			if (group.length > 1) {
				const relayParentHashes = new Set(group.map((b) => b.relayParentHash).filter((h) => h));
				if (relayParentHashes.size > 1) {
					forks.push(group);
				}
			}
		}
		return forks;
	};

	const detectUnexpectedForks = (
		blocks: MockBlockDisplay[],
		slotGroups: Map<number, MockBlockDisplay[]>
	) => {
		const unexpected: MockBlockDisplay[] = [];

		// Add blocks without slot information
		const ungrouped = blocks.filter((block) => block.absoluteSlot === undefined);
		unexpected.push(...ungrouped);

		// Check slot groups for unexpected forks
		for (const group of slotGroups.values()) {
			if (group.length === 1) {
				unexpected.push(...group);
			} else if (group.length > 1) {
				const relayParentHashes = new Set(group.map((b) => b.relayParentHash).filter((h) => h));
				if (relayParentHashes.size <= 1) {
					unexpected.push(...group);
				}
			}
		}
		return unexpected;
	};

	const shouldShowForkWarning = (slotGroups: Map<number, MockBlockDisplay[]>) => {
		return slotGroups.size > 1;
	};

	describe('slot grouping', () => {
		it('groups blocks by absolute slot', () => {
			const blocks: MockBlockDisplay[] = [
				{ hash: '0x1', number: 100, absoluteSlot: 1000, events: [] },
				{ hash: '0x2', number: 100, absoluteSlot: 1000, events: [] },
				{ hash: '0x3', number: 101, absoluteSlot: 1001, events: [] }
			];

			const groups = groupBlocksBySlot(blocks);
			expect(groups.size).toBe(2);
			expect(groups.get(1000)).toHaveLength(2);
			expect(groups.get(1001)).toHaveLength(1);
		});

		it('excludes blocks without slot information', () => {
			const blocks: MockBlockDisplay[] = [
				{ hash: '0x1', number: 100, absoluteSlot: 1000, events: [] },
				{ hash: '0x2', number: 101, events: [] } // No slot
			];

			const groups = groupBlocksBySlot(blocks);
			expect(groups.size).toBe(1);
			expect(groups.get(1000)).toHaveLength(1);
		});
	});

	describe('expected fork detection', () => {
		it('detects forks with different relay parent hashes', () => {
			const slotGroups = new Map([
				[
					1000,
					[
						{ hash: '0x1', number: 100, relayParentHash: '0xrelay1', events: [] },
						{ hash: '0x2', number: 100, relayParentHash: '0xrelay2', events: [] }
					]
				]
			]);

			const expectedForks = detectExpectedForks(slotGroups);
			expect(expectedForks).toHaveLength(1);
			expect(expectedForks[0]).toHaveLength(2);
		});

		it('does not detect forks with same relay parent hash', () => {
			const slotGroups = new Map([
				[
					1000,
					[
						{ hash: '0x1', number: 100, relayParentHash: '0xrelay1', events: [] },
						{ hash: '0x2', number: 100, relayParentHash: '0xrelay1', events: [] }
					]
				]
			]);

			const expectedForks = detectExpectedForks(slotGroups);
			expect(expectedForks).toHaveLength(0);
		});

		it('ignores single blocks in slot', () => {
			const slotGroups = new Map([
				[1000, [{ hash: '0x1', number: 100, relayParentHash: '0xrelay1', events: [] }]]
			]);

			const expectedForks = detectExpectedForks(slotGroups);
			expect(expectedForks).toHaveLength(0);
		});
	});

	describe('unexpected fork detection', () => {
		it('identifies blocks with same relay parent as unexpected', () => {
			const blocks: MockBlockDisplay[] = [
				{ hash: '0x1', number: 100, absoluteSlot: 1000, relayParentHash: '0xrelay1', events: [] },
				{ hash: '0x2', number: 100, absoluteSlot: 1000, relayParentHash: '0xrelay1', events: [] }
			];
			const slotGroups = groupBlocksBySlot(blocks);

			const unexpectedForks = detectUnexpectedForks(blocks, slotGroups);
			expect(unexpectedForks).toHaveLength(2);
		});

		it('identifies blocks without slot as unexpected', () => {
			const blocks: MockBlockDisplay[] = [
				{ hash: '0x1', number: 100, events: [] }, // No slot
				{ hash: '0x2', number: 101, absoluteSlot: 1000, events: [] }
			];
			const slotGroups = groupBlocksBySlot(blocks);

			const unexpectedForks = detectUnexpectedForks(blocks, slotGroups);
			expect(unexpectedForks).toContain(blocks[0]);
		});

		it('does not flag expected forks as unexpected', () => {
			const blocks: MockBlockDisplay[] = [
				{ hash: '0x1', number: 100, absoluteSlot: 1000, relayParentHash: '0xrelay1', events: [] },
				{ hash: '0x2', number: 100, absoluteSlot: 1000, relayParentHash: '0xrelay2', events: [] }
			];
			const slotGroups = groupBlocksBySlot(blocks);

			const unexpectedForks = detectUnexpectedForks(blocks, slotGroups);
			expect(unexpectedForks).toHaveLength(0);
		});
	});

	describe('fork warning logic', () => {
		it('shows warning when multiple slot groups exist', () => {
			const slotGroups = new Map([
				[1000, [{ hash: '0x1', number: 100, events: [] }]],
				[1001, [{ hash: '0x2', number: 101, events: [] }]]
			]);

			expect(shouldShowForkWarning(slotGroups)).toBe(true);
		});

		it('does not show warning for single slot group', () => {
			const slotGroups = new Map([
				[
					1000,
					[
						{ hash: '0x1', number: 100, events: [] },
						{ hash: '0x2', number: 100, events: [] }
					]
				]
			]);

			expect(shouldShowForkWarning(slotGroups)).toBe(false);
		});

		it('does not show warning for empty slots', () => {
			const slotGroups = new Map();
			expect(shouldShowForkWarning(slotGroups)).toBe(false);
		});
	});

	describe('complex fork scenarios', () => {
		it('handles mixed fork types in same block', () => {
			const blocks: MockBlockDisplay[] = [
				// Slot 1000: Expected fork (different relay parents)
				{ hash: '0x1', number: 100, absoluteSlot: 1000, relayParentHash: '0xrelay1', events: [] },
				{ hash: '0x2', number: 100, absoluteSlot: 1000, relayParentHash: '0xrelay2', events: [] },
				// Slot 1001: Unexpected fork (same relay parent)
				{ hash: '0x3', number: 100, absoluteSlot: 1001, relayParentHash: '0xrelay1', events: [] },
				{ hash: '0x4', number: 100, absoluteSlot: 1001, relayParentHash: '0xrelay1', events: [] },
				// No slot: Unexpected
				{ hash: '0x5', number: 100, events: [] }
			];

			const slotGroups = groupBlocksBySlot(blocks);
			const expectedForks = detectExpectedForks(slotGroups);
			const unexpectedForks = detectUnexpectedForks(blocks, slotGroups);

			expect(expectedForks).toHaveLength(1);
			expect(expectedForks[0]).toHaveLength(2); // Slot 1000 blocks

			expect(unexpectedForks).toHaveLength(3); // Slot 1001 blocks + no-slot block
			expect(shouldShowForkWarning(slotGroups)).toBe(true);
		});
	});
});

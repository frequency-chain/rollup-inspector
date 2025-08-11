import { describe, it, expect } from 'vitest';
import {
	timestampToISO,
	getTimeDifferenceInSeconds,
	formatTimeDifference,
	extractTimestampFromExtrinsics
} from './timestampExtractor';

describe('timestampExtractor utilities', () => {
	describe('timestampToISO', () => {
		it('converts timestamp to ISO string', () => {
			const timestamp = 1640995200000; // 2022-01-01T00:00:00.000Z
			const result = timestampToISO(timestamp);
			expect(result).toBe('2022-01-01T00:00:00.000Z');
		});
	});

	describe('getTimeDifferenceInSeconds', () => {
		it('calculates time difference in seconds', () => {
			const later = 1640995260000; // +60 seconds
			const earlier = 1640995200000;
			const result = getTimeDifferenceInSeconds(later, earlier);
			expect(result).toBe(60);
		});

		it('returns 0 for same timestamps', () => {
			const timestamp = 1640995200000;
			const result = getTimeDifferenceInSeconds(timestamp, timestamp);
			expect(result).toBe(0);
		});
	});

	describe('formatTimeDifference', () => {
		it('formats seconds correctly', () => {
			expect(formatTimeDifference(30)).toBe('+30.0s');
			expect(formatTimeDifference(0)).toBe('+0.0s');
		});

		it('formats with decimal precision', () => {
			expect(formatTimeDifference(90.5)).toBe('+90.5s');
			expect(formatTimeDifference(120.25)).toBe('+120.3s');
		});
	});

	describe('extractTimestampFromExtrinsics', () => {
		it('returns undefined for empty array', () => {
			const result = extractTimestampFromExtrinsics([]);
			expect(result).toBeUndefined();
		});

		it('returns undefined for array with no timestamp extrinsic', () => {
			const extrinsics = [
				{ call: { type: 'other' } },
				{ call: { type: 'balances' } }
			] as any[];
			const result = extractTimestampFromExtrinsics(extrinsics);
			expect(result).toBeUndefined();
		});

		it('extracts timestamp from valid extrinsic', () => {
			const extrinsics = [
				{ call: { type: 'other' } },
				{
					call: {
						type: 'Timestamp',
						value: {
							type: 'set',
							value: {
								now: 1640995200000
							}
						}
					}
				}
			] as any[];
			const result = extractTimestampFromExtrinsics(extrinsics);
			expect(result).toBe(1640995200000);
		});
	});
});
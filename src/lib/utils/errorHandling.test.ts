import { describe, it, expect, vi } from 'vitest';

describe('Error Handling Utilities', () => {
	// Mock error handling utilities that would be useful for the application
	const safeExecute = async <T>(
		operation: () => Promise<T>,
		fallback: T,
		onError?: (error: any) => void
	): Promise<T> => {
		try {
			return await operation();
		} catch (error) {
			onError?.(error);
			return fallback;
		}
	};

	const safeJSONParse = <T>(jsonString: string, fallback: T): T => {
		try {
			return JSON.parse(jsonString);
		} catch {
			return fallback;
		}
	};

	const retryOperation = async <T>(
		operation: () => Promise<T>,
		maxRetries: number = 3,
		delay: number = 1000
	): Promise<T> => {
		let lastError: any;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				return await operation();
			} catch (error) {
				lastError = error;
				if (attempt < maxRetries) {
					await new Promise((resolve) => setTimeout(resolve, delay));
				}
			}
		}

		throw lastError;
	};

	const validateChainData = (chainData: any): boolean => {
		if (!chainData || typeof chainData !== 'object') return false;
		if (!chainData.id || typeof chainData.id !== 'string') return false;
		if (!chainData.display || typeof chainData.display !== 'string') return false;
		if (!chainData.rpcs || typeof chainData.rpcs !== 'object') return false;
		if (!chainData.nativeToken || typeof chainData.nativeToken !== 'object') return false;

		// Validate native token structure
		const { nativeToken } = chainData;
		if (!nativeToken.symbol || typeof nativeToken.symbol !== 'string') return false;
		if (typeof nativeToken.decimals !== 'number' || nativeToken.decimals < 0) return false;

		return true;
	};

	const sanitizeBlockHash = (hash: string): string => {
		if (!hash || typeof hash !== 'string') return '0x';

		// Remove whitespace and convert to lowercase
		const cleaned = hash.trim().toLowerCase();

		// Ensure it starts with 0x
		if (!cleaned.startsWith('0x')) {
			return '0x' + cleaned;
		}

		return cleaned;
	};

	describe('safeExecute', () => {
		it('returns result on successful execution', async () => {
			const operation = () => Promise.resolve('success');
			const result = await safeExecute(operation, 'fallback');
			expect(result).toBe('success');
		});

		it('returns fallback on error', async () => {
			const operation = () => Promise.reject(new Error('test error'));
			const result = await safeExecute(operation, 'fallback');
			expect(result).toBe('fallback');
		});

		it('calls error handler on error', async () => {
			const errorHandler = vi.fn();
			const operation = () => Promise.reject(new Error('test error'));

			await safeExecute(operation, 'fallback', errorHandler);
			expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
		});
	});

	describe('safeJSONParse', () => {
		it('parses valid JSON', () => {
			const result = safeJSONParse('{"key": "value"}', {});
			expect(result).toEqual({ key: 'value' });
		});

		it('returns fallback for invalid JSON', () => {
			const result = safeJSONParse('invalid json', { fallback: true });
			expect(result).toEqual({ fallback: true });
		});

		it('handles empty string', () => {
			const result = safeJSONParse('', null);
			expect(result).toBeNull();
		});
	});

	describe('retryOperation', () => {
		it('succeeds on first try', async () => {
			const operation = vi.fn().mockResolvedValue('success');
			const result = await retryOperation(operation, 3, 10);

			expect(result).toBe('success');
			expect(operation).toHaveBeenCalledTimes(1);
		});

		it('retries on failure then succeeds', async () => {
			const operation = vi
				.fn()
				.mockRejectedValueOnce(new Error('fail 1'))
				.mockRejectedValueOnce(new Error('fail 2'))
				.mockResolvedValueOnce('success');

			const result = await retryOperation(operation, 3, 10);

			expect(result).toBe('success');
			expect(operation).toHaveBeenCalledTimes(3);
		});

		it('throws after max retries', async () => {
			const operation = vi.fn().mockRejectedValue(new Error('persistent failure'));

			await expect(retryOperation(operation, 2, 10)).rejects.toThrow('persistent failure');
			expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
		});
	});

	describe('validateChainData', () => {
		const validChainData = {
			id: 'polkadot',
			display: 'Polkadot',
			rpcs: { Provider: 'wss://example.com' },
			nativeToken: { symbol: 'DOT', decimals: 10 }
		};

		it('validates correct chain data', () => {
			expect(validateChainData(validChainData)).toBe(true);
		});

		it('rejects null/undefined', () => {
			expect(validateChainData(null)).toBe(false);
			expect(validateChainData(undefined)).toBe(false);
		});

		it('rejects missing required fields', () => {
			expect(validateChainData({ ...validChainData, id: undefined })).toBe(false);
			expect(validateChainData({ ...validChainData, display: undefined })).toBe(false);
			expect(validateChainData({ ...validChainData, rpcs: undefined })).toBe(false);
			expect(validateChainData({ ...validChainData, nativeToken: undefined })).toBe(false);
		});

		it('validates native token structure', () => {
			expect(
				validateChainData({
					...validChainData,
					nativeToken: { symbol: 'DOT' } // Missing decimals
				})
			).toBe(false);

			expect(
				validateChainData({
					...validChainData,
					nativeToken: { decimals: 10 } // Missing symbol
				})
			).toBe(false);

			expect(
				validateChainData({
					...validChainData,
					nativeToken: { symbol: 'DOT', decimals: -1 } // Invalid decimals
				})
			).toBe(false);
		});
	});

	describe('sanitizeBlockHash', () => {
		it('cleans and formats valid hash', () => {
			expect(sanitizeBlockHash('  0X1234ABCD  ')).toBe('0x1234abcd');
			expect(sanitizeBlockHash('1234abcd')).toBe('0x1234abcd');
		});

		it('handles invalid inputs', () => {
			expect(sanitizeBlockHash('')).toBe('0x');
			expect(sanitizeBlockHash(null as any)).toBe('0x');
			expect(sanitizeBlockHash(undefined as any)).toBe('0x');
		});

		it('preserves existing 0x prefix', () => {
			expect(sanitizeBlockHash('0x1234abcd')).toBe('0x1234abcd');
		});
	});

	describe('network error scenarios', () => {
		const simulateNetworkError = (shouldFail: boolean) => {
			return shouldFail
				? Promise.reject(new Error('Network timeout'))
				: Promise.resolve({ data: 'success' });
		};

		it('handles network timeouts gracefully', async () => {
			const result = await safeExecute(() => simulateNetworkError(true), { data: 'cached' });

			expect(result).toEqual({ data: 'cached' });
		});

		it('recovers from transient network issues', async () => {
			let attempts = 0;
			const flakyOperation = () => {
				attempts++;
				return simulateNetworkError(attempts <= 2); // Fail first 2 attempts
			};

			const result = await retryOperation(flakyOperation, 3, 10);
			expect(result).toEqual({ data: 'success' });
		});
	});
});

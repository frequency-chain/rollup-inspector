import { startFromWorker } from 'polkadot-api/smoldot/from-worker';
import SmWorker from 'polkadot-api/smoldot/worker?worker';
import type { Client } from 'polkadot-api/smoldot';

class SmoldotService {
	private client: Client | null = null;
	private worker: Worker | null = null;

	/**
	 * Get or create the singleton smoldot client instance
	 */
	getClient(): Client {
		if (!this.client) {
			// Only create worker in browser environment
			if (typeof window !== 'undefined') {
				this.worker = new SmWorker();
				this.client = startFromWorker(this.worker);
			} else {
				throw new Error('Smoldot can only be initialized in browser environment');
			}
		}
		return this.client;
	}

	/**
	 * Terminate the smoldot client and worker
	 */
	terminate(): void {
		try {
			this.client?.terminate();
			this.worker?.terminate();
		} catch (err) {
			console.error('Error terminating smoldot:', err);
		} finally {
			this.client = null;
			this.worker = null;
		}
	}

	/**
	 * Check if smoldot is currently initialized
	 */
	isInitialized(): boolean {
		return this.client !== null;
	}

	/**
	 * Load persisted database for a specific chain
	 */
	loadChainDatabase(chainId: string): string | undefined {
		try {
			return localStorage.getItem(`smoldot-db-${chainId}`) || undefined;
		} catch (err) {
			console.warn(`Failed to load database for chain ${chainId}:`, err);
			return undefined;
		}
	}

	/**
	 * Save database state for a specific chain
	 */
	saveChainDatabase(chainId: string, database: string): void {
		try {
			localStorage.setItem(`smoldot-db-${chainId}`, database);
		} catch (err) {
			console.warn(`Failed to save database for chain ${chainId}:`, err);
			// If storage is full, clear old data and try again
			if ((err as { name: string }).name === 'QuotaExceededError') {
				localStorage.removeItem(`smoldot-db-${chainId}`);
				try {
					localStorage.setItem(`smoldot-db-${chainId}`, database);
				} catch (secondErr) {
					console.error(`Failed to save database for chain ${chainId} after clearing:`, secondErr);
				}
			}
		}
	}

	/**
	 * Clear persisted database for a specific chain
	 */
	clearChainDatabase(chainId: string): void {
		try {
			localStorage.removeItem(`smoldot-db-${chainId}`);
			console.log(`Database cleared for chain: ${chainId}`);
		} catch (err) {
			console.warn(`Failed to clear database for chain ${chainId}:`, err);
		}
	}
}

// Export singleton instance
export const smoldotService = new SmoldotService();

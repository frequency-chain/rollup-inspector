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
}

// Export singleton instance
export const smoldotService = new SmoldotService();

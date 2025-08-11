import type { DecodedExtrinsic } from '@polkadot-api/tx-utils';

/**
 * Extract timestamp from timestamp.set extrinsic in a block
 */
export function extractTimestampFromExtrinsics(extrinsics: DecodedExtrinsic[]): number | undefined {
	try {
		const timestampExtrinsic = extrinsics.find(
			(ext) => (ext.call?.type as string) === 'Timestamp' && ext.call?.value?.type === 'set'
		);

		if (timestampExtrinsic?.call?.value?.value?.now) {
			// The timestamp is in milliseconds
			return Number(timestampExtrinsic.call.value.value.now);
		}

		return undefined;
	} catch (error) {
		console.error('Could not extract timestamp from extrinsics:', error);
		return undefined;
	}
}

/**
 * Convert millisecond timestamp to ISO string
 */
export function timestampToISO(timestamp: number | null): string | null {
	if (!timestamp) return null;
	return new Date(timestamp).toISOString();
}

/**
 * Calculate time difference in seconds between two timestamps
 */
export function getTimeDifferenceInSeconds(laterMs: number, earlierMs: number): number {
	return (laterMs - earlierMs) / 1000;
}

/**
 * Format time difference for display (e.g., "+1.2s")
 */
export function formatTimeDifference(seconds: number): string {
	return `+${seconds.toFixed(1)}s`;
}

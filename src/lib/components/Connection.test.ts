import { describe, it, expect } from 'vitest';

// Test the logic that would be extracted from Connection component
describe('Connection Logic', () => {
	// Mock chain data similar to what's imported
	const mockPolkadotChains = [
		{
			id: 'polkadot',
			display: 'Polkadot Relay Chain',
			rpcs: {
				Allnodes: 'wss://polkadot-rpc.publicnode.com',
				Dwellir: 'wss://polkadot-rpc.dwellir.com'
			},
			nativeToken: { symbol: 'DOT', decimals: 10 }
		},
		{
			id: 'frequency',
			display: 'Frequency',
			relayChainInfo: { id: 'polkadot', parachain: 2091, isSystem: false },
			rpcs: {
				'Frequency 0': 'wss://0.rpc.frequency.xyz',
				'Frequency 1': 'wss://1.rpc.frequency.xyz'
			},
			nativeToken: { symbol: 'FRQCY', decimals: 8 }
		}
	];

	const mockKusamaChains = [
		{
			id: 'kusama',
			display: 'Kusama Relay Chain',
			rpcs: {
				Dwellir: 'wss://kusama-rpc.dwellir.com'
			},
			nativeToken: { symbol: 'KSM', decimals: 12 }
		}
	];

	// Utility functions extracted from component logic
	const getAllChains = () => [...mockPolkadotChains, ...mockKusamaChains];

	const getRelayChains = (allChains: any[]) => allChains.filter((chain) => !chain.relayChainInfo);

	const findSelectedRelayChain = (allChains: any[], relayRpcUrl: string) => {
		const relayChains = getRelayChains(allChains);
		return relayChains.find((chain) => Object.values(chain.rpcs).includes(relayRpcUrl)) || null;
	};

	const getAvailableParachains = (allChains: any[], selectedRelayChain: any) => {
		if (!selectedRelayChain) return [];
		return allChains.filter(
			(chain) => chain.relayChainInfo && chain.relayChainInfo.id === selectedRelayChain.id
		);
	};

	const generateEndpoints = (chains: any[]) => {
		const endpoints: Array<{ chain: string; name: string; url: string }> = [];
		for (const chain of chains) {
			for (const [name, url] of Object.entries(chain.rpcs)) {
				endpoints.push({
					chain: chain.display,
					name,
					url: url as string
				});
			}
		}
		return endpoints;
	};

	describe('chain filtering logic', () => {
		const allChains = getAllChains();

		it('correctly identifies relay chains', () => {
			const relayChains = getRelayChains(allChains);
			expect(relayChains).toHaveLength(2);
			expect(relayChains[0].id).toBe('polkadot');
			expect(relayChains[1].id).toBe('kusama');
		});

		it('finds relay chain by RPC URL', () => {
			const selectedChain = findSelectedRelayChain(allChains, 'wss://polkadot-rpc.dwellir.com');
			expect(selectedChain).toBeTruthy();
			expect(selectedChain?.id).toBe('polkadot');
		});

		it('returns null for unknown RPC URL', () => {
			const selectedChain = findSelectedRelayChain(allChains, 'wss://unknown.rpc.com');
			expect(selectedChain).toBeNull();
		});

		it('filters parachains by selected relay chain', () => {
			const polkadotRelay = findSelectedRelayChain(allChains, 'wss://polkadot-rpc.dwellir.com');
			const parachains = getAvailableParachains(allChains, polkadotRelay);

			expect(parachains).toHaveLength(1);
			expect(parachains[0].id).toBe('frequency');
		});

		it('returns empty array when no relay chain selected', () => {
			const parachains = getAvailableParachains(allChains, null);
			expect(parachains).toEqual([]);
		});
	});

	describe('endpoint generation', () => {
		it('generates endpoints for relay chains', () => {
			const allChains = getAllChains();
			const relayChains = getRelayChains(allChains);
			const endpoints = generateEndpoints(relayChains);

			expect(endpoints).toHaveLength(3); // 2 Polkadot + 1 Kusama endpoints
			expect(endpoints[0]).toEqual({
				chain: 'Polkadot Relay Chain',
				name: 'Allnodes',
				url: 'wss://polkadot-rpc.publicnode.com'
			});
		});

		it('generates endpoints for parachains', () => {
			const allChains = getAllChains();
			const polkadotRelay = findSelectedRelayChain(allChains, 'wss://polkadot-rpc.dwellir.com');
			const parachains = getAvailableParachains(allChains, polkadotRelay);
			const endpoints = generateEndpoints(parachains);

			expect(endpoints).toHaveLength(2);
			expect(endpoints[0]).toEqual({
				chain: 'Frequency',
				name: 'Frequency 0',
				url: 'wss://0.rpc.frequency.xyz'
			});
		});

		it('handles empty chains array', () => {
			const endpoints = generateEndpoints([]);
			expect(endpoints).toEqual([]);
		});
	});

	describe('connection state validation', () => {
		const validateConnectionInputs = (relayUrl: string, parachainUrl: string) => {
			if (!relayUrl || !parachainUrl) {
				return 'Please provide both relay chain and parachain RPC URLs';
			}

			if (!relayUrl.startsWith('wss://') && !relayUrl.startsWith('ws://')) {
				return 'Relay chain URL must be a valid WebSocket URL';
			}

			if (!parachainUrl.startsWith('wss://') && !parachainUrl.startsWith('ws://')) {
				return 'Parachain URL must be a valid WebSocket URL';
			}

			return null; // Valid
		};

		it('validates complete connection inputs', () => {
			const result = validateConnectionInputs(
				'wss://polkadot-rpc.dwellir.com',
				'wss://0.rpc.frequency.xyz'
			);
			expect(result).toBeNull();
		});

		it('requires both URLs', () => {
			const result1 = validateConnectionInputs('', 'wss://0.rpc.frequency.xyz');
			const result2 = validateConnectionInputs('wss://polkadot-rpc.dwellir.com', '');

			expect(result1).toBe('Please provide both relay chain and parachain RPC URLs');
			expect(result2).toBe('Please provide both relay chain and parachain RPC URLs');
		});

		it('validates WebSocket URL format', () => {
			const result1 = validateConnectionInputs('https://invalid.com', 'wss://0.rpc.frequency.xyz');
			const result2 = validateConnectionInputs(
				'wss://polkadot-rpc.dwellir.com',
				'http://invalid.com'
			);

			expect(result1).toBe('Relay chain URL must be a valid WebSocket URL');
			expect(result2).toBe('Parachain URL must be a valid WebSocket URL');
		});
	});
});

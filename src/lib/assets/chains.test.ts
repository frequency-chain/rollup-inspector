import { describe, it, expect } from 'vitest';
import polkadotChains from './polkadot.json';
import kusamaChains from './kusama.json';
import westendChains from './westend.json';
import paseoChains from './paseo.json';

describe('Chain Assets', () => {
	describe('polkadot.json', () => {
		it('loads polkadot chain data', () => {
			expect(Array.isArray(polkadotChains)).toBe(true);
			expect(polkadotChains.length).toBeGreaterThan(0);
		});

		it('has relay chain as first entry', () => {
			const relayChain = polkadotChains[0];
			expect(relayChain.id).toBe('polkadot');
			expect(relayChain.display).toBe('Polkadot Relay Chain');
			expect(relayChain.relayChainInfo).toBeUndefined();
		});

		it('has parachains with valid relay chain info', () => {
			const parachains = polkadotChains.filter((chain) => chain.relayChainInfo);
			expect(parachains.length).toBeGreaterThan(0);

			parachains.forEach((parachain) => {
				expect(parachain.relayChainInfo!.id).toBe('polkadot');
				expect(typeof parachain.relayChainInfo!.parachain).toBe('number');
				expect(typeof parachain.relayChainInfo!.isSystem).toBe('boolean');
			});
		});

		it('has valid RPC endpoints', () => {
			polkadotChains.forEach((chain) => {
				expect(typeof chain.rpcs).toBe('object');
				expect(Object.keys(chain.rpcs).length).toBeGreaterThan(0);

				Object.entries(chain.rpcs).forEach(([name, url]) => {
					expect(typeof name).toBe('string');
					expect(typeof url).toBe('string');
					expect(url).toMatch(/^wss?:\/\//);
				});
			});
		});
	});

	describe('kusama.json', () => {
		it('loads kusama chain data', () => {
			expect(Array.isArray(kusamaChains)).toBe(true);
			expect(kusamaChains.length).toBeGreaterThan(0);
		});
	});

	describe('westend.json', () => {
		it('loads westend chain data', () => {
			expect(Array.isArray(westendChains)).toBe(true);
			expect(westendChains.length).toBeGreaterThan(0);
		});
	});

	describe('paseo.json', () => {
		it('loads paseo chain data', () => {
			expect(Array.isArray(paseoChains)).toBe(true);
			expect(paseoChains.length).toBeGreaterThan(0);
		});
	});

	describe('Chain Data Consistency', () => {
		const allChains = [...polkadotChains, ...kusamaChains, ...westendChains, ...paseoChains];

		it('all chains have required properties', () => {
			allChains.forEach((chain) => {
				expect(chain).toHaveProperty('id');
				expect(chain).toHaveProperty('display');
				expect(chain).toHaveProperty('rpcs');
				expect(chain).toHaveProperty('nativeToken');

				expect(typeof chain.id).toBe('string');
				expect(typeof chain.display).toBe('string');
				expect(typeof chain.rpcs).toBe('object');
				expect(typeof chain.nativeToken).toBe('object');
			});
		});

		it('native tokens have symbol and decimals', () => {
			allChains.forEach((chain) => {
				expect(chain.nativeToken).toHaveProperty('symbol');
				expect(chain.nativeToken).toHaveProperty('decimals');
				expect(typeof chain.nativeToken.symbol).toBe('string');
				expect(typeof chain.nativeToken.decimals).toBe('number');
			});
		});

		it('relay chains and parachains are properly categorized', () => {
			const relayChains = allChains.filter((chain) => !chain.relayChainInfo);
			const parachains = allChains.filter((chain) => chain.relayChainInfo);

			// Should have exactly 4 relay chains
			expect(relayChains.length).toBe(4);

			// Should have some parachains
			expect(parachains.length).toBeGreaterThan(10);

			// All relay chain IDs should be unique
			const relayIds = relayChains.map((chain) => chain.id);
			expect(new Set(relayIds).size).toBe(relayIds.length);
		});
	});
});

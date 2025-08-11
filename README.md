# Polkadot Rollup Block Inspector

A real-time monitoring tool for Polkadot parachain blocks and their relationship to relay chain blocks.

**🚀 Live Demo**: https://frequency-chain.github.io/rollup-inspector

## Overview

Monitor parachain block production, backing, and inclusion events across Polkadot, Kusama, Westend, and Paseo. Features real-time chain status, block timelines, fork detection, and detailed block analysis.

## Technology Stack

- **Svelte 5** + SvelteKit + TypeScript
- **[Polkadot-API (PAPI)](https://papi.how/)** for blockchain connectivity
- **LokiJS** for in-memory data management
- **TailwindCSS** for styling

## Development

```bash
npm install
npm run dev
```

## Usage

1. Select a relay chain (Polkadot, Kusama, Westend, or Paseo)
2. Select a parachain from the filtered list
3. Connect and monitor real-time block events

## Scripts

- `npm run dev` - Development server
- `npm run build` - Production build  
- `npm run check` - Type checking
- `npm run lint` - Code linting

## Issues

Report bugs and feature requests in [GitHub Issues](https://github.com/frequency-chain/rollup-inspector/issues).

## Notes

This project was partially generated using AI assistance.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome extension (Manifest V3) that automatically groups browser tabs by domain. It listens to tab lifecycle events and groups/ungroups tabs using the Chrome `tabs` and `tabGroups` APIs.

## Commands

- `npm run build` - Lint + webpack production build (outputs to `dist/`)
- `npm run dev` - Webpack watch mode for development
- `npm test` - Run Jest tests
- `npm test -- --testNamePattern="pattern"` - Run a single test by name
- `npm run lint` - ESLint on `src/` TypeScript files
- `npm run lint:fix` - Auto-fix lint issues
- `npm run format:check` - Prettier check
- `npm run format` - Prettier format
- `npm run package` - Build + zip for Chrome Web Store

## Architecture

All source code lives in `src/`. The build entry point is `src/background.ts`.

- **`src/background.ts`** - Service worker entry point. Registers Chrome event listeners (`onCreated`, `onUpdated`, `onRemoved`) that trigger grouping/ungrouping logic.
- **`src/handlers.ts`** - Core logic. Exports `groupTabsByBaseUrl`, `ungroupIfNecessary`, and `isValidTabUrl`. Groups tabs per-window by hostname (stripping `www.`, filtering `chrome://` and `chrome-extension://` URLs), requires 2+ tabs to form a group, and auto-ungroups when a group drops below 2 tabs. Uses deterministic hash-based color assignment per domain.
- **`src/handlers.test.ts`** - Tests mock the `chrome` global directly (no setup file needed). Uses in-memory `mockTabs`/`mockGroups` arrays to simulate Chrome API behavior.

Webpack bundles to `dist/background.js` and copies `manifest.json` + `icons/` via CopyWebpackPlugin.

## CI

GitHub Actions runs lint, format check, and tests on Node 18.x and 20.x for pushes/PRs to `main`.

## Notes

- Jest is configured to only match tests in `src/**/*.test.ts`.
- Config files are TypeScript (`webpack.config.ts`, `jest.config.ts`) or JSON (`.eslintrc.json`). Webpack uses `tsx` to load its TS config.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome extension (Manifest V3) that automatically groups browser tabs by domain. It listens to tab lifecycle events and groups/ungroups tabs using the Chrome `tabs` and `tabGroups` APIs.

## Commands

- `npm run build` - Lint + webpack production build (outputs to `dist/`)
- `npm run dev` - Webpack watch mode for development
- `npm test` - Run Jest tests
- `npm test -- --testNamePattern="pattern"` - Run a single test by name
- `npm run test:watch` - Jest watch mode
- `npm run lint` - ESLint on `src/` TypeScript files
- `npm run lint:fix` - Auto-fix lint issues
- `npm run format:check` - Prettier check
- `npm run format` - Prettier format
- `npm run package` - Build + zip for Chrome Web Store

## Architecture

All source code lives in `src/`. The build entry point is `src/background.ts`.

- **`src/background.ts`** - Service worker entry point. Registers Chrome event listeners (`onCreated`, `onUpdated`, `onRemoved`, `tabGroups.onUpdated`) that trigger grouping/ungrouping logic. All tab events are debounced through `scheduleTabProcessing` with an `isProcessingTabChanges` guard to prevent concurrent execution. Manages two context menu toggles ("Group single tabs" and "Auto-collapse inactive groups"), caches settings in module-level variables, and persists them via `chrome.storage.sync`. Listens for `storage.onChanged` for cross-device sync.
- **`src/handlers.ts`** - Core logic. Exports `groupTabsByDomain`, `dissolveGroupsWithTooFewTabs`, `collapseAllGroupsExcept`, and `isValidTabUrl`. Groups tabs per-window by hostname (stripping `www.`, filtering `chrome://` and `chrome-extension://` URLs, skipping pinned tabs). `groupTabsByDomain` and `dissolveGroupsWithTooFewTabs` accept a `shouldGroupSingleTabs` parameter (default `false`) — when `true`, single tabs are grouped and single-tab groups are preserved. `collapseAllGroupsExcept` collapses all groups in a window except the specified one. Uses deterministic hash-based color assignment per domain.
- **`src/handlers.test.ts`** - Tests mock the `chrome` global directly (no setup file needed). Uses in-memory `mockTabs`/`mockGroups` arrays to simulate Chrome API behavior.

Webpack bundles to `dist/background.js` and copies `manifest.json` + `icons/` via CopyWebpackPlugin.

## CI

GitHub Actions runs lint, format check, tests, and build on Node 20.x and 22.x for pushes/PRs to `main`.

## Notes

- Jest is configured to only match tests in `src/**/*.test.ts`.
- Config files are TypeScript (`webpack.config.ts`, `jest.config.ts`) or JSON (`.eslintrc.json`). Webpack uses `tsx` to load its TS config.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Chrome MV3 extension (Plasmo + React 18 + Bun) that audits RTB House ad creatives: it overlays network/memory/DOM stats on ad iframes and runs font, opt-out, contrast and border checks. It only runs on the RTB House domains listed in `package.json` `manifest.host_permissions` (creatives-preview, techtools, statics.creativecdn.com, ams.creativecdn.com). Feature list and settings defaults are documented in README.md.

## Commands

```bash
bun install
bun run dev            # plasmo dev; load build/chrome-mv3-dev unpacked in chrome://extensions
bun run build          # production build
bun run package        # zip for Web Store (no CI in this repo; publish manually)
bun test               # tests live in lib/*.test.ts
bun test lib/request-list.test.ts   # single test file
bunx tsc --noEmit      # typecheck (no lint script exists)
```

Path alias: `~` maps to the repo root (e.g. `~lib/storage/keys`). Prettier with sorted imports is configured in `.prettierrc.mjs`.

## Architecture

Plasmo auto-registers entry points by file location: `background.ts` (service worker), `popup.tsx`, `tabs/welcome.tsx` (onboarding page), and `contents/*.ts` (content scripts, each exporting a `PlasmoCSConfig`).

The extension is split across frame boundaries, and cross-frame communication is the key thing to understand:

- **Host page vs. ad iframes.** `contents/creatives-host.ts` and `contents/host-overlay.ts` run in the top frame (`all_frames: false` for creatives-host) on preview pages, and render the UI that sits around/over iframes (overlays, results panels). `contents/monitor.ts` (the largest file) runs with `all_frames: true` inside each iframe, collects measurements, and renders per-iframe stats. `contents/iframe-font-checker.ts` runs in all frames on `<all_urls>`.
- **Messaging.** Iframe ↔ host uses `window.postMessage` (`window.parent.postMessage` from iframes, `iframe.contentWindow.postMessage` from host). Content scripts ↔ background use `chrome.runtime.sendMessage`, with message types prefixed `ad-auditor/` (`open-tab`, `get-cdp-status`, `get-enhanced-stats`) handled in `background.ts`.
- **Measurement methods.** "Enhanced (CDP)" uses `chrome.debugger` in the background: `lib/cdp/` holds per-tab sessions (`session-manager`), Network-domain event handlers (`network-tracker`), and debugger helpers (including cache disabling). "Legacy" uses the Performance API in `monitor.ts`. Content scripts request CDP stats from the background and fall back when it's unavailable.
- **Settings.** Stored in `chrome.storage.sync`; keys in `lib/storage/keys.ts`, defaults in `lib/storage/defaults.ts`, validation via `lib/storage/parsers.ts`. `background.ts` writes defaults on install and runs a versioned migration (`runSettingsMigration`) to backfill missing keys, so new settings need a default plus migration handling.
- **Feature/UI logic** is kept in `lib/` as mostly pure modules (`lib/features/*` checkers, `lib/request-list.ts` filter/sort, `lib/insights.ts`, `lib/ui/*` DOM-built panels and tooltips) so it can be unit-tested with `bun test`; content scripts build DOM imperatively rather than using React. React is used only in the popup, welcome page and `components/`.
- All cross-frame (`window.postMessage`) and runtime (`chrome.runtime.sendMessage`) message types live in `lib/messaging.ts` (typed constants, validators, post helpers, trust-model notes); add new message types there rather than as string literals. The font check is a single implementation in `lib/features/font-checker.ts`, used by `contents/iframe-font-checker.ts` and `contents/monitor.ts`.

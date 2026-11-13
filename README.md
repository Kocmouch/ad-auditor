# RTB House Ad Auditor (Chrome Extension)

Chrome extension built with **Plasmo + Bun** to inspect ad iframe network usage on RTB House preview domains.

## Supported Domains

- `https://creatives-preview.rtbhouse.com/*`
- `https://techtools.rtbhouse.biz/*`
- `https://statics.creativecdn.com/*`
- `https://ams.creativecdn.com/*`

`all_frames: true` is enabled, so nested iframes are supported.

## Current Features

- Stats bar rendered below each iframe at full width (single fixed layout; no display-mode options)
- Measurement methods:
  - `Enhanced (CDP)` (default)
  - `Legacy (Performance API)`
- Request list with filters/sorting:
  - type filter, status filter, host filter
  - sort by transferred/resources/url
  - top 100 by default + `Show all`
- Cache control:
  - `Disable cache on preview domains` (default enabled)
- Optional popup diagnostics:
  - `Show CDP status` (`Attached/Fallback/Error`)
- Optional analysis features (all default OFF):
  - `Enable snapshots & compare`
  - `Show waterfall lite`
  - `Focus offenders first`
  - `Show alerts`
- Welcome page:
  - opens automatically on first install
  - available anytime from popup (`Open setup guide`)
  - includes interactive onboarding checklist and quick actions
- **Font checking** (button with "T" icon):
  - Detects font mismatches (declared vs rendered)
  - Highlights affected elements with a colorful gradient border
  - Shows a results panel with details
- **Accessibility checking** (button with 3-line icon):
  - **Opt-out detection**: finds `.optout`/`#optout` elements in iframes and AMS
  - **Contrast validation**: WCAG AA (4.5:1 minimum) for opt-out elements
  - **Border validation**: detects missing or invisible borders on banner containers
  - Highlights issues with colored outlines (red for critical, yellow for warnings)
  - Shows a unified results panel with a detailed breakdown

## Defaults and Settings Migration

On fresh install, the extension saves defaults to `chrome.storage.sync`:

- `STANDALONE_AMS_PREVIEW_BADGE_ENABLED = true`
- `MEASUREMENT_METHOD = enhanced_cdp`
- `LIMIT_METRIC = resources`
- `LIMIT_BYTES = 2.5 MiB`
- `DISABLE_CACHE = true`
- `SHOW_CDP_STATUS = false`
- `ENABLE_SNAPSHOTS`, `SHOW_WATERFALL`, `FOCUS_OFFENDERS`, `SHOW_ALERTS`, `SHOW_REQUEST_LIST = false`

(Source of truth: `lib/storage/defaults.ts`.)

Background script also runs versioned settings migration to backfill missing keys on existing installs.

## Development

### Requirements

- [Bun](https://bun.sh/)
- Chrome (Manifest V3)

### Commands

```bash
bun install
bun run dev
bun run build
bun run package
bun test
bun run typecheck   # tsc --noEmit
```

Load unpacked extension from `build/chrome-mv3-dev` in `chrome://extensions` (Developer mode).

## Permissions

- `storage`: settings in `chrome.storage.sync`.
- `debugger`: required for Enhanced (CDP) measurement. While it is active Chrome shows a "debugging this browser" banner; choose Legacy (Performance API) mode to avoid it.

## Notes

- CDP mode is closest to DevTools network accounting.
- Performance API mode can differ due to frame scope and browser caching behavior.

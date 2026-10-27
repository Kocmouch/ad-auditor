# RTB House Ad Auditor (Chrome Extension)

Chrome extension built with **Plasmo + Bun** to inspect ad iframe network usage on RTB House preview domains.

## Supported Domains

- `https://creatives-preview.rtbhouse.com/*`
- `https://techtools.rtbhouse.biz/*`
- `https://statics.creativecdn.com/*`
- `https://ams.creativecdn.com/*`

`all_frames: true` is enabled, so nested iframes are supported.

## Current Features

- Display modes:
  - `Inside iframe (always visible)`
  - `Inside iframe (show on hover)`
  - `Below iframe` (default)
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
- Below-iframe layout option:
  - choose iframe-width bar or full-page width (`width: 100%`)
- Welcome page:
  - opens automatically on first install
  - available anytime from popup (`Open setup guide`)
  - includes interactive onboarding checklist and quick actions
- **Font checking** (button with "T" icon):
  - Detects font mismatches (declared vs rendered)
  - Highlights elements with colorful gradient border
  - Shows results panel with detailed information
- **Accessibility checking** (button with 3-line icon):
  - **Opt-out detection**: Finds `.optout`/`#optout` elements in iframes and AMS
  - **Contrast validation**: Checks WCAG AA compliance (4.5:1 minimum) for opt-out elements
  - **Border validation**: Detects missing or invisible borders on banner containers
  - Highlights issues with colored outlines (red for critical, yellow for warnings)
  - Shows unified results panel with detailed breakdown

## Defaults and Settings Migration

On fresh install, the extension saves defaults to `chrome.storage.sync`:

- `displayMode = below_iframe`
- `measurementMethod = enhanced_cdp`
- `disableCache = true`
- `snapshots/waterfall/focus-offenders/show-alerts = false`

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
bunx tsc --noEmit
```

Load unpacked extension from `build/chrome-mv3-dev` in `chrome://extensions` (Developer mode).

## Notes

- CDP mode is closest to DevTools network accounting.
- Performance API mode can differ due to frame scope and browser caching behavior.

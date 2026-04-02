# RTB House Ad Auditor (Chrome Extension)

Chrome extension built with **Plasmo + Bun** to inspect ad iframe network usage on RTB House preview domains.

## Supported Domains

- `https://creatives-preview.rtbhouse.com/*`
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
- Below-iframe layout option:
  - choose iframe-width bar or full-page width (`width: 100%`)
- Welcome page:
  - opens automatically on first install
  - available anytime from popup (`Open setup guide`)

## Defaults and Settings Migration

On fresh install, the extension saves defaults to `chrome.storage.sync`:

- `displayMode = below_iframe`
- `measurementMethod = enhanced_cdp`
- `disableCache = true`

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

# RTB House Ad Auditor (Chrome Extension)

Chrome extension built with **Plasmo + Bun** to audit RTB House ad iframes.

It injects a bottom badge inside each matched ad iframe and shows live network stats:

- `Transferred`: sum of `transferSize` from `performance` resource entries
- `Resources`: sum of `decodedBodySize` from `performance` resource entries
- `Open` button: opens the current iframe URL in a new tab

## Supported domains

- `https://creatives-preview.rtbhouse.com/*`
- `https://statics.creativecdn.com/*`
- `https://ams.creativecdn.com/*`

The content script is configured with `all_frames: true`, so the badge appears inside nested ad iframes too.

## How it works

- `contents/monitor.ts`:
  - runs only on supported domains
  - checks iframe context (`window.self !== window.top`)
  - injects an `Ad-Auditor` badge at the bottom of the frame
  - updates stats in real time with `PerformanceObserver` (`resource` entries)
- `background.ts`:
  - optional fallback handler for opening a tab via message (`ad-auditor/open-tab`)

## Setup

### Requirements

- [Bun](https://bun.sh/)
- Chrome (Manifest V3)

### Install dependencies

```bash
bun install
```

### Run in development

```bash
bun run dev
```

Then load the unpacked extension from:

- `build/chrome-mv3-dev`

in `chrome://extensions` (enable **Developer mode**).

### Build production package

```bash
bun run build
```

Output directory:

- `build/chrome-mv3-prod`

## Usage

1. Open a page on one of the supported domains where ad iframe assets are loading.
2. Open the extension popup and choose a display mode:
   - `Inside iframe (always visible)`
   - `Inside iframe (show on hover)`
   - `Below iframe`
3. Choose a measurement engine:
   - `Enhanced (CDP)` for values closest to DevTools
   - `Legacy (Performance API)` as fallback
4. Configure limit coloring:
   - metric: `Resources` (default) or `Transferred`
   - threshold: default `2.5 MB`, editable in popup
5. Optional: enable `Disable cache on preview domains` in popup:
   - applies to `creatives-preview.rtbhouse.com` and `ams.creativecdn.com`
   - uses Chrome debugger network cache controls automatically
6. Look at the stats bar in the selected location:
   - `Ad-Auditor <Transferred> / <Resources>`
7. Click `Open` to inspect the iframe URL in a separate tab.

## Notes

- Stats come from the frame's own `performance` API, so values can differ from top-level page totals in DevTools.
- Some resources may report `0` sizes due to browser/network constraints (for example, cache or opaque responses).

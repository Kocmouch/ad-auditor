import type { PlasmoCSConfig } from "plasmo"

import { listenForFontRequests } from "~lib/audit-actions"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

// Only run in iframes, not on main page
if (window.self !== window.top) {
  listenForFontRequests()
}

import type { PlasmoCSConfig } from "plasmo"

import {
  isMessageFromSelf,
  parseWindowMessage,
  resolveSenderIframe,
  WINDOW_MESSAGE
} from "~lib/messaging"
import { createHostResults } from "~lib/ui/host-results"

export const config: PlasmoCSConfig = {
  matches: [
    "https://creatives-preview.rtbhouse.com/*",
    "https://techtools.rtbhouse.biz/*"
  ],
  all_frames: false // IMPORTANT: Only run on main frame, not iframes
}

const results = createHostResults()

// Messages from host-overlay.ts (same window) and from audited iframes.
window.addEventListener("message", (event) => {
  const message = parseWindowMessage(event.data)
  if (!message) {
    return
  }

  if (message.type === WINDOW_MESSAGE.FONT_CHECK_RESULTS) {
    if (!isMessageFromSelf(event)) {
      return
    }

    const iframe = Array.from(document.querySelectorAll("iframe"))[
      message.iframeIndex
    ]
    if (iframe) {
      results.renderFontResults(
        message.fontMismatches,
        message.iframeUrl,
        iframe
      )
    }
    return
  }

  if (message.type === WINDOW_MESSAGE.CHECK_ACCESSIBILITY_RESPONSE) {
    const iframe = resolveSenderIframe(event)
    if (iframe) {
      results.renderAccessibilityResults(
        message.optOutIssues,
        message.borderIssues,
        iframe
      )
    }
    return
  }

  if (message.type === WINDOW_MESSAGE.CHECK_CONTENT_RESPONSE) {
    const iframe = resolveSenderIframe(event)
    if (iframe) {
      results.renderContentResults(message.issues, iframe)
    }
  }
})

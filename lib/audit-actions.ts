import {
  checkBorderElements,
  clearBorderHighlights
} from "~lib/features/border-checker"
import {
  checkFontsInDocument,
  clearFontHighlights
} from "~lib/features/font-checker"
import {
  checkOptOutElements,
  clearOptOutHighlights
} from "~lib/features/optout-checker"
import {
  isMessageFromParent,
  parseWindowMessage,
  postToParent,
  toWireFontMismatches,
  toWireIssues,
  WINDOW_MESSAGE
} from "~lib/messaging"

export const runAccessibilityChecks = () => ({
  borderIssues: checkBorderElements(),
  optOutIssues: checkOptOutElements()
})

export const clearAccessibilityHighlights = () => {
  clearOptOutHighlights()
  clearBorderHighlights()
}

/**
 * Iframe side of the host -> iframe font protocol. Requests are accepted only
 * from the embedding parent window.
 */
export const listenForFontRequests = () => {
  window.addEventListener("message", (event) => {
    if (!isMessageFromParent(event)) {
      return
    }

    const message = parseWindowMessage(event.data)
    if (message?.type === WINDOW_MESSAGE.CLEAR_FONT_HIGHLIGHTS) {
      clearFontHighlights()
      return
    }

    if (message?.type === WINDOW_MESSAGE.CHECK_FONTS_REQUEST) {
      postToParent({
        fontMismatches: toWireFontMismatches(checkFontsInDocument()),
        iframeUrl: window.location.href,
        type: WINDOW_MESSAGE.CHECK_FONTS_RESPONSE
      })
    }
  })
}

/** Iframe side of the host -> iframe accessibility protocol. */
export const listenForAccessibilityRequests = () => {
  window.addEventListener("message", (event) => {
    if (!isMessageFromParent(event)) {
      return
    }

    const message = parseWindowMessage(event.data)
    if (message?.type === WINDOW_MESSAGE.CLEAR_ACCESSIBILITY_HIGHLIGHTS) {
      clearAccessibilityHighlights()
      return
    }

    if (message?.type === WINDOW_MESSAGE.CHECK_ACCESSIBILITY_REQUEST) {
      const { borderIssues, optOutIssues } = runAccessibilityChecks()
      postToParent({
        borderIssues: toWireIssues(borderIssues),
        iframeUrl: window.location.href,
        optOutIssues: toWireIssues(optOutIssues),
        type: WINDOW_MESSAGE.CHECK_ACCESSIBILITY_RESPONSE
      })
    }
  })
}

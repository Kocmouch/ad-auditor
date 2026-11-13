import {
  accessibilityOutcome,
  contentOutcome,
  fontOutcome,
  qualityOutcome,
  type CheckOutcomes
} from "~lib/audit-summary"
import {
  checkBorderElements,
  clearBorderHighlights
} from "~lib/features/border-checker"
import {
  clearContentHighlights,
  runContentChecks,
  type ContentIssue
} from "~lib/features/content-checker"
import {
  checkFontsInDocument,
  clearFontHighlights
} from "~lib/features/font-checker"
import {
  checkOptOutElements,
  clearOptOutHighlights
} from "~lib/features/optout-checker"
import {
  clearQualityHighlights,
  runQualityChecks,
  type QualityCheckResult,
  type QualityIssue
} from "~lib/features/quality-checker"
import {
  isMessageFromParent,
  parseWindowMessage,
  postToParent,
  toWireContentIssues,
  toWireFontMismatches,
  toWireIssues,
  toWireQualityIssues,
  WINDOW_MESSAGE
} from "~lib/messaging"
import { clearAllHighlights, focusHighlight } from "~lib/ui/highlight"
import type { Rect } from "~lib/utils/banner-bounds"

export const runAccessibilityChecks = () => ({
  borderIssues: checkBorderElements(),
  optOutIssues: checkOptOutElements()
})

export const clearAccessibilityHighlights = () => {
  clearOptOutHighlights()
  clearBorderHighlights()
}

let latestContentIssues: ContentIssue[] = []

/** Runs the content check; remembers issues so rows can be focused by index. */
export const runContentCheck = (): ContentIssue[] => {
  latestContentIssues = runContentChecks().issues
  return latestContentIssues
}

export const clearContentCheck = () => {
  clearContentHighlights()
  latestContentIssues = []
}

/** Scrolls to and flashes the element of content issue `index`. */
export const focusContentIssue = (index: number): boolean => {
  const element = latestContentIssues[index]?.element
  return element ? focusHighlight(element) : false
}

let latestQualityIssues: QualityIssue[] = []

/**
 * Runs the quality check; remembers issues so rows can be focused by index.
 * Pass the banner rectangle in standalone mode, nothing inside ad iframes.
 */
export const runQualityCheck = (bounds?: Rect): QualityCheckResult => {
  const result = runQualityChecks(document, bounds)
  latestQualityIssues = result.issues
  return result
}

export const clearQualityCheck = () => {
  clearQualityHighlights()
  latestQualityIssues = []
}

/** Scrolls to and flashes the element of quality issue `index`. */
export const focusQualityIssue = (index: number): boolean => {
  const element = latestQualityIssues[index]?.element
  return element ? focusHighlight(element) : false
}

/**
 * "Audit all": runs every check and reports the worst severity per check.
 * Highlights are cleared afterwards; the aggregate table is the result.
 */
export const runAllChecks = (): CheckOutcomes => {
  const fonts = checkFontsInDocument()
  const { borderIssues, optOutIssues } = runAccessibilityChecks()
  const content = runContentCheck()
  const quality = runQualityCheck().issues
  const outcomes: CheckOutcomes = {
    accessibility: accessibilityOutcome(optOutIssues, borderIssues),
    content: contentOutcome(content),
    fonts: fontOutcome(fonts.length),
    quality: qualityOutcome(quality)
  }

  clearAllHighlights()
  latestContentIssues = []
  latestQualityIssues = []
  return outcomes
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

/** Iframe side of the host -> iframe content check and "Audit all" protocol. */
export const listenForContentRequests = () => {
  window.addEventListener("message", (event) => {
    if (!isMessageFromParent(event)) {
      return
    }

    const message = parseWindowMessage(event.data)
    switch (message?.type) {
      case WINDOW_MESSAGE.CHECK_CONTENT_REQUEST:
        postToParent({
          iframeUrl: window.location.href,
          issues: toWireContentIssues(runContentCheck()),
          type: WINDOW_MESSAGE.CHECK_CONTENT_RESPONSE
        })
        break
      case WINDOW_MESSAGE.CLEAR_CONTENT_HIGHLIGHTS:
        clearContentCheck()
        break
      case WINDOW_MESSAGE.FOCUS_CONTENT_ISSUE:
        focusContentIssue(message.index)
        break
      case WINDOW_MESSAGE.CHECK_QUALITY_REQUEST: {
        // Inside an iframe the viewport is the banner: no bounds needed.
        const result = runQualityCheck()
        postToParent({
          coveragePercent: result.coveragePercent,
          iframeUrl: window.location.href,
          issues: toWireQualityIssues(result.issues),
          type: WINDOW_MESSAGE.CHECK_QUALITY_RESPONSE
        })
        break
      }
      case WINDOW_MESSAGE.CLEAR_QUALITY_HIGHLIGHTS:
        clearQualityCheck()
        break
      case WINDOW_MESSAGE.FOCUS_QUALITY_ISSUE:
        focusQualityIssue(message.index)
        break
      case WINDOW_MESSAGE.AUDIT_REQUEST:
        postToParent({
          checks: runAllChecks(),
          iframeUrl: window.location.href,
          type: WINDOW_MESSAGE.AUDIT_RESPONSE
        })
        break
    }
  })
}

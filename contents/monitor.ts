import type { PlasmoCSConfig } from "plasmo"

import {
  clearContentCheck,
  focusContentIssue,
  listenForAccessibilityRequests,
  listenForContentRequests,
  runAccessibilityChecks,
  runContentCheck
} from "~lib/audit-actions"
import {
  accessibilityOutcome,
  contentOutcome,
  fontOutcome,
  type CheckOutcomes
} from "~lib/audit-summary"
import { findNestedAmsPreviewUrl, isStandaloneAmsPreviewLocation } from "~lib/audit-url"
import {
  getDefaultContentSettings,
  watchContentSettings,
  type ContentSettings
} from "~lib/content-settings"
import { interpretEnhancedStats } from "~lib/enhanced-totals"
import { checkFontsInDocument } from "~lib/features/font-checker"
import {
  compareSnapshot,
  getSnapshotInfo,
  saveSnapshot,
  type Totals
} from "~lib/features/snapshot"
import { buildEnglishAlerts } from "~lib/insights"
import { buildLegacyTotals, createEmptyTotals } from "~lib/legacy-totals"
import {
  MESSAGE_SOURCE,
  postToParent,
  requestEnhancedStats,
  sendOpenTab,
  toWireContentIssues,
  WINDOW_MESSAGE
} from "~lib/messaging"
import type { RequestListItem } from "~lib/request-list"
import { createAccessibilityResultsPanel } from "~lib/ui/accessibility-results-panel"
import {
  applyUsageColors,
  renderAlertLines,
  updateStatusIndicators
} from "~lib/ui/badge-parts"
import { createContentResultsPanel } from "~lib/ui/content-results-panel"
import { createFontCheckResultsPanel } from "~lib/ui/font-results-panel"
import { createPanelMount } from "~lib/ui/panel-mount"
import { updateRequestPanel, updateSnapshotRow } from "~lib/ui/request-panel"
import {
  applyStandaloneBadgeLayout,
  createStandaloneBadge,
  type StandaloneBadge
} from "~lib/ui/standalone-badge"
import { getDarkTheme } from "~lib/ui/theme"
import { hasNetworkAlerts } from "~lib/usage-display"
import { formatBytes } from "~lib/utils/formatters"

export const config: PlasmoCSConfig = {
  all_frames: true,
  matches: [
    "https://creatives-preview.rtbhouse.com/*",
    "https://techtools.rtbhouse.biz/*",
    "https://statics.creativecdn.com/*",
    "https://ams.creativecdn.com/*"
  ]
}

const STATS_POST_THROTTLE_MS = 250
const ENHANCED_POLL_MS = 500

const isIframeContext = (() => {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
})()

let settings: ContentSettings = getDefaultContentSettings()
let badge: StandaloneBadge | null = null
let isRequestListHoverActive = false
let lastStatsPostAt = 0
let latestRequestItems: RequestListItem[] = []
let latestTotals: Totals = createEmptyTotals()
let legacyTotals: Totals = createEmptyTotals()
let enhancedTotals: Totals = createEmptyTotals()
let enhancedStatsAvailable = false
let enhancedPollTimerId: number | null = null
let enhancedRequestInFlight = false
const savedSnapshotsByUrl = new Map<string, Totals & { capturedAt: number }>()
const fontPanelMount = createPanelMount()
const accessibilityPanelMount = createPanelMount()
const contentPanelMount = createPanelMount()
let checks: CheckOutcomes = {}

const getEffectiveAuditUrl = (): string =>
  findNestedAmsPreviewUrl(
    Array.from(document.querySelectorAll<HTMLIFrameElement>("iframe[src]")).map(
      (frame) => frame.src
    ),
    window.location.href
  ) || window.location.href

const shouldRenderStandaloneBadge = (): boolean =>
  !isIframeContext &&
  settings.standaloneAmsPreviewBadgeEnabled &&
  isStandaloneAmsPreviewLocation(window.location)

// --- Snapshots -------------------------------------------------------------

const updateSnapshotControls = () => {
  if (!badge) {
    return
  }

  updateSnapshotRow(
    badge.panel,
    settings.snapshotsEnabled,
    getSnapshotInfo(getEffectiveAuditUrl(), savedSnapshotsByUrl)
  )
}

const saveCurrentSnapshot = () => {
  saveSnapshot(getEffectiveAuditUrl(), latestTotals, savedSnapshotsByUrl)
  updateSnapshotControls()
}

const compareWithSavedSnapshot = () => {
  if (badge) {
    badge.panel.snapshotInfo.textContent = compareSnapshot(
      getEffectiveAuditUrl(),
      latestTotals,
      savedSnapshotsByUrl
    )
  }
}

// --- Standalone badge ------------------------------------------------------

const renderRequestList = () => {
  if (!badge) {
    return
  }

  updateRequestPanel(badge.panel, {
    enabled: settings.requestListEnabled,
    focusOffenders: settings.focusOffendersEnabled,
    hoverActive: isRequestListHoverActive,
    items: latestRequestItems,
    limitBytes: settings.limitBytes,
    waterfallEnabled: settings.waterfallEnabled
  })
}

const refreshStatusIndicators = () => {
  if (badge) {
    updateStatusIndicators(badge.indicators, latestRequestItems, checks)
  }
}

const handleCheckFonts = () => {
  const mismatches = checkFontsInDocument()
  checks = { ...checks, fonts: fontOutcome(mismatches.length) }
  refreshStatusIndicators()
  fontPanelMount.show(createFontCheckResultsPanel(mismatches, getDarkTheme()))
}

const handleCheckContent = () => {
  const issues = runContentCheck()
  checks = { ...checks, content: contentOutcome(issues) }
  refreshStatusIndicators()
  contentPanelMount.show(
    createContentResultsPanel(toWireContentIssues(issues), getDarkTheme(), {
      onClose: clearContentCheck,
      onSelect: focusContentIssue
    })
  )
}

const handleCheckAccessibility = () => {
  const { borderIssues, optOutIssues } = runAccessibilityChecks()
  checks = {
    ...checks,
    accessibility: accessibilityOutcome(optOutIssues, borderIssues)
  }
  refreshStatusIndicators()
  accessibilityPanelMount.show(
    createAccessibilityResultsPanel(optOutIssues, borderIssues, getDarkTheme())
  )
}

const ensureBadge = () => {
  if (isIframeContext || !document.body) {
    return
  }

  if (!badge || !badge.badge.isConnected) {
    const next = createStandaloneBadge({
      onCompareSnapshot: compareWithSavedSnapshot,
      onControlChange: renderRequestList,
      onSaveSnapshot: saveCurrentSnapshot
    })

    next.openButton.addEventListener("click", () =>
      sendOpenTab(getEffectiveAuditUrl())
    )
    next.fontsButton.addEventListener("click", handleCheckFonts)
    next.accessibilityButton.addEventListener("click", handleCheckAccessibility)
    next.contentButton.addEventListener("click", handleCheckContent)
    next.badge.addEventListener("mouseenter", () => {
      isRequestListHoverActive = true
      renderRequestList()
    })
    next.badge.addEventListener("mouseleave", () => {
      isRequestListHoverActive = false
      next.panel.container.style.display = "none"
    })

    document.body.appendChild(next.badge)
    badge = next
  }

  // Standalone AMS page: no "Open" button (already on the page).
  applyStandaloneBadgeLayout(badge, false, true)
  badge.contentButton.style.display = settings.contentCheckEnabled
    ? "flex"
    : "none"
}

const removeBadge = () => {
  badge?.badge.remove()
  badge = null
  isRequestListHoverActive = false
  latestRequestItems = []
  latestTotals = createEmptyTotals()
}

const updateAlertsUi = (totals: Totals) => {
  if (!badge) {
    return
  }

  const { alerts } = badge
  const lines = settings.alertsEnabled
    ? buildEnglishAlerts(totals, totals.requestItems, settings.limitBytes)
    : []

  if (!hasNetworkAlerts(lines)) {
    alerts.style.display = "none"
    alerts.textContent = ""
    return
  }

  renderAlertLines(alerts, lines)
}

// --- Measurements ----------------------------------------------------------

const getSelectedTotals = (): Totals =>
  settings.measurementMethod === "enhanced_cdp" && enhancedStatsAvailable
    ? enhancedTotals
    : legacyTotals

const postStatsToTop = (totals: Totals) => {
  if (!isIframeContext || window.parent === window) {
    return
  }

  const now = Date.now()
  if (now - lastStatsPostAt < STATS_POST_THROTTLE_MS) {
    return
  }
  lastStatsPostAt = now

  postToParent({
    payload: {
      requestCount: totals.requests,
      requestCountText: `${totals.requests} req`,
      requestItems: totals.requestItems,
      resources: totals.resources,
      resourcesText: formatBytes(totals.resources),
      transferred: totals.transferred,
      transferredText: formatBytes(totals.transferred),
      url: getEffectiveAuditUrl()
    },
    source: MESSAGE_SOURCE,
    type: WINDOW_MESSAGE.STATS
  })
}

const render = () => {
  const totals = getSelectedTotals()
  latestTotals = totals

  if (isIframeContext) {
    // Iframes report to host-overlay, which renders the badge below them.
    removeBadge()
    postStatsToTop(totals)
    return
  }

  if (!shouldRenderStandaloneBadge()) {
    removeBadge()
    return
  }

  ensureBadge()
  if (!badge) {
    return
  }

  badge.values.transferred.textContent = formatBytes(totals.transferred)
  badge.values.resources.textContent = formatBytes(totals.resources)
  badge.values.requests.textContent = ` (${totals.requests} req)`
  latestRequestItems = totals.requestItems
  refreshStatusIndicators()
  updateSnapshotControls()
  renderRequestList()
  updateAlertsUi(totals)
  applyUsageColors(
    badge.values,
    settings.limitMetric,
    totals,
    settings.limitBytes
  )
}

const updateLegacyTotals = () => {
  const navigationEntry = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined

  legacyTotals = buildLegacyTotals(
    performance.getEntriesByType("resource") as PerformanceResourceTiming[],
    navigationEntry,
    { hostname: location.hostname, href: location.href }
  )
  render()
}

const requestEnhancedTotalsOnce = () => {
  if (enhancedRequestInFlight) {
    return
  }

  enhancedRequestInFlight = true
  requestEnhancedStats(getEffectiveAuditUrl(), (response) => {
    enhancedRequestInFlight = false
    const result = interpretEnhancedStats(response, isIframeContext)

    if (result.kind === "unavailable") {
      enhancedStatsAvailable = false
      render()
      return
    }

    if (result.kind === "empty") {
      // Keep last enhanced snapshot to avoid flicker-to-zero between polls.
      if (!enhancedStatsAvailable) {
        render()
      }
      return
    }

    enhancedTotals = result.totals
    enhancedStatsAvailable = true
    render()
  })
}

const syncEnhancedPolling = () => {
  if (settings.measurementMethod !== "enhanced_cdp") {
    if (enhancedPollTimerId !== null) {
      window.clearInterval(enhancedPollTimerId)
      enhancedPollTimerId = null
    }

    enhancedStatsAvailable = false
    render()
    return
  }

  if (enhancedPollTimerId !== null) {
    return
  }

  requestEnhancedTotalsOnce()
  enhancedPollTimerId = window.setInterval(
    requestEnhancedTotalsOnce,
    ENHANCED_POLL_MS
  )
}

const startLegacyUpdates = () => {
  try {
    performance.setResourceTimingBufferSize(5000)
  } catch {
    // Ignore when changing timing buffer size is not allowed.
  }

  updateLegacyTotals()

  if (!("PerformanceObserver" in window)) {
    return
  }

  const observer = new PerformanceObserver(updateLegacyTotals)
  try {
    observer.observe({ type: "resource", buffered: true })
  } catch {
    observer.observe({ entryTypes: ["resource"] })
  }
}

const applySettings = (next: ContentSettings) => {
  settings = next
  updateSnapshotControls()
  syncEnhancedPolling()
  render()
}

const init = () => {
  const onReady = () => {
    watchContentSettings(() => settings, applySettings)

    if (isIframeContext) {
      // Requests from host-overlay (font requests: iframe-font-checker.ts).
      listenForAccessibilityRequests()
      listenForContentRequests()
    }

    startLegacyUpdates()
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady, { once: true })
    return
  }

  onReady()
}

init()

import type { PlasmoCSConfig } from "plasmo"

import {
  DEFAULT_LIMIT_BYTES,
  DEFAULT_LIMIT_METRIC,
  DEFAULT_MEASUREMENT_METHOD,
  DEFAULT_DISPLAY_MODE,
  DEFAULT_STANDALONE_AMS_PREVIEW_BADGE_ENABLED,
  DISPLAY_MODE_KEY,
  LIMIT_BYTES_KEY,
  LIMIT_METRIC_KEY,
  MEASUREMENT_METHOD_KEY,
  STANDALONE_AMS_PREVIEW_BADGE_KEY,
  type DisplayMode,
  type LimitMetric,
  type MeasurementMethod,
  parseDisplayMode,
  parseLimitBytes,
  parseLimitMetric,
  parseMeasurementMethod,
  parseStandaloneAmsPreviewBadgeEnabled
} from "~lib/display-mode"
import { getUsageColor } from "~lib/usage-color"

export const config: PlasmoCSConfig = {
  all_frames: true,
  matches: [
    "https://creatives-preview.rtbhouse.com/*",
    "https://statics.creativecdn.com/*",
    "https://ams.creativecdn.com/*"
  ]
}

const BADGE_ID = "ad-auditor-badge"
const SOURCE_ID = "ad-auditor"
const STATS_POST_THROTTLE_MS = 250
const ENHANCED_POLL_MS = 500
const AMS_PREVIEW_PATH = "/ad/creatives"

type Totals = {
  requestItems: RequestItem[]
  requests: number
  resources: number
  transferred: number
}

type RequestItem = {
  host: string
  resources: number
  status: "done" | "pending"
  transferred: number
  type: string
  url: string
}

const isIframeContext = (() => {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
})()

let displayMode: DisplayMode = DEFAULT_DISPLAY_MODE
let measurementMethod: MeasurementMethod = DEFAULT_MEASUREMENT_METHOD
let standaloneAmsPreviewBadgeEnabled = DEFAULT_STANDALONE_AMS_PREVIEW_BADGE_ENABLED
let limitMetric: LimitMetric = DEFAULT_LIMIT_METRIC
let limitBytes = DEFAULT_LIMIT_BYTES

let badge: HTMLDivElement | null = null
let requestListContainer: HTMLDivElement | null = null
let requestListElement: HTMLUListElement | null = null
let requestsValueSpan: HTMLSpanElement | null = null
let transferredValueSpan: HTMLSpanElement | null = null
let resourcesValueSpan: HTMLSpanElement | null = null
let openButton: HTMLButtonElement | null = null
let isHoverActive = false
let lastStatsPostAt = 0

let legacyTotals: Totals = {
  requestItems: [],
  requests: 0,
  resources: 0,
  transferred: 0
}
let enhancedTotals: Totals = {
  requestItems: [],
  requests: 0,
  resources: 0,
  transferred: 0
}
let enhancedStatsAvailable = false
let enhancedPollTimerId: number | null = null
let enhancedRequestInFlight = false

const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return `${(bytes / 1024).toFixed(2)} KB`
}

const shortUrl = (url: string): string => {
  if (!url) {
    return "(unknown URL)"
  }

  const maxLength = 110
  if (url.length <= maxLength) {
    return url
  }

  return `${url.slice(0, maxLength - 1)}…`
}

const updateRequestListUi = (items: RequestItem[]) => {
  if (!requestListContainer || !requestListElement) {
    return
  }

  requestListElement.textContent = ""

  if (items.length === 0) {
    requestListContainer.style.display = "none"
    return
  }

  for (const item of items) {
    const row = document.createElement("li")
    row.setAttribute(
      "style",
      "display:flex;gap:8px;align-items:flex-start;padding:2px 0;list-style:none"
    )

    const meta = document.createElement("span")
    meta.textContent = `[${item.type}] ${formatBytes(item.transferred)} / ${formatBytes(item.resources)} ${item.status === "done" ? "done" : "pending"}`
    meta.style.color = "#7dff6a"
    meta.style.flexShrink = "0"

    const url = document.createElement("span")
    url.textContent = shortUrl(item.url)
    url.style.color = "#ffffff"
    url.style.wordBreak = "break-all"

    row.append(meta, url)
    requestListElement.appendChild(row)
  }
}

const addEntrySizesToTotals = (
  totals: Totals,
  entry: Pick<
    PerformanceResourceTiming | PerformanceNavigationTiming,
    "decodedBodySize" | "encodedBodySize" | "transferSize"
  >
) => {
  const transferSize = Math.max(0, entry.transferSize || 0)
  const decodedBodySize = Math.max(0, entry.decodedBodySize || 0)
  const encodedBodySize = Math.max(0, entry.encodedBodySize || 0)

  totals.transferred += transferSize
  totals.resources += Math.max(decodedBodySize, encodedBodySize)
}

const getLegacyTotals = (): Totals => {
  const resourceEntries = performance.getEntriesByType(
    "resource"
  ) as PerformanceResourceTiming[]
  const navigationEntry = performance.getEntriesByType(
    "navigation"
  )[0] as PerformanceNavigationTiming | undefined

  const requestItems: RequestItem[] = []
  const totals: Totals = {
    requestItems,
    requests: 0,
    resources: 0,
    transferred: 0
  }

  resourceEntries.forEach((entry) => {
    addEntrySizesToTotals(totals, entry)
    requestItems.push({
      host: (() => {
        try {
          return new URL(entry.name).hostname
        } catch {
          return ""
        }
      })(),
      resources: Math.max(0, entry.decodedBodySize || entry.encodedBodySize || 0),
      status: "done",
      transferred: Math.max(0, entry.transferSize || 0),
      type: entry.initiatorType || "resource",
      url: entry.name || "(resource)"
    })
  })
  totals.requests += resourceEntries.length

  if (navigationEntry) {
    addEntrySizesToTotals(totals, navigationEntry)
    totals.requests += 1
    requestItems.push({
      host: location.hostname,
      resources: Math.max(
        0,
        navigationEntry.decodedBodySize || navigationEntry.encodedBodySize || 0
      ),
      status: "done",
      transferred: Math.max(0, navigationEntry.transferSize || 0),
      type: "document",
      url: location.href
    })
  }

  return totals
}

const isStandaloneAmsPreviewPage = (): boolean => {
  if (location.hostname !== "ams.creativecdn.com") {
    return false
  }

  if (location.pathname !== "/ad/creatives") {
    return false
  }

  return new URLSearchParams(location.search).get("preview") === "true"
}

const shouldRenderStandaloneBadge = (): boolean =>
  !isIframeContext &&
  standaloneAmsPreviewBadgeEnabled &&
  isStandaloneAmsPreviewPage()

const getNestedAmsPreviewUrl = (): string => {
  const frames = document.querySelectorAll("iframe[src]")
  for (const frame of frames) {
    const iframe = frame as HTMLIFrameElement
    if (!iframe.src) {
      continue
    }

    try {
      const parsed = new URL(iframe.src, window.location.href)
      const isAmsPreview =
        parsed.hostname === "ams.creativecdn.com" &&
        parsed.pathname === AMS_PREVIEW_PATH &&
        parsed.searchParams.get("preview") === "true"

      if (isAmsPreview) {
        return parsed.toString()
      }
    } catch {
      // Ignore malformed src values.
    }
  }

  return ""
}

const getEffectiveAuditUrl = (): string => {
  const nestedAmsUrl = getNestedAmsPreviewUrl()
  if (nestedAmsUrl) {
    return nestedAmsUrl
  }

  return window.location.href
}

const requestOpenInNewTab = (url: string) => {
  if (!url) {
    return
  }

  chrome.runtime.sendMessage({
    type: "ad-auditor/open-tab",
    url
  })
}

const openInNewTab = () => {
  requestOpenInNewTab(getEffectiveAuditUrl())
}

const applyBadgeLayout = (showOpenButton: boolean) => {
  if (!badge || !openButton) {
    return
  }

  openButton.style.display = showOpenButton ? "inline-flex" : "none"
  badge.style.justifyContent = showOpenButton ? "space-between" : "flex-start"
}

const applyBadgeVisibility = (hoverEnabled: boolean) => {
  if (!badge) {
    return
  }

  if (hoverEnabled && displayMode === "inside_hover") {
    badge.style.opacity = isHoverActive ? "1" : "0"
    badge.style.pointerEvents = isHoverActive ? "auto" : "none"
    return
  }

  badge.style.opacity = "1"
  badge.style.pointerEvents = "auto"
}

const ensureBadge = (showOpenButton: boolean) => {
  if (!document.body) {
    return
  }

  if (
    !badge ||
    !requestListContainer ||
    !requestListElement ||
    !requestsValueSpan ||
    !transferredValueSpan ||
    !resourcesValueSpan ||
    !openButton ||
    !badge.isConnected
  ) {
    const nextBadge = document.createElement("div")
    nextBadge.id = BADGE_ID
    nextBadge.setAttribute(
      "style",
      [
        "position: fixed",
        "left: 0",
        "bottom: 0",
        "width: 100%",
        "display: flex",
        "align-items: center",
        "gap: 8px",
        "padding: 4px 8px",
        "box-sizing: border-box",
        "background: rgba(0, 0, 0, 0.8)",
        "color: #7dff6a",
        "font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        "font-size: 11px",
        "line-height: 1.2",
        "z-index: 2147483647",
        "transition: opacity 120ms linear"
      ].join(";")
    )

    const statsContainer = document.createElement("span")
    statsContainer.style.color = "#ffffff"

    const prefix = document.createElement("span")
    prefix.textContent = "Ad-Auditor "

    const nextTransferredValue = document.createElement("span")
    nextTransferredValue.textContent = "0.00 KB"

    const separator = document.createElement("span")
    separator.textContent = " / "

    const nextResourcesValue = document.createElement("span")
    nextResourcesValue.textContent = "0.00 KB"

    const nextRequestsValue = document.createElement("span")
    nextRequestsValue.textContent = " (0 req)"

    statsContainer.append(
      prefix,
      nextTransferredValue,
      separator,
      nextResourcesValue,
      nextRequestsValue
    )

    const nextRequestListContainer = document.createElement("div")
    nextRequestListContainer.setAttribute(
      "style",
      [
        "display: none",
        "position: absolute",
        "left: 0",
        "bottom: 100%",
        "width: 100%",
        "max-height: 220px",
        "overflow: auto",
        "box-sizing: border-box",
        "padding: 6px 8px",
        "background: rgba(0, 0, 0, 0.94)",
        "border-top: 1px solid rgba(125, 255, 106, 0.45)"
      ].join(";")
    )

    const nextRequestList = document.createElement("ul")
    nextRequestList.setAttribute(
      "style",
      "margin:0;padding:0;display:flex;flex-direction:column;gap:2px"
    )
    nextRequestListContainer.appendChild(nextRequestList)

    const nextOpenButton = document.createElement("button")
    nextOpenButton.type = "button"
    nextOpenButton.textContent = "Open"
    nextOpenButton.setAttribute(
      "style",
      [
        "border: 1px solid #7dff6a",
        "background: transparent",
        "color: #7dff6a",
        "border-radius: 4px",
        "padding: 2px 8px",
        "font-size: 11px",
        "line-height: 1.2",
        "cursor: pointer",
        "margin-left: auto"
      ].join(";")
    )
    nextOpenButton.addEventListener("click", openInNewTab)

    nextBadge.append(statsContainer, nextOpenButton, nextRequestListContainer)

    nextBadge.addEventListener("mouseenter", () => {
      if (!requestListContainer || !requestListElement) {
        return
      }

      if (requestListElement.childElementCount > 0) {
        requestListContainer.style.display = "block"
      }
    })

    nextBadge.addEventListener("mouseleave", () => {
      if (requestListContainer) {
        requestListContainer.style.display = "none"
      }
    })

    document.body.appendChild(nextBadge)

    badge = nextBadge
    requestListContainer = nextRequestListContainer
    requestListElement = nextRequestList
    requestsValueSpan = nextRequestsValue
    transferredValueSpan = nextTransferredValue
    resourcesValueSpan = nextResourcesValue
    openButton = nextOpenButton
  }

  applyBadgeLayout(showOpenButton)
}

const removeBadge = () => {
  if (badge) {
    badge.remove()
  }

  badge = null
  requestListContainer = null
  requestListElement = null
  requestsValueSpan = null
  transferredValueSpan = null
  resourcesValueSpan = null
  openButton = null
}

const applyUsageColor = (totals: Totals) => {
  if (!transferredValueSpan || !resourcesValueSpan) {
    return
  }

  const targetValue =
    limitMetric === "resources" ? totals.resources : totals.transferred
  const targetColor = getUsageColor(targetValue, limitBytes)

  if (limitMetric === "resources") {
    transferredValueSpan.style.color = "#ffffff"
    resourcesValueSpan.style.color = targetColor
    return
  }

  transferredValueSpan.style.color = targetColor
  resourcesValueSpan.style.color = "#ffffff"
}

const getSelectedTotals = (): Totals => {
  if (measurementMethod === "enhanced_cdp" && enhancedStatsAvailable) {
    return enhancedTotals
  }

  return legacyTotals
}

const postStatsToTop = (totals: Totals) => {
  if (!isIframeContext || displayMode !== "below_iframe" || window.parent === window) {
    return
  }

  const now = Date.now()
  if (now - lastStatsPostAt < STATS_POST_THROTTLE_MS) {
    return
  }

  lastStatsPostAt = now

  window.parent.postMessage(
    {
      source: SOURCE_ID,
      type: "stats",
      payload: {
        requestCount: totals.requests,
        requestCountText: `${totals.requests} req`,
        requestItems: totals.requestItems,
        resources: totals.resources,
        resourcesText: formatBytes(totals.resources),
        transferred: totals.transferred,
        transferredText: formatBytes(totals.transferred),
        url: getEffectiveAuditUrl()
      }
    },
    "*"
  )
}

const render = () => {
  const totals = getSelectedTotals()
  const transferredText = formatBytes(totals.transferred)
  const resourcesText = formatBytes(totals.resources)

  if (!isIframeContext) {
    if (!shouldRenderStandaloneBadge()) {
      removeBadge()
      return
    }

    ensureBadge(false)
    if (transferredValueSpan) {
      transferredValueSpan.textContent = transferredText
    }
    if (resourcesValueSpan) {
      resourcesValueSpan.textContent = resourcesText
    }
    if (requestsValueSpan) {
      requestsValueSpan.textContent = ` (${totals.requests} req)`
    }
    updateRequestListUi(totals.requestItems)
    applyUsageColor(totals)
    applyBadgeVisibility(false)
    return
  }

  if (displayMode === "below_iframe") {
    removeBadge()
    postStatsToTop(totals)
    return
  }

  ensureBadge(true)
  if (transferredValueSpan) {
    transferredValueSpan.textContent = transferredText
  }
  if (resourcesValueSpan) {
    resourcesValueSpan.textContent = resourcesText
  }
  if (requestsValueSpan) {
    requestsValueSpan.textContent = ` (${totals.requests} req)`
  }
  updateRequestListUi(totals.requestItems)
  applyUsageColor(totals)
  applyBadgeVisibility(true)
}

const updateLegacyTotals = () => {
  legacyTotals = getLegacyTotals()
  render()
}

const requestEnhancedTotalsOnce = () => {
  if (enhancedRequestInFlight) {
    return
  }

  enhancedRequestInFlight = true

  chrome.runtime.sendMessage(
    {
      documentUrl: getEffectiveAuditUrl(),
      type: "ad-auditor/get-enhanced-stats"
    },
    (response) => {
      enhancedRequestInFlight = false

      if (chrome.runtime.lastError) {
        enhancedStatsAvailable = false
        render()
        return
      }

      if (!response?.ok || !response?.available) {
        enhancedStatsAvailable = false
        render()
        return
      }

      const trackedRequests = Math.max(0, Number(response.trackedRequests) || 0)
      const tabTrackedRequests = Math.max(
        0,
        Number(response.tabTrackedRequests) || 0
      )

      if (trackedRequests === 0 && tabTrackedRequests === 0) {
        // Keep last enhanced snapshot to avoid flicker-to-zero between polling intervals.
        if (!enhancedStatsAvailable) {
          render()
        }
        return
      }

      const useTabFallback =
        !isIframeContext && trackedRequests === 0 && tabTrackedRequests > 0
      const selectedRequestItems = (
        useTabFallback ? response.tabRequestDetails : response.requestDetails
      ) as RequestItem[] | undefined

      enhancedTotals = {
        requestItems: Array.isArray(selectedRequestItems)
          ? selectedRequestItems
          : [],
        requests: Math.max(
          0,
          Number(useTabFallback ? response.tabTrackedRequests : response.trackedRequests) || 0
        ),
        resources: Math.max(
          0,
          Number(useTabFallback ? response.tabResources : response.resources) || 0
        ),
        transferred: Math.max(
          0,
          Number(useTabFallback ? response.tabTransferred : response.transferred) || 0
        )
      }
      enhancedStatsAvailable = true
      render()
    }
  )
}

const syncEnhancedPolling = () => {
  if (measurementMethod !== "enhanced_cdp") {
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
  enhancedPollTimerId = window.setInterval(requestEnhancedTotalsOnce, ENHANCED_POLL_MS)
}

const setSettings = (
  nextDisplayMode: DisplayMode,
  nextMeasurementMethod: MeasurementMethod,
  nextStandaloneAmsPreviewBadgeEnabled: boolean,
  nextLimitMetric: LimitMetric,
  nextLimitBytes: number
) => {
  displayMode = nextDisplayMode
  measurementMethod = nextMeasurementMethod
  standaloneAmsPreviewBadgeEnabled = nextStandaloneAmsPreviewBadgeEnabled
  limitMetric = nextLimitMetric
  limitBytes = nextLimitBytes
  syncEnhancedPolling()
  render()
}

const loadSettings = () => {
  chrome.storage.sync.get(
    [
      DISPLAY_MODE_KEY,
      MEASUREMENT_METHOD_KEY,
      STANDALONE_AMS_PREVIEW_BADGE_KEY,
      LIMIT_METRIC_KEY,
      LIMIT_BYTES_KEY
    ],
    (result) => {
      setSettings(
        parseDisplayMode(result[DISPLAY_MODE_KEY]),
        parseMeasurementMethod(result[MEASUREMENT_METHOD_KEY]),
        parseStandaloneAmsPreviewBadgeEnabled(
          result[STANDALONE_AMS_PREVIEW_BADGE_KEY]
        ),
        parseLimitMetric(result[LIMIT_METRIC_KEY]),
        parseLimitBytes(result[LIMIT_BYTES_KEY])
      )
    }
  )
}

const observeSettingsChanges = () => {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") {
      return
    }

    let nextDisplayMode = displayMode
    let nextMeasurementMethod = measurementMethod
    let nextStandaloneAmsPreviewBadgeEnabled = standaloneAmsPreviewBadgeEnabled
    let nextLimitMetric = limitMetric
    let nextLimitBytes = limitBytes

    if (changes[DISPLAY_MODE_KEY]) {
      nextDisplayMode = parseDisplayMode(changes[DISPLAY_MODE_KEY].newValue)
    }

    if (changes[MEASUREMENT_METHOD_KEY]) {
      nextMeasurementMethod = parseMeasurementMethod(
        changes[MEASUREMENT_METHOD_KEY].newValue
      )
    }

    if (changes[STANDALONE_AMS_PREVIEW_BADGE_KEY]) {
      nextStandaloneAmsPreviewBadgeEnabled = parseStandaloneAmsPreviewBadgeEnabled(
        changes[STANDALONE_AMS_PREVIEW_BADGE_KEY].newValue
      )
    }

    if (changes[LIMIT_METRIC_KEY]) {
      nextLimitMetric = parseLimitMetric(changes[LIMIT_METRIC_KEY].newValue)
    }

    if (changes[LIMIT_BYTES_KEY]) {
      nextLimitBytes = parseLimitBytes(changes[LIMIT_BYTES_KEY].newValue)
    }

    setSettings(
      nextDisplayMode,
      nextMeasurementMethod,
      nextStandaloneAmsPreviewBadgeEnabled,
      nextLimitMetric,
      nextLimitBytes
    )
  })
}

const bindHoverMode = () => {
  document.documentElement.addEventListener("mouseenter", () => {
    isHoverActive = true
    applyBadgeVisibility(true)
  })

  document.documentElement.addEventListener("mouseleave", () => {
    isHoverActive = false
    applyBadgeVisibility(true)
  })
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

  const observer = new PerformanceObserver(() => {
    updateLegacyTotals()
  })

  try {
    observer.observe({ type: "resource", buffered: true })
  } catch {
    observer.observe({ entryTypes: ["resource"] })
  }
}

const init = () => {
  const onReady = () => {
    loadSettings()
    observeSettingsChanges()

    if (isIframeContext) {
      bindHoverMode()
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

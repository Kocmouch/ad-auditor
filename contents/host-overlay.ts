import type { PlasmoCSConfig } from "plasmo"

import type { FontMismatch } from "~lib/features/font-checker"
import {
  compareSnapshot as compareSnapshotUtil,
  getSnapshotInfo,
  saveSnapshot as saveSnapshotUtil,
  type Totals
} from "~lib/features/snapshot"
import {
  buildEnglishAlerts,
  buildWaterfallLite,
  filterFocusOffenders
} from "~lib/insights"
import {
  filterAndSortRequestItems,
  getRequestTypes,
  type RequestListItem,
  type RequestSort,
  type RequestStatusFilter
} from "~lib/request-list"
import { DEFAULTS } from "~lib/storage/defaults"
import { STORAGE_KEYS } from "~lib/storage/keys"
import { parsers } from "~lib/storage/parsers"
import type { DisplayMode, LimitMetric } from "~lib/types/settings"
import { getUsageColor } from "~lib/usage-color"
import { formatBytes, shortUrl } from "~lib/utils/formatters"

export const config: PlasmoCSConfig = {
  matches: [
    "https://creatives-preview.rtbhouse.com/*",
    "https://techtools.rtbhouse.biz/*"
  ],
  all_frames: true
}

const SOURCE_ID = "ad-auditor"
const TECHTOOLS_HOSTNAME = "techtools.rtbhouse.biz"
const REQUEST_LIST_LIMIT = 100

type StatsPayload = {
  requestCount: number
  requestItems: RequestItem[]
  requestCountText: string
  resources: number
  resourcesText: string
  transferred: number
  transferredText: string
  url: string
}

type RequestItem = RequestListItem

type BadgeState = {
  alertsContainer: HTMLDivElement
  badge: HTMLDivElement
  hostFilterInput: HTMLInputElement
  isRequestListHoverActive: boolean
  requestCount: number
  requestItems: RequestItem[]
  requestShowAllCheckbox: HTMLInputElement
  requestSortSelect: HTMLSelectElement
  requestSnapshotInfo: HTMLSpanElement
  requestSnapshotRow: HTMLDivElement
  requestSnapshotSaveButton: HTMLButtonElement
  requestSnapshotCompareButton: HTMLButtonElement
  requestStatusSelect: HTMLSelectElement
  requestSummary: HTMLSpanElement
  requestTypeSelect: HTMLSelectElement
  requestWaterfall: HTMLDivElement
  requestList: HTMLUListElement
  requestListContainer: HTMLDivElement
  requestCountValue: HTMLSpanElement
  resources: number
  resourcesValue: HTMLSpanElement
  resizeObserver: ResizeObserver
  transferred: number
  transferredValue: HTMLSpanElement
  url: string
  fontMismatches: FontMismatch[]
  iframe: HTMLIFrameElement
}

const states = new Map<HTMLIFrameElement, BadgeState>()
let displayMode: DisplayMode = DEFAULTS.DISPLAY_MODE
let limitMetric: LimitMetric = DEFAULTS.LIMIT_METRIC
let limitBytes = DEFAULTS.LIMIT_BYTES
let belowIframeFullWidth = DEFAULTS.BELOW_IFRAME_FULL_WIDTH
let snapshotsEnabled = DEFAULTS.ENABLE_SNAPSHOTS
let waterfallEnabled = DEFAULTS.SHOW_WATERFALL
let focusOffendersEnabled = DEFAULTS.FOCUS_OFFENDERS
let alertsEnabled = DEFAULTS.SHOW_ALERTS
let requestListEnabled = DEFAULTS.SHOW_REQUEST_LIST
const savedSnapshotsByUrl = new Map<string, Totals & { capturedAt: number }>()

const syncTypeOptions = (state: BadgeState) => {
  const selectedType = state.requestTypeSelect.value || "all"
  const requestTypes = getRequestTypes(state.requestItems)

  state.requestTypeSelect.textContent = ""
  const allOption = document.createElement("option")
  allOption.value = "all"
  allOption.textContent = "All types"
  state.requestTypeSelect.appendChild(allOption)

  for (const requestType of requestTypes) {
    const option = document.createElement("option")
    option.value = requestType
    option.textContent = requestType
    state.requestTypeSelect.appendChild(option)
  }

  state.requestTypeSelect.value = requestTypes.includes(selectedType)
    ? selectedType
    : "all"
}

const updateSnapshotInfo = (state: BadgeState) => {
  if (!snapshotsEnabled) {
    state.requestSnapshotRow.style.display = "none"
    return
  }

  state.requestSnapshotRow.style.display = "flex"
  const info = getSnapshotInfo(state.url, savedSnapshotsByUrl)
  state.requestSnapshotInfo.textContent = info
}

const saveSnapshot = (state: BadgeState) => {
  if (!state.url) {
    return
  }

  const totals: Totals = {
    requestItems: state.requestItems,
    requests: state.requestCount,
    resources: state.resources,
    transferred: state.transferred
  }

  saveSnapshotUtil(state.url, totals, savedSnapshotsByUrl)
  updateSnapshotInfo(state)
}

const compareSnapshot = (state: BadgeState) => {
  const currentTotals: Totals = {
    requestItems: state.requestItems,
    requests: state.requestCount,
    resources: state.resources,
    transferred: state.transferred
  }

  const result = compareSnapshotUtil(
    state.url,
    currentTotals,
    savedSnapshotsByUrl
  )
  state.requestSnapshotInfo.textContent = result
}

const checkFontsInIframe = (
  iframe: HTMLIFrameElement,
  callback: (mismatches: FontMismatch[], iframeUrl: string) => void
) => {
  const messageHandler = (event: MessageEvent) => {
    if (
      event.data?.type === "ad-auditor-check-fonts-response" &&
      event.source === iframe.contentWindow
    ) {
      window.removeEventListener("message", messageHandler)
      callback(
        event.data.fontMismatches || [],
        event.data.iframeUrl || iframe.src || "unknown"
      )
    }
  }

  window.addEventListener("message", messageHandler)

  setTimeout(() => {
    window.removeEventListener("message", messageHandler)
  }, 5000)

  iframe.contentWindow?.postMessage(
    { type: "ad-auditor-check-fonts-request" },
    "*"
  )
}

const updateAlerts = (state: BadgeState) => {
  if (!alertsEnabled) {
    state.alertsContainer.style.display = "none"
    state.alertsContainer.textContent = ""
    return
  }

  const alerts = buildEnglishAlerts(
    {
      requests: state.requestCount,
      resources: state.resources,
      transferred: state.transferred
    },
    state.requestItems,
    limitBytes
  )

  state.alertsContainer.textContent = ""
  if (alerts.length === 0) {
    state.alertsContainer.style.display = "none"
    return
  }

  state.alertsContainer.style.display = "block"
  for (const alertText of alerts) {
    const row = document.createElement("div")
    row.textContent = `- ${alertText}`
    state.alertsContainer.appendChild(row)
  }
}

const updateRequestList = (state: BadgeState) => {
  if (!requestListEnabled) {
    state.requestListContainer.style.display = "none"
    return
  }

  const sourceItems = focusOffendersEnabled
    ? filterFocusOffenders(state.requestItems, limitBytes)
    : state.requestItems

  syncTypeOptions({
    ...state,
    requestItems: sourceItems
  })
  state.requestList.textContent = ""
  state.requestWaterfall.textContent = ""
  updateSnapshotInfo(state)

  if (sourceItems.length === 0) {
    state.requestSummary.textContent = "0/0 requests"
    state.requestListContainer.style.display = "none"
    state.requestWaterfall.style.display = "none"
    updateAlerts(state)
    return
  }

  const sort = state.requestSortSelect.value
  const status = state.requestStatusSelect.value
  const result = filterAndSortRequestItems(
    sourceItems,
    {
      hostQuery: state.hostFilterInput.value,
      showAll: state.requestShowAllCheckbox.checked,
      sort:
        sort === "resources_desc" || sort === "url_asc"
          ? (sort as RequestSort)
          : "transferred_desc",
      status:
        status === "done" || status === "pending"
          ? (status as RequestStatusFilter)
          : "all",
      type: state.requestTypeSelect.value || "all"
    },
    REQUEST_LIST_LIMIT
  )

  state.requestSummary.textContent = `${result.visibleItems.length}/${result.filteredCount}/${result.totalCount} requests${focusOffendersEnabled ? " (focus)" : ""}`
  state.requestListContainer.style.display = state.isRequestListHoverActive
    ? "flex"
    : "none"

  if (waterfallEnabled) {
    const entries = buildWaterfallLite(result.visibleItems, 5)
    state.requestWaterfall.style.display = entries.length > 0 ? "flex" : "none"
    for (const entry of entries) {
      const row = document.createElement("div")
      row.setAttribute(
        "style",
        "display:flex;align-items:center;gap:6px;font-size:10px;color:#d8dde7"
      )
      const label = document.createElement("span")
      label.textContent = shortUrl(entry.label)
      label.style.width = "130px"
      label.style.flexShrink = "0"
      const barWrap = document.createElement("span")
      barWrap.setAttribute(
        "style",
        "flex:1;height:6px;background:rgba(255,255,255,0.12);border-radius:999px;overflow:hidden"
      )
      const bar = document.createElement("span")
      bar.style.display = "block"
      bar.style.width = `${Math.round(entry.ratio * 100)}%`
      bar.style.height = "100%"
      bar.style.background = "#7dff6a"
      barWrap.appendChild(bar)
      const metric = document.createElement("span")
      metric.textContent = formatBytes(entry.transferred)
      row.append(label, barWrap, metric)
      state.requestWaterfall.appendChild(row)
    }
  } else {
    state.requestWaterfall.style.display = "none"
  }

  for (const item of result.visibleItems) {
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
    state.requestList.appendChild(row)
  }

  if (result.visibleItems.length === 0) {
    const empty = document.createElement("li")
    empty.textContent = "No requests match current filters."
    empty.style.color = "#d8dde7"
    empty.style.listStyle = "none"
    state.requestList.appendChild(empty)
  } else if (result.hasMore && !state.requestShowAllCheckbox.checked) {
    const more = document.createElement("li")
    more.textContent = `Showing top ${REQUEST_LIST_LIMIT}. Enable Show all to see every request.`
    more.style.color = "#d8dde7"
    more.style.listStyle = "none"
    state.requestList.appendChild(more)
  }

  updateAlerts(state)
}

const openUrl = (url: string) => {
  if (!url) {
    return
  }

  chrome.runtime.sendMessage({
    type: "ad-auditor/open-tab",
    url
  })
}

const applyUsageColor = (state: BadgeState) => {
  const value =
    limitMetric === "resources" ? state.resources : state.transferred
  const activeColor = getUsageColor(value, limitBytes)

  if (limitMetric === "resources") {
    state.transferredValue.style.color = "#ffffff"
    state.resourcesValue.style.color = activeColor
    return
  }

  state.transferredValue.style.color = activeColor
  state.resourcesValue.style.color = "#ffffff"
}

const insertBadgeAfterIframe = (
  iframe: HTMLIFrameElement,
  badgeWrapper: HTMLDivElement
) => {
  const parent = iframe.parentElement
  if (!parent) {
    return
  }

  if (badgeWrapper.parentElement !== parent) {
    parent.appendChild(badgeWrapper)
  } else if (badgeWrapper.previousSibling !== iframe) {
    parent.insertBefore(badgeWrapper, iframe.nextSibling)
  }

  if (parent.style.height && parent.style.height !== "auto") {
    parent.style.height = "auto"
  }

  if (!parent.style.width || parent.style.width === "auto") {
    const computedWidth = iframe.getBoundingClientRect().width
    if (computedWidth > 0) {
      parent.style.width = `${computedWidth}px`
    }
  }
}

const syncBadgeWidth = (
  iframe: HTMLIFrameElement,
  badgeWrapper: HTMLDivElement
) => {
  badgeWrapper.style.width = "100%"

  const badge = badgeWrapper.firstElementChild as HTMLDivElement
  if (!badge) return

  const frameWidth = Math.round(iframe.getBoundingClientRect().width)
  const openButton = badge.children[2] as HTMLButtonElement

  if (frameWidth < 250) {
    badge.style.flexDirection = "column"
    badge.style.alignItems = "center"
    badge.style.justifyContent = "center"
    badge.style.gap = "4px"
    badge.style.textAlign = "center"

    if (openButton) {
      openButton.style.marginLeft = "0"
    }
  } else {
    badge.style.flexDirection = "row"
    badge.style.alignItems = "center"
    badge.style.justifyContent = "space-between"
    badge.style.gap = "0"
    badge.style.textAlign = "left"

    if (openButton) {
      openButton.style.marginLeft = "auto"
    }
  }
}

const removeState = (iframe: HTMLIFrameElement) => {
  const state = states.get(iframe)
  if (!state) {
    return
  }

  state.resizeObserver.disconnect()
  state.badge.remove()
  states.delete(iframe)
}

const clearAllBadges = () => {
  Array.from(states.keys()).forEach((iframe) => removeState(iframe))
}

const ensureState = (iframe: HTMLIFrameElement): BadgeState => {
  const current = states.get(iframe)
  if (current) {
    insertBadgeAfterIframe(iframe, current.badge)
    syncBadgeWidth(iframe, current.badge)
    return current
  }

  const badgeWrapper = document.createElement("div")
  badgeWrapper.setAttribute(
    "style",
    [
      "display: flex",
      "flex-direction: column",
      "margin-top: 8px",
      "width: 100%"
    ].join(";")
  )

  const badge = document.createElement("div")
  badge.setAttribute(
    "style",
    [
      "position: relative",
      "display: flex",
      "justify-content: space-between",
      "align-items: center",
      "padding: 4px 8px",
      "box-sizing: border-box",
      "background: rgba(0, 0, 0, 0.8)",
      "color: #7dff6a",
      "font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      "font-size: 11px",
      "line-height: 1.2",
      "z-index: 2147483647"
    ].join(";")
  )

  const statsContainer = document.createElement("span")
  statsContainer.style.color = "#ffffff"

  const prefix = document.createElement("span")
  prefix.textContent = "Ad-Auditor "

  const transferredValue = document.createElement("span")
  transferredValue.textContent = "0.00 KB"

  const separator = document.createElement("span")
  separator.textContent = " / "

  const resourcesValue = document.createElement("span")
  resourcesValue.textContent = "0.00 KB"

  const requestCountValue = document.createElement("span")
  requestCountValue.textContent = " (0 req)"

  // Below iframe mode (host-overlay): compact view like inside iframe
  statsContainer.append(resourcesValue)

  const requestListContainer = document.createElement("div")
  requestListContainer.setAttribute(
    "style",
    [
      "display: none",
      "position: absolute",
      "left: 0",
      "bottom: 100%",
      "width: 100%",
      "max-height: 280px",
      "overflow: auto",
      "box-sizing: border-box",
      "padding: 6px 8px",
      "flex-direction: column",
      "gap: 6px",
      "background: rgba(0, 0, 0, 0.94)",
      "border-top: 1px solid rgba(125, 255, 106, 0.45)"
    ].join(";")
  )

  const requestSnapshotRow = document.createElement("div")
  requestSnapshotRow.setAttribute(
    "style",
    "display:none;align-items:center;gap:6px;flex-wrap:wrap"
  )
  const requestSnapshotSaveButton = document.createElement("button")
  requestSnapshotSaveButton.type = "button"
  requestSnapshotSaveButton.textContent = "Save"
  requestSnapshotSaveButton.setAttribute(
    "style",
    "border:1px solid #7dff6a;background:transparent;color:#7dff6a;border-radius:4px;padding:2px 6px;font-size:10px;line-height:1.2;cursor:pointer"
  )
  const requestSnapshotCompareButton = document.createElement("button")
  requestSnapshotCompareButton.type = "button"
  requestSnapshotCompareButton.textContent = "Compare"
  requestSnapshotCompareButton.setAttribute(
    "style",
    "border:1px solid #7dff6a;background:transparent;color:#7dff6a;border-radius:4px;padding:2px 6px;font-size:10px;line-height:1.2;cursor:pointer"
  )
  const requestSnapshotInfo = document.createElement("span")
  requestSnapshotInfo.textContent = "No snapshot saved"
  requestSnapshotInfo.setAttribute("style", "font-size:10px;color:#d8dde7")
  requestSnapshotRow.append(
    requestSnapshotSaveButton,
    requestSnapshotCompareButton,
    requestSnapshotInfo
  )

  const requestTypeSelect = document.createElement("select")
  requestTypeSelect.setAttribute(
    "style",
    "font-size:10px;background:#0d141f;color:#d8dde7;border:1px solid #345;border-radius:4px;padding:3px 4px"
  )

  const requestStatusSelect = document.createElement("select")
  requestStatusSelect.setAttribute(
    "style",
    "font-size:10px;background:#0d141f;color:#d8dde7;border:1px solid #345;border-radius:4px;padding:3px 4px"
  )
  requestStatusSelect.innerHTML =
    '<option value="all">All statuses</option><option value="done">Done</option><option value="pending">Pending</option>'

  const requestSortSelect = document.createElement("select")
  requestSortSelect.setAttribute(
    "style",
    "font-size:10px;background:#0d141f;color:#d8dde7;border:1px solid #345;border-radius:4px;padding:3px 4px"
  )
  requestSortSelect.innerHTML =
    '<option value="transferred_desc">Sort: transferred</option><option value="resources_desc">Sort: resources</option><option value="url_asc">Sort: url</option>'

  const hostFilterInput = document.createElement("input")
  hostFilterInput.type = "text"
  hostFilterInput.placeholder = "Host filter (contains)"
  hostFilterInput.setAttribute(
    "style",
    "font-size:10px;background:#0d141f;color:#d8dde7;border:1px solid #345;border-radius:4px;padding:3px 4px"
  )

  const requestShowAllLabel = document.createElement("label")
  requestShowAllLabel.setAttribute(
    "style",
    "display:flex;align-items:center;gap:6px;font-size:10px;color:#d8dde7"
  )
  const requestShowAllCheckbox = document.createElement("input")
  requestShowAllCheckbox.type = "checkbox"
  requestShowAllLabel.append(
    requestShowAllCheckbox,
    document.createTextNode("Show all")
  )

  const requestSummary = document.createElement("span")
  requestSummary.textContent = "0/0 requests"
  requestSummary.setAttribute(
    "style",
    "justify-self:end;font-size:10px;color:#9db7d2"
  )

  const requestFiltersBar = document.createElement("div")
  requestFiltersBar.setAttribute(
    "style",
    "display:grid;grid-template-columns:1fr 1fr;gap:6px;align-items:center"
  )
  requestFiltersBar.append(
    requestTypeSelect,
    requestStatusSelect,
    requestSortSelect,
    hostFilterInput,
    requestShowAllLabel,
    requestSummary
  )

  const requestList = document.createElement("ul")
  requestList.setAttribute(
    "style",
    "margin:0;padding:0;display:flex;flex-direction:column;gap:2px"
  )
  const requestWaterfall = document.createElement("div")
  requestWaterfall.setAttribute(
    "style",
    "display:none;flex-direction:column;gap:4px;padding:4px 0;border-top:1px dashed rgba(125,255,106,0.35)"
  )
  requestListContainer.append(
    requestSnapshotRow,
    requestFiltersBar,
    requestWaterfall,
    requestList
  )

  const openButton = document.createElement("button")
  openButton.type = "button"
  openButton.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`
  openButton.title = "Open in new tab"
  openButton.setAttribute(
    "style",
    [
      "border: 1px solid #7dff6a",
      "background: transparent",
      "color: #7dff6a",
      "border-radius: 4px",
      "padding: 4px",
      "font-size: 11px",
      "line-height: 0",
      "cursor: pointer",
      "margin-left: auto",
      "display: flex",
      "align-items: center",
      "justify-content: center"
    ].join(";")
  )

  const checkFontsButton = document.createElement("button")
  checkFontsButton.type = "button"
  checkFontsButton.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>`
  checkFontsButton.title = "Check fonts"
  checkFontsButton.setAttribute(
    "style",
    [
      "border: 1px solid #7dff6a",
      "background: transparent",
      "color: #7dff6a",
      "border-radius: 4px",
      "padding: 4px",
      "font-size: 11px",
      "line-height: 0",
      "cursor: pointer",
      "display: flex",
      "align-items: center",
      "justify-content: center"
    ].join(";")
  )

  const middleButtonsGroup = document.createElement("div")
  middleButtonsGroup.setAttribute(
    "style",
    [
      "display: flex",
      "gap: 4px",
      "align-items: center",
      "flex: 1",
      "justify-content: center"
    ].join(";")
  )

  const alertsContainer = document.createElement("div")
  alertsContainer.setAttribute(
    "style",
    [
      "display:none",
      "padding:4px 8px",
      "background:rgba(0,0,0,0.88)",
      "border-top:1px solid rgba(125,255,106,0.35)",
      "font-size:10px",
      "line-height:1.35",
      "color:#d8dde7"
    ].join(";")
  )

  const resizeObserver = new ResizeObserver(() => {
    syncBadgeWidth(iframe, badge)
  })

  const state: BadgeState = {
    alertsContainer,
    badge: badgeWrapper,
    hostFilterInput,
    isRequestListHoverActive: false,
    requestCount: 0,
    requestItems: [],
    requestShowAllCheckbox,
    requestSortSelect,
    requestSnapshotInfo,
    requestSnapshotRow,
    requestSnapshotSaveButton,
    requestSnapshotCompareButton,
    requestStatusSelect,
    requestSummary,
    requestTypeSelect,
    requestWaterfall,
    requestList,
    requestListContainer,
    requestCountValue,
    resources: 0,
    resourcesValue,
    resizeObserver,
    transferred: 0,
    transferredValue,
    url: "",
    fontMismatches: [],
    iframe
  }

  requestTypeSelect.addEventListener("change", () => updateRequestList(state))
  requestStatusSelect.addEventListener("change", () => updateRequestList(state))
  requestSortSelect.addEventListener("change", () => updateRequestList(state))
  hostFilterInput.addEventListener("input", () => updateRequestList(state))
  requestShowAllCheckbox.addEventListener("change", () =>
    updateRequestList(state)
  )
  requestSnapshotSaveButton.addEventListener("click", () => saveSnapshot(state))
  requestSnapshotCompareButton.addEventListener("click", () =>
    compareSnapshot(state)
  )

  openButton.addEventListener("click", () => openUrl(state.url))
  checkFontsButton.addEventListener("click", () => {
    checkFontsInIframe(iframe, (fontMismatches, iframeUrl) => {
      state.fontMismatches = fontMismatches

      // Send message to creatives-host.ts to display results
      const iframes = Array.from(
        document.querySelectorAll<HTMLIFrameElement>("iframe")
      )
      const iframeIndex = iframes.indexOf(iframe)

      window.postMessage(
        {
          type: "ad-auditor-font-check-results",
          fontMismatches: fontMismatches,
          iframeUrl: iframeUrl,
          iframeIndex: iframeIndex
        },
        "*"
      )
    })
  })
  badgeWrapper.addEventListener("mouseenter", () => {
    state.isRequestListHoverActive = true
    updateRequestList(state)
  })
  badgeWrapper.addEventListener("mouseleave", () => {
    state.isRequestListHoverActive = false
    state.requestListContainer.style.display = "none"
  })

  badge.append(
    statsContainer,
    middleButtonsGroup,
    openButton,
    requestListContainer
  )
  middleButtonsGroup.append(checkFontsButton)
  badgeWrapper.append(badge, alertsContainer)

  insertBadgeAfterIframe(iframe, badgeWrapper)
  syncBadgeWidth(iframe, badgeWrapper)
  resizeObserver.observe(iframe)

  states.set(iframe, state)
  return state
}

const findIframeBySourceWindow = (
  sourceWindow: MessageEventSource | null
): HTMLIFrameElement | null => {
  if (!sourceWindow || typeof sourceWindow === "string") {
    return null
  }

  const frames = document.querySelectorAll("iframe")

  for (const frame of frames) {
    if (frame.contentWindow === sourceWindow) {
      return frame
    }
  }

  return null
}

const isValidIframeContext = (iframe: HTMLIFrameElement): boolean => {
  if (location.hostname === "creatives-preview.rtbhouse.com") {
    return true
  }

  if (location.hostname === TECHTOOLS_HOSTNAME) {
    return iframe.closest(".adturbo-preview") !== null
  }

  return false
}

const cleanupDetachedFrames = () => {
  Array.from(states.keys()).forEach((iframe) => {
    if (!iframe.isConnected || !isValidIframeContext(iframe)) {
      removeState(iframe)
      return
    }

    const state = states.get(iframe)
    if (!state) {
      return
    }

    insertBadgeAfterIframe(iframe, state.badge)
    syncBadgeWidth(iframe, state.badge)
  })
}

const refreshAllColors = () => {
  for (const state of states.values()) {
    applyUsageColor(state)
  }
}

const refreshAllDetails = () => {
  for (const state of states.values()) {
    updateRequestList(state)
  }
}

const refreshAllBadgeWidths = () => {
  for (const [iframe, state] of states) {
    syncBadgeWidth(iframe, state.badge)
  }
}

const handleStatsMessage = (event: MessageEvent) => {
  if (displayMode !== "below_iframe") {
    return
  }

  if (
    !event.data ||
    event.data.source !== SOURCE_ID ||
    event.data.type !== "stats"
  ) {
    return
  }

  const payload = event.data.payload as StatsPayload | undefined
  if (!payload) {
    return
  }

  const iframe = findIframeBySourceWindow(event.source)
  if (!iframe || !isValidIframeContext(iframe)) {
    return
  }

  const state = ensureState(iframe)
  state.url = payload.url
  state.requestCount = Math.max(0, Number(payload.requestCount) || 0)
  state.requestItems = Array.isArray(payload.requestItems)
    ? payload.requestItems
    : []
  state.transferred = Math.max(0, Number(payload.transferred) || 0)
  state.resources = Math.max(0, Number(payload.resources) || 0)
  state.transferredValue.textContent = payload.transferredText
  state.resourcesValue.textContent = payload.resourcesText
  state.requestCountValue.textContent = ` (${payload.requestCountText || `${state.requestCount} req`})`
  updateRequestList(state)
  applyUsageColor(state)
}

const setSettings = (
  nextDisplayMode: DisplayMode,
  nextLimitMetric: LimitMetric,
  nextLimitBytes: number,
  nextBelowIframeFullWidth: boolean,
  nextSnapshotsEnabled: boolean,
  nextWaterfallEnabled: boolean,
  nextFocusOffendersEnabled: boolean,
  nextAlertsEnabled: boolean,
  nextRequestListEnabled: boolean
) => {
  displayMode = nextDisplayMode
  limitMetric = nextLimitMetric
  limitBytes = nextLimitBytes
  belowIframeFullWidth = nextBelowIframeFullWidth
  snapshotsEnabled = nextSnapshotsEnabled
  waterfallEnabled = nextWaterfallEnabled
  focusOffendersEnabled = nextFocusOffendersEnabled
  alertsEnabled = nextAlertsEnabled
  requestListEnabled = nextRequestListEnabled

  if (displayMode !== "below_iframe") {
    clearAllBadges()
    return
  }

  refreshAllColors()
  refreshAllBadgeWidths()
  refreshAllDetails()
}

const loadSettings = () => {
  chrome.storage.sync.get(
    [
      STORAGE_KEYS.DISPLAY_MODE,
      STORAGE_KEYS.LIMIT_METRIC,
      STORAGE_KEYS.LIMIT_BYTES,
      STORAGE_KEYS.BELOW_IFRAME_FULL_WIDTH,
      STORAGE_KEYS.ENABLE_SNAPSHOTS,
      STORAGE_KEYS.SHOW_WATERFALL,
      STORAGE_KEYS.FOCUS_OFFENDERS,
      STORAGE_KEYS.SHOW_ALERTS,
      STORAGE_KEYS.SHOW_REQUEST_LIST
    ],
    (result) => {
      setSettings(
        parsers.displayMode(result[STORAGE_KEYS.DISPLAY_MODE]),
        parsers.limitMetric(result[STORAGE_KEYS.LIMIT_METRIC]),
        parsers.limitBytes(result[STORAGE_KEYS.LIMIT_BYTES]),
        parsers.belowIframeFullWidth(
          result[STORAGE_KEYS.BELOW_IFRAME_FULL_WIDTH]
        ),
        parsers.enableSnapshots(result[STORAGE_KEYS.ENABLE_SNAPSHOTS]),
        parsers.showWaterfall(result[STORAGE_KEYS.SHOW_WATERFALL]),
        parsers.focusOffenders(result[STORAGE_KEYS.FOCUS_OFFENDERS]),
        parsers.showAlerts(result[STORAGE_KEYS.SHOW_ALERTS]),
        parsers.showRequestList(result[STORAGE_KEYS.SHOW_REQUEST_LIST])
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
    let nextLimitMetric = limitMetric
    let nextLimitBytes = limitBytes
    let nextBelowIframeFullWidth = belowIframeFullWidth
    let nextSnapshotsEnabled = snapshotsEnabled
    let nextWaterfallEnabled = waterfallEnabled
    let nextFocusOffendersEnabled = focusOffendersEnabled
    let nextAlertsEnabled = alertsEnabled
    let nextRequestListEnabled = requestListEnabled

    if (changes[STORAGE_KEYS.DISPLAY_MODE]) {
      nextDisplayMode = parsers.displayMode(
        changes[STORAGE_KEYS.DISPLAY_MODE].newValue
      )
    }

    if (changes[STORAGE_KEYS.LIMIT_METRIC]) {
      nextLimitMetric = parsers.limitMetric(
        changes[STORAGE_KEYS.LIMIT_METRIC].newValue
      )
    }

    if (changes[STORAGE_KEYS.LIMIT_BYTES]) {
      nextLimitBytes = parsers.limitBytes(
        changes[STORAGE_KEYS.LIMIT_BYTES].newValue
      )
    }

    if (changes[STORAGE_KEYS.BELOW_IFRAME_FULL_WIDTH]) {
      nextBelowIframeFullWidth = parsers.belowIframeFullWidth(
        changes[STORAGE_KEYS.BELOW_IFRAME_FULL_WIDTH].newValue
      )
    }

    if (changes[STORAGE_KEYS.ENABLE_SNAPSHOTS]) {
      nextSnapshotsEnabled = parsers.enableSnapshots(
        changes[STORAGE_KEYS.ENABLE_SNAPSHOTS].newValue
      )
    }

    if (changes[STORAGE_KEYS.SHOW_WATERFALL]) {
      nextWaterfallEnabled = parsers.showWaterfall(
        changes[STORAGE_KEYS.SHOW_WATERFALL].newValue
      )
    }

    if (changes[STORAGE_KEYS.FOCUS_OFFENDERS]) {
      nextFocusOffendersEnabled = parsers.focusOffenders(
        changes[STORAGE_KEYS.FOCUS_OFFENDERS].newValue
      )
    }

    if (changes[STORAGE_KEYS.SHOW_ALERTS]) {
      nextAlertsEnabled = parsers.showAlerts(
        changes[STORAGE_KEYS.SHOW_ALERTS].newValue
      )
    }

    if (changes[STORAGE_KEYS.SHOW_REQUEST_LIST]) {
      nextRequestListEnabled = parsers.showRequestList(
        changes[STORAGE_KEYS.SHOW_REQUEST_LIST].newValue
      )
    }

    setSettings(
      nextDisplayMode,
      nextLimitMetric,
      nextLimitBytes,
      nextBelowIframeFullWidth,
      nextSnapshotsEnabled,
      nextWaterfallEnabled,
      nextFocusOffendersEnabled,
      nextAlertsEnabled,
      nextRequestListEnabled
    )
  })
}

const init = () => {
  // Only run if we are NOT in an iframe (we are on main page)
  if (window.self !== window.top) {
    return
  }

  loadSettings()
  observeSettingsChanges()
  window.addEventListener("message", handleStatsMessage)

  const mutationObserver = new MutationObserver(() => {
    cleanupDetachedFrames()
  })

  mutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true
  })
}

init()

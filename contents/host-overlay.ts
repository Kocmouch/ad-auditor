import type { PlasmoCSConfig } from "plasmo"

import {
  BELOW_IFRAME_FULL_WIDTH_KEY,
  DEFAULT_BELOW_IFRAME_FULL_WIDTH,
  DEFAULT_ENABLE_SNAPSHOTS,
  DEFAULT_FOCUS_OFFENDERS,
  DEFAULT_LIMIT_BYTES,
  DEFAULT_LIMIT_METRIC,
  DEFAULT_SHOW_ALERTS,
  DEFAULT_SHOW_WATERFALL,
  DEFAULT_DISPLAY_MODE,
  DISPLAY_MODE_KEY,
  ENABLE_SNAPSHOTS_KEY,
  FOCUS_OFFENDERS_KEY,
  LIMIT_BYTES_KEY,
  LIMIT_METRIC_KEY,
  SHOW_ALERTS_KEY,
  SHOW_WATERFALL_KEY,
  type DisplayMode,
  type LimitMetric,
  parseDisplayMode,
  parseBelowIframeFullWidth,
  parseEnableSnapshots,
  parseFocusOffenders,
  parseShowAlerts,
  parseLimitBytes,
  parseLimitMetric,
  parseShowWaterfall
} from "~lib/display-mode"
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
import { getUsageColor } from "~lib/usage-color"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
}

const SOURCE_ID = "ad-auditor"
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
}

const states = new Map<HTMLIFrameElement, BadgeState>()
let displayMode: DisplayMode = DEFAULT_DISPLAY_MODE
let limitMetric: LimitMetric = DEFAULT_LIMIT_METRIC
let limitBytes = DEFAULT_LIMIT_BYTES
let belowIframeFullWidth = DEFAULT_BELOW_IFRAME_FULL_WIDTH
let snapshotsEnabled = DEFAULT_ENABLE_SNAPSHOTS
let waterfallEnabled = DEFAULT_SHOW_WATERFALL
let focusOffendersEnabled = DEFAULT_FOCUS_OFFENDERS
let alertsEnabled = DEFAULT_SHOW_ALERTS
const savedSnapshotsByUrl = new Map<
  string,
  { capturedAt: number; requestCount: number; resources: number; transferred: number }
>()

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
  const existing = savedSnapshotsByUrl.get(state.url)
  state.requestSnapshotInfo.textContent = existing
    ? `Saved ${new Date(existing.capturedAt).toLocaleTimeString()}`
    : "No snapshot saved"
}

const saveSnapshot = (state: BadgeState) => {
  if (!state.url) {
    return
  }

  savedSnapshotsByUrl.set(state.url, {
    capturedAt: Date.now(),
    requestCount: state.requestCount,
    resources: state.resources,
    transferred: state.transferred
  })
  updateSnapshotInfo(state)
}

const compareSnapshot = (state: BadgeState) => {
  if (!state.url) {
    state.requestSnapshotInfo.textContent = "No snapshot target URL available."
    return
  }

  const existing = savedSnapshotsByUrl.get(state.url)
  if (!existing) {
    state.requestSnapshotInfo.textContent = "No snapshot saved for this URL."
    return
  }

  const reqDelta = state.requestCount - existing.requestCount
  const trDelta = Math.round((state.transferred - existing.transferred) / 1024)
  const resDelta = Math.round((state.resources - existing.resources) / 1024)
  const withSign = (value: number) => (value >= 0 ? `+${value}` : `${value}`)

  state.requestSnapshotInfo.textContent = `delta req ${withSign(reqDelta)}, delta tr ${withSign(trDelta)} KB, delta res ${withSign(resDelta)} KB`
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
  const value = limitMetric === "resources" ? state.resources : state.transferred
  const activeColor = getUsageColor(value, limitBytes)

  if (limitMetric === "resources") {
    state.transferredValue.style.color = "#ffffff"
    state.resourcesValue.style.color = activeColor
    return
  }

  state.transferredValue.style.color = activeColor
  state.resourcesValue.style.color = "#ffffff"
}

const insertBadgeAfterIframe = (iframe: HTMLIFrameElement, badge: HTMLDivElement) => {
  const parent = iframe.parentElement
  if (!parent) {
    return
  }

  if (badge.parentElement !== parent || badge.previousSibling !== iframe) {
    parent.insertBefore(badge, iframe.nextSibling)
  }
}

const syncBadgeWidth = (iframe: HTMLIFrameElement, badge: HTMLDivElement) => {
  if (belowIframeFullWidth) {
    badge.style.width = "100%"
    return
  }

  const frameWidth = Math.round(iframe.getBoundingClientRect().width)
  badge.style.width = `${Math.max(frameWidth, 140)}px`
}

const removeState = (iframe: HTMLIFrameElement) => {
  const state = states.get(iframe)
  if (!state) {
    return
  }

  state.resizeObserver.disconnect()
  state.badge.remove()
  state.alertsContainer.remove()
  states.delete(iframe)
}

const clearAllBadges = () => {
  Array.from(states.keys()).forEach((iframe) => removeState(iframe))
}

const ensureState = (iframe: HTMLIFrameElement): BadgeState => {
  const current = states.get(iframe)
  if (current) {
    insertBadgeAfterIframe(iframe, current.badge)
    if (current.alertsContainer.previousSibling !== current.badge) {
      current.badge.insertAdjacentElement("afterend", current.alertsContainer)
    }
    syncBadgeWidth(iframe, current.badge)
    return current
  }

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
      "margin-top: 2px",
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

  statsContainer.append(
    prefix,
    transferredValue,
    separator,
    resourcesValue,
    requestCountValue
  )

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
  openButton.textContent = "Open"
  openButton.setAttribute(
    "style",
    [
      "border: 1px solid #7dff6a",
      "background: transparent",
      "color: #7dff6a",
      "border-radius: 4px",
      "padding: 2px 8px",
      "font-size: 11px",
      "line-height: 1.2",
      "cursor: pointer"
    ].join(";")
  )

  const alertsContainer = document.createElement("div")
  alertsContainer.setAttribute(
    "style",
    [
      "display:none",
      "padding:4px 8px",
      "margin-top:2px",
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
    badge,
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
    url: ""
  }

  requestTypeSelect.addEventListener("change", () => updateRequestList(state))
  requestStatusSelect.addEventListener("change", () => updateRequestList(state))
  requestSortSelect.addEventListener("change", () => updateRequestList(state))
  hostFilterInput.addEventListener("input", () => updateRequestList(state))
  requestShowAllCheckbox.addEventListener("change", () => updateRequestList(state))
  requestSnapshotSaveButton.addEventListener("click", () => saveSnapshot(state))
  requestSnapshotCompareButton.addEventListener("click", () => compareSnapshot(state))

  openButton.addEventListener("click", () => openUrl(state.url))
  badge.addEventListener("mouseenter", () => {
    state.isRequestListHoverActive = true
    updateRequestList(state)
  })
  badge.addEventListener("mouseleave", () => {
    state.isRequestListHoverActive = false
    state.requestListContainer.style.display = "none"
  })

  badge.append(statsContainer, openButton, requestListContainer)

  insertBadgeAfterIframe(iframe, badge)
  badge.insertAdjacentElement("afterend", alertsContainer)
  syncBadgeWidth(iframe, badge)
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

const cleanupDetachedFrames = () => {
  Array.from(states.keys()).forEach((iframe) => {
    if (!iframe.isConnected) {
      removeState(iframe)
      return
    }

    const state = states.get(iframe)
    if (!state) {
      return
    }

    insertBadgeAfterIframe(iframe, state.badge)
    if (state.alertsContainer.previousSibling !== state.badge) {
      state.badge.insertAdjacentElement("afterend", state.alertsContainer)
    }
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

  if (!event.data || event.data.source !== SOURCE_ID || event.data.type !== "stats") {
    return
  }

  const payload = event.data.payload as StatsPayload | undefined
  if (!payload) {
    return
  }

  const iframe = findIframeBySourceWindow(event.source)
  if (!iframe) {
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
  nextAlertsEnabled: boolean
) => {
  displayMode = nextDisplayMode
  limitMetric = nextLimitMetric
  limitBytes = nextLimitBytes
  belowIframeFullWidth = nextBelowIframeFullWidth
  snapshotsEnabled = nextSnapshotsEnabled
  waterfallEnabled = nextWaterfallEnabled
  focusOffendersEnabled = nextFocusOffendersEnabled
  alertsEnabled = nextAlertsEnabled

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
      DISPLAY_MODE_KEY,
      LIMIT_METRIC_KEY,
      LIMIT_BYTES_KEY,
      BELOW_IFRAME_FULL_WIDTH_KEY,
      ENABLE_SNAPSHOTS_KEY,
      SHOW_WATERFALL_KEY,
      FOCUS_OFFENDERS_KEY,
      SHOW_ALERTS_KEY
    ],
    (result) => {
      setSettings(
        parseDisplayMode(result[DISPLAY_MODE_KEY]),
        parseLimitMetric(result[LIMIT_METRIC_KEY]),
        parseLimitBytes(result[LIMIT_BYTES_KEY]),
        parseBelowIframeFullWidth(result[BELOW_IFRAME_FULL_WIDTH_KEY]),
        parseEnableSnapshots(result[ENABLE_SNAPSHOTS_KEY]),
        parseShowWaterfall(result[SHOW_WATERFALL_KEY]),
        parseFocusOffenders(result[FOCUS_OFFENDERS_KEY]),
        parseShowAlerts(result[SHOW_ALERTS_KEY])
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

    if (changes[DISPLAY_MODE_KEY]) {
      nextDisplayMode = parseDisplayMode(changes[DISPLAY_MODE_KEY].newValue)
    }

    if (changes[LIMIT_METRIC_KEY]) {
      nextLimitMetric = parseLimitMetric(changes[LIMIT_METRIC_KEY].newValue)
    }

    if (changes[LIMIT_BYTES_KEY]) {
      nextLimitBytes = parseLimitBytes(changes[LIMIT_BYTES_KEY].newValue)
    }

    if (changes[BELOW_IFRAME_FULL_WIDTH_KEY]) {
      nextBelowIframeFullWidth = parseBelowIframeFullWidth(
        changes[BELOW_IFRAME_FULL_WIDTH_KEY].newValue
      )
    }

    if (changes[ENABLE_SNAPSHOTS_KEY]) {
      nextSnapshotsEnabled = parseEnableSnapshots(
        changes[ENABLE_SNAPSHOTS_KEY].newValue
      )
    }

    if (changes[SHOW_WATERFALL_KEY]) {
      nextWaterfallEnabled = parseShowWaterfall(changes[SHOW_WATERFALL_KEY].newValue)
    }

    if (changes[FOCUS_OFFENDERS_KEY]) {
      nextFocusOffendersEnabled = parseFocusOffenders(
        changes[FOCUS_OFFENDERS_KEY].newValue
      )
    }

    if (changes[SHOW_ALERTS_KEY]) {
      nextAlertsEnabled = parseShowAlerts(changes[SHOW_ALERTS_KEY].newValue)
    }

    setSettings(
      nextDisplayMode,
      nextLimitMetric,
      nextLimitBytes,
      nextBelowIframeFullWidth,
      nextSnapshotsEnabled,
      nextWaterfallEnabled,
      nextFocusOffendersEnabled,
      nextAlertsEnabled
    )
  })
}

const init = () => {
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

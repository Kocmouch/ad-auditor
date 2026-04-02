import type { PlasmoCSConfig } from "plasmo"

import {
  BELOW_IFRAME_FULL_WIDTH_KEY,
  DEFAULT_BELOW_IFRAME_FULL_WIDTH,
  DEFAULT_LIMIT_BYTES,
  DEFAULT_LIMIT_METRIC,
  DEFAULT_DISPLAY_MODE,
  DISPLAY_MODE_KEY,
  LIMIT_BYTES_KEY,
  LIMIT_METRIC_KEY,
  type DisplayMode,
  type LimitMetric,
  parseDisplayMode,
  parseBelowIframeFullWidth,
  parseLimitBytes,
  parseLimitMetric
} from "~lib/display-mode"
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
  badge: HTMLDivElement
  hostFilterInput: HTMLInputElement
  isRequestListHoverActive: boolean
  requestCount: number
  requestItems: RequestItem[]
  requestShowAllCheckbox: HTMLInputElement
  requestSortSelect: HTMLSelectElement
  requestStatusSelect: HTMLSelectElement
  requestSummary: HTMLSpanElement
  requestTypeSelect: HTMLSelectElement
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

const updateRequestList = (state: BadgeState) => {
  syncTypeOptions(state)
  state.requestList.textContent = ""

  if (state.requestItems.length === 0) {
    state.requestSummary.textContent = "0/0 requests"
    state.requestListContainer.style.display = "none"
    return
  }

  const sort = state.requestSortSelect.value
  const status = state.requestStatusSelect.value
  const result = filterAndSortRequestItems(
    state.requestItems,
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

  state.requestSummary.textContent = `${result.visibleItems.length}/${result.filteredCount}/${result.totalCount} requests`
  state.requestListContainer.style.display = state.isRequestListHoverActive
    ? "flex"
    : "none"

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
      "max-height: 220px",
      "overflow: auto",
      "box-sizing: border-box",
      "padding: 6px 8px",
      "flex-direction: column",
      "gap: 6px",
      "background: rgba(0, 0, 0, 0.94)",
      "border-top: 1px solid rgba(125, 255, 106, 0.45)"
    ].join(";")
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
  requestListContainer.append(requestFiltersBar, requestList)

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

  const resizeObserver = new ResizeObserver(() => {
    syncBadgeWidth(iframe, badge)
  })

  const state: BadgeState = {
    badge,
    hostFilterInput,
    isRequestListHoverActive: false,
    requestCount: 0,
    requestItems: [],
    requestShowAllCheckbox,
    requestSortSelect,
    requestStatusSelect,
    requestSummary,
    requestTypeSelect,
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
    syncBadgeWidth(iframe, state.badge)
  })
}

const refreshAllColors = () => {
  for (const state of states.values()) {
    applyUsageColor(state)
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
  nextBelowIframeFullWidth: boolean
) => {
  displayMode = nextDisplayMode
  limitMetric = nextLimitMetric
  limitBytes = nextLimitBytes
  belowIframeFullWidth = nextBelowIframeFullWidth

  if (displayMode !== "below_iframe") {
    clearAllBadges()
    return
  }

  refreshAllColors()
  refreshAllBadgeWidths()
}

const loadSettings = () => {
  chrome.storage.sync.get(
    [
      DISPLAY_MODE_KEY,
      LIMIT_METRIC_KEY,
      LIMIT_BYTES_KEY,
      BELOW_IFRAME_FULL_WIDTH_KEY
    ],
    (result) => {
      setSettings(
        parseDisplayMode(result[DISPLAY_MODE_KEY]),
        parseLimitMetric(result[LIMIT_METRIC_KEY]),
        parseLimitBytes(result[LIMIT_BYTES_KEY]),
        parseBelowIframeFullWidth(result[BELOW_IFRAME_FULL_WIDTH_KEY])
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

    setSettings(
      nextDisplayMode,
      nextLimitMetric,
      nextLimitBytes,
      nextBelowIframeFullWidth
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

import type { PlasmoCSConfig } from "plasmo"

import {
  getDefaultContentSettings,
  watchContentSettings,
  type ContentSettings
} from "~lib/content-settings"
import {
  compareSnapshot as compareSnapshotUtil,
  getSnapshotInfo,
  saveSnapshot as saveSnapshotUtil,
  type Totals
} from "~lib/features/snapshot"
import { buildEnglishAlerts } from "~lib/insights"
import {
  parseWindowMessage,
  postToFrame,
  postToSelf,
  rememberFrameOrigin,
  resolveSenderIframe,
  sendOpenTab,
  WINDOW_MESSAGE,
  type WireFontMismatch
} from "~lib/messaging"
import type { RequestListItem } from "~lib/request-list"
import { applyUsageColors, renderAlertLines } from "~lib/ui/badge-parts"
import {
  createOverlayBadge,
  insertBadgeAfterIframe,
  syncOverlayBadgeLayout,
  type OverlayBadge
} from "~lib/ui/overlay-badge"
import { updateRequestPanel, updateSnapshotRow } from "~lib/ui/request-panel"

export const config: PlasmoCSConfig = {
  matches: [
    "https://creatives-preview.rtbhouse.com/*",
    "https://techtools.rtbhouse.biz/*"
  ],
  all_frames: true
}

const TECHTOOLS_HOSTNAME = "techtools.rtbhouse.biz"
const FONT_CHECK_TIMEOUT_MS = 5000

type BadgeState = {
  iframe: HTMLIFrameElement
  isRequestListHoverActive: boolean
  parts: OverlayBadge
  requestCount: number
  requestItems: RequestListItem[]
  resizeObserver: ResizeObserver
  resources: number
  transferred: number
  url: string
}

const states = new Map<HTMLIFrameElement, BadgeState>()
let settings: ContentSettings = getDefaultContentSettings()
const savedSnapshotsByUrl = new Map<string, Totals & { capturedAt: number }>()

const getStateTotals = (state: BadgeState): Totals => ({
  requestItems: state.requestItems,
  requests: state.requestCount,
  resources: state.resources,
  transferred: state.transferred
})

const updateAlerts = (state: BadgeState) => {
  const { alerts } = state.parts
  if (!settings.alertsEnabled) {
    alerts.style.display = "none"
    alerts.textContent = ""
    return
  }

  renderAlertLines(
    alerts,
    buildEnglishAlerts(
      getStateTotals(state),
      state.requestItems,
      settings.limitBytes
    )
  )
}

const updateRequestList = (state: BadgeState) => {
  const sourceItems = updateRequestPanel(state.parts.panel, {
    enabled: settings.requestListEnabled,
    focusOffenders: settings.focusOffendersEnabled,
    hoverActive: state.isRequestListHoverActive,
    items: state.requestItems,
    limitBytes: settings.limitBytes,
    waterfallEnabled: settings.waterfallEnabled
  })
  if (sourceItems === null) {
    return
  }

  updateSnapshotRow(
    state.parts.panel,
    settings.snapshotsEnabled,
    getSnapshotInfo(state.url, savedSnapshotsByUrl)
  )
  updateAlerts(state)
}

const saveSnapshot = (state: BadgeState) => {
  if (!state.url) {
    return
  }

  saveSnapshotUtil(state.url, getStateTotals(state), savedSnapshotsByUrl)
  updateSnapshotRow(
    state.parts.panel,
    settings.snapshotsEnabled,
    getSnapshotInfo(state.url, savedSnapshotsByUrl)
  )
}

const compareSnapshot = (state: BadgeState) => {
  state.parts.panel.snapshotInfo.textContent = compareSnapshotUtil(
    state.url,
    getStateTotals(state),
    savedSnapshotsByUrl
  )
}

const requestFontCheck = (
  iframe: HTMLIFrameElement,
  callback: (mismatches: WireFontMismatch[], iframeUrl: string) => void
) => {
  const handler = (event: MessageEvent) => {
    if (event.source !== iframe.contentWindow) {
      return
    }

    const message = parseWindowMessage(event.data)
    if (message?.type !== WINDOW_MESSAGE.CHECK_FONTS_RESPONSE) {
      return
    }

    rememberFrameOrigin(event.source, event.origin)
    window.removeEventListener("message", handler)
    callback(message.fontMismatches, message.iframeUrl || iframe.src || "unknown")
  }

  window.addEventListener("message", handler)
  setTimeout(
    () => window.removeEventListener("message", handler),
    FONT_CHECK_TIMEOUT_MS
  )

  postToFrame(iframe, { type: WINDOW_MESSAGE.CHECK_FONTS_REQUEST })
}

const removeState = (iframe: HTMLIFrameElement) => {
  const state = states.get(iframe)
  if (!state) {
    return
  }

  state.resizeObserver.disconnect()
  state.parts.wrapper.remove()
  states.delete(iframe)
}

const syncBadge = (state: BadgeState) => {
  insertBadgeAfterIframe(state.iframe, state.parts.wrapper)
  syncOverlayBadgeLayout(state.iframe, state.parts)
}

const ensureState = (iframe: HTMLIFrameElement): BadgeState => {
  const current = states.get(iframe)
  if (current) {
    syncBadge(current)
    return current
  }

  const withState = (action: (state: BadgeState) => void) => () => {
    const state = states.get(iframe)
    if (state) {
      action(state)
    }
  }

  const parts = createOverlayBadge({
    onCompareSnapshot: withState(compareSnapshot),
    onControlChange: withState(updateRequestList),
    onSaveSnapshot: withState(saveSnapshot)
  })

  const state: BadgeState = {
    iframe,
    isRequestListHoverActive: false,
    parts,
    requestCount: 0,
    requestItems: [],
    resizeObserver: new ResizeObserver(() =>
      syncOverlayBadgeLayout(iframe, parts)
    ),
    resources: 0,
    transferred: 0,
    url: ""
  }

  parts.openButton.addEventListener("click", () => sendOpenTab(state.url))
  parts.fontsButton.addEventListener("click", () => {
    requestFontCheck(iframe, (fontMismatches, iframeUrl) => {
      // creatives-host.ts renders the results.
      postToSelf({
        fontMismatches,
        iframeIndex: Array.from(document.querySelectorAll("iframe")).indexOf(
          iframe
        ),
        iframeUrl,
        type: WINDOW_MESSAGE.FONT_CHECK_RESULTS
      })
    })
  })
  parts.accessibilityButton.addEventListener("click", () => {
    postToFrame(iframe, { type: WINDOW_MESSAGE.CHECK_ACCESSIBILITY_REQUEST })
  })

  parts.wrapper.addEventListener("mouseenter", () => {
    state.isRequestListHoverActive = true
    updateRequestList(state)
  })
  parts.wrapper.addEventListener("mouseleave", () => {
    state.isRequestListHoverActive = false
    parts.panel.container.style.display = "none"
  })

  syncBadge(state)
  state.resizeObserver.observe(iframe)
  states.set(iframe, state)
  return state
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
  for (const iframe of Array.from(states.keys())) {
    if (!iframe.isConnected || !isValidIframeContext(iframe)) {
      removeState(iframe)
      continue
    }

    const state = states.get(iframe)
    if (state) {
      syncBadge(state)
    }
  }
}

const applyColors = (state: BadgeState) =>
  applyUsageColors(
    state.parts.values,
    settings.limitMetric,
    state,
    settings.limitBytes
  )

const handleWindowMessage = (event: MessageEvent) => {
  const message = parseWindowMessage(event.data)
  if (message?.type !== WINDOW_MESSAGE.STATS) {
    return
  }

  const iframe = resolveSenderIframe(event)
  if (!iframe || !isValidIframeContext(iframe)) {
    return
  }

  const { payload } = message
  const state = ensureState(iframe)
  state.url = payload.url
  state.requestCount = payload.requestCount
  state.requestItems = payload.requestItems
  state.transferred = payload.transferred
  state.resources = payload.resources
  state.parts.values.transferred.textContent = payload.transferredText
  state.parts.values.resources.textContent = payload.resourcesText
  state.parts.values.requests.textContent = ` (${payload.requestCountText})`
  updateRequestList(state)
  applyColors(state)
}

const applySettings = (next: ContentSettings) => {
  settings = next

  for (const [iframe, state] of states) {
    applyColors(state)
    syncOverlayBadgeLayout(iframe, state.parts)
  }
  for (const state of states.values()) {
    updateRequestList(state)
  }
}

const init = () => {
  // Only run if we are NOT in an iframe (we are on main page)
  if (window.self !== window.top) {
    return
  }

  watchContentSettings(() => settings, applySettings)
  window.addEventListener("message", handleWindowMessage)

  new MutationObserver(cleanupDetachedFrames).observe(
    document.documentElement,
    { childList: true, subtree: true }
  )
}

init()

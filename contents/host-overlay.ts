import type { PlasmoCSConfig } from "plasmo"

import { describeCreative, type AuditReportRow } from "~lib/audit-report"
import {
  accessibilityOutcome,
  consoleOutcome,
  contentOutcome,
  fontOutcome,
  qualityOutcome,
  requestOutcome,
  type CheckOutcomes
} from "~lib/audit-summary"
import type { ConsoleProblem } from "~lib/cdp/types"
import {
  getDefaultContentSettings,
  watchContentSettings,
  type ContentSettings
} from "~lib/content-settings"
import { filterConsoleProblems } from "~lib/features/console-problems"
import {
  findRequestProblems,
  type RequestRecord
} from "~lib/features/request-errors"
import {
  compareSnapshot as compareSnapshotUtil,
  getSnapshotInfo,
  saveSnapshot as saveSnapshotUtil,
  type Totals
} from "~lib/features/snapshot"
import { buildEnglishAlerts } from "~lib/insights"
import {
  findIframeBySourceWindow,
  parseWindowMessage,
  postToFrame,
  postToSelf,
  rememberFrameOrigin,
  resolveSenderIframe,
  sendOpenTab,
  WINDOW_MESSAGE,
  type WireFontMismatch
} from "~lib/messaging"
import {
  createAuditAllButton,
  createAuditReportPanel
} from "~lib/ui/audit-report-panel"
import {
  applyUsageColors,
  renderAlertLines,
  updateStatusIndicators
} from "~lib/ui/badge-parts"
import {
  createOverlayBadge,
  insertBadgeAfterIframe,
  syncOverlayBadgeLayout,
  type OverlayBadge
} from "~lib/ui/overlay-badge"
import { createPanelMount } from "~lib/ui/panel-mount"
import { updateRequestPanel, updateSnapshotRow } from "~lib/ui/request-panel"
import { getDarkTheme } from "~lib/ui/theme"

export const config: PlasmoCSConfig = {
  matches: [
    "https://creatives-preview.rtbhouse.com/*",
    "https://techtools.rtbhouse.biz/*"
  ],
  all_frames: true
}

const TECHTOOLS_HOSTNAME = "techtools.rtbhouse.biz"
const FONT_CHECK_TIMEOUT_MS = 5000
const AUDIT_TIMEOUT_MS = 8000

type BadgeState = {
  /** Outcome of each check the user has run on this creative. */
  checks: CheckOutcomes
  /** Tab-wide (not per creative) console problems from the last stats post. */
  consoleProblems: ConsoleProblem[]
  iframe: HTMLIFrameElement
  isRequestListHoverActive: boolean
  parts: OverlayBadge
  requestCount: number
  requestItems: RequestRecord[]
  resizeObserver: ResizeObserver
  resources: number
  transferred: number
  url: string
}

const states = new Map<HTMLIFrameElement, BadgeState>()
const auditPanelMount = createPanelMount()
let auditAllButton: HTMLButtonElement | null = null
let isAuditRunning = false
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
    consoleProblems: state.consoleProblems,
    // CDP console data covers the whole tab, shared by all creatives.
    consoleTabWide: true,
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
    callback(
      message.fontMismatches,
      message.iframeUrl || iframe.src || "unknown"
    )
  }

  window.addEventListener("message", handler)
  setTimeout(
    () => window.removeEventListener("message", handler),
    FONT_CHECK_TIMEOUT_MS
  )

  postToFrame(iframe, { type: WINDOW_MESSAGE.CHECK_FONTS_REQUEST })
}

const refreshIndicators = (state: BadgeState) =>
  updateStatusIndicators(
    state.parts.indicators,
    state.requestItems,
    state.checks,
    state.consoleProblems
  )

const setCheck = <K extends keyof CheckOutcomes>(
  state: BadgeState,
  name: K,
  outcome: NonNullable<CheckOutcomes[K]>
) => {
  state.checks = { ...state.checks, [name]: outcome }
  refreshIndicators(state)
}

/** Posts the audit request to one iframe; null when it does not answer. */
const requestAudit = (
  iframe: HTMLIFrameElement
): Promise<CheckOutcomes | null> =>
  new Promise((resolve) => {
    const finish = (result: CheckOutcomes | null) => {
      window.removeEventListener("message", handler)
      window.clearTimeout(timer)
      resolve(result)
    }
    const handler = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) {
        return
      }

      const message = parseWindowMessage(event.data)
      if (message?.type === WINDOW_MESSAGE.AUDIT_RESPONSE) {
        rememberFrameOrigin(event.source, event.origin)
        finish(message.checks)
      }
    }
    const timer = window.setTimeout(() => finish(null), AUDIT_TIMEOUT_MS)

    window.addEventListener("message", handler)
    postToFrame(iframe, { type: WINDOW_MESSAGE.AUDIT_REQUEST })
  })

const runAuditAll = async () => {
  if (isAuditRunning || states.size === 0) {
    return
  }

  isAuditRunning = true
  if (auditAllButton) {
    auditAllButton.textContent = "Auditing..."
    auditAllButton.disabled = true
  }

  try {
    const order = Array.from(document.querySelectorAll("iframe"))
    const entries = Array.from(states.values()).sort(
      (a, b) => order.indexOf(a.iframe) - order.indexOf(b.iframe)
    )
    const outcomes = await Promise.all(
      entries.map((state) => requestAudit(state.iframe))
    )

    const rows: AuditReportRow[] = entries.map((state, index) => {
      const rect = state.iframe.getBoundingClientRect()
      const checks: CheckOutcomes = {
        ...(outcomes[index] ?? {}),
        console: consoleOutcome(filterConsoleProblems(state.consoleProblems)),
        requests: requestOutcome(
          findRequestProblems(state.requestItems).summary
        )
      }
      state.checks = checks
      refreshIndicators(state)
      return {
        checks,
        ...describeCreative(
          {
            height: rect.height,
            id: state.iframe.id,
            name: state.iframe.getAttribute("name") ?? "",
            width: rect.width
          },
          order.indexOf(state.iframe)
        )
      }
    })

    auditPanelMount.show(
      createAuditReportPanel(rows, getDarkTheme(), {
        pageUrl: window.location.href
      })
    )
  } finally {
    isAuditRunning = false
    if (auditAllButton) {
      auditAllButton.textContent = "Audit all"
      auditAllButton.disabled = false
    }
  }
}

/** Shows the floating "Audit all" button while creatives exist and it is on. */
const syncAuditAllButton = () => {
  const visible = settings.auditAllEnabled && states.size > 0
  if (!visible) {
    auditAllButton?.remove()
    return
  }

  if (!auditAllButton) {
    auditAllButton = createAuditAllButton()
    auditAllButton.addEventListener("click", () => void runAuditAll())
  }
  if (!auditAllButton.isConnected && document.body) {
    document.body.appendChild(auditAllButton)
  }
}

const removeState = (iframe: HTMLIFrameElement) => {
  const state = states.get(iframe)
  if (!state) {
    return
  }

  state.resizeObserver.disconnect()
  state.parts.wrapper.remove()
  states.delete(iframe)
  syncAuditAllButton()
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
    checks: {},
    consoleProblems: [],
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
      setCheck(state, "fonts", fontOutcome(fontMismatches.length))
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
  parts.contentButton.addEventListener("click", () => {
    postToFrame(iframe, { type: WINDOW_MESSAGE.CHECK_CONTENT_REQUEST })
  })
  parts.qualityButton.addEventListener("click", () => {
    postToFrame(iframe, { type: WINDOW_MESSAGE.CHECK_QUALITY_REQUEST })
  })
  parts.contentButton.style.display = settings.contentCheckEnabled
    ? "flex"
    : "none"
  parts.qualityButton.style.display = settings.qualityCheckEnabled
    ? "flex"
    : "none"

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
  syncAuditAllButton()
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

/** Check results also reach creatives-host; here they feed the status dot. */
const handleCheckResponse = (event: MessageEvent) => {
  const message = parseWindowMessage(event.data)
  if (
    message?.type !== WINDOW_MESSAGE.CHECK_ACCESSIBILITY_RESPONSE &&
    message?.type !== WINDOW_MESSAGE.CHECK_CONTENT_RESPONSE &&
    message?.type !== WINDOW_MESSAGE.CHECK_QUALITY_RESPONSE
  ) {
    return
  }

  const iframe = findIframeBySourceWindow(event.source)
  const state = iframe ? states.get(iframe) : undefined
  if (!state) {
    return
  }

  if (message.type === WINDOW_MESSAGE.CHECK_CONTENT_RESPONSE) {
    setCheck(state, "content", contentOutcome(message.issues))
    return
  }

  if (message.type === WINDOW_MESSAGE.CHECK_QUALITY_RESPONSE) {
    setCheck(state, "quality", qualityOutcome(message.issues))
    return
  }

  setCheck(
    state,
    "accessibility",
    accessibilityOutcome(message.optOutIssues, message.borderIssues)
  )
}

const handleWindowMessage = (event: MessageEvent) => {
  const message = parseWindowMessage(event.data)
  if (message?.type !== WINDOW_MESSAGE.STATS) {
    handleCheckResponse(event)
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
  state.consoleProblems = payload.consoleProblems
  state.transferred = payload.transferred
  state.resources = payload.resources
  state.parts.values.transferred.textContent = payload.transferredText
  state.parts.values.resources.textContent = payload.resourcesText
  state.parts.values.requests.textContent = ` (${payload.requestCountText})`
  updateRequestList(state)
  applyColors(state)
  refreshIndicators(state)
}

const applySettings = (next: ContentSettings) => {
  settings = next

  syncAuditAllButton()
  for (const [iframe, state] of states) {
    state.parts.contentButton.style.display = settings.contentCheckEnabled
      ? "flex"
      : "none"
    state.parts.qualityButton.style.display = settings.qualityCheckEnabled
      ? "flex"
      : "none"
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

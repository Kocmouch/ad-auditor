/**
 * Central registry for every message the extension sends between frames
 * (window.postMessage) and between content scripts and the service worker
 * (chrome.runtime.sendMessage). Wire-format strings live ONLY here.
 *
 * TRUST MODEL
 * -----------
 * Window messages
 *  - Any script running in the page (including the ad creative itself) can post
 *    to the host window or into an iframe, so nothing received over
 *    window.postMessage is trusted. Receivers must (1) check the sender
 *    (`event.source`) and (2) run the payload through `parseWindowMessage`, which
 *    only returns a message when its shape is valid and sanitises its fields.
 *    Panels render all received text via `textContent`, never as HTML.
 *  - Host -> iframe ("requests", "clear highlights"): sent with
 *    `postToFrame`, whose target origin is, in order of preference, the origin
 *    last seen on a message from that frame, the origin of the iframe `src`, or
 *    "*" when neither is a usable http(s) origin (about:blank, srcdoc, ...).
 *  - iframe -> parent ("stats", "responses"): sent with `postToParent`, whose
 *    target origin is the parent origin from `location.ancestorOrigins` when
 *    available, else "*". The receiving host additionally requires
 *    `event.source` to be the contentWindow of one of its iframes.
 *  - iframe-side receivers accept requests only from `window.parent`
 *    (`isMessageFromParent`).
 *  - A frame's own page can still forge a "stats"/response message from inside
 *    the creative; that is inherent to showing data reported by the creative's
 *    frame and is limited to what the validators accept (numbers/strings that
 *    are rendered as text).
 *
 * Runtime messages
 *  - chrome.runtime messages come from the extension's own content scripts only
 *    (the page cannot call chrome.runtime.sendMessage on this extension), and
 *    the background script reads fields defensively.
 *
 * This module must stay free of DOM access at import time so background.ts can
 * import the runtime constants.
 */
import type { BorderIssue } from "~lib/features/border-checker"
import type { FontMismatch } from "~lib/features/font-checker"
import type { OptOutIssue } from "~lib/features/optout-checker"
import type { RequestListItem } from "~lib/request-list"

export const MESSAGE_SOURCE = "ad-auditor"

/** Types of window.postMessage messages. */
export const WINDOW_MESSAGE = {
  /** iframe -> parent (carries `source`): live network stats. */
  STATS: "stats",
  /** host -> iframe: run the font check. */
  CHECK_FONTS_REQUEST: "ad-auditor-check-fonts-request",
  /** iframe -> parent: font check result. */
  CHECK_FONTS_RESPONSE: "ad-auditor-check-fonts-response",
  /** host -> iframe: run the opt-out/border checks. */
  CHECK_ACCESSIBILITY_REQUEST: "ad-auditor-check-accessibility-request",
  /** iframe -> parent: opt-out/border check result. */
  CHECK_ACCESSIBILITY_RESPONSE: "ad-auditor-check-accessibility-response",
  /** host -> iframe: remove font highlights. */
  CLEAR_FONT_HIGHLIGHTS: "ad-auditor-clear-font-highlights",
  /** host -> iframe: remove opt-out/border highlights. */
  CLEAR_ACCESSIBILITY_HIGHLIGHTS: "ad-auditor-clear-accessibility-highlights",
  /** host-overlay -> creatives-host (same window): show font results. */
  FONT_CHECK_RESULTS: "ad-auditor-font-check-results"
} as const

/** Types of chrome.runtime.sendMessage messages. */
export const RUNTIME_MESSAGE = {
  OPEN_TAB: "ad-auditor/open-tab",
  GET_CDP_STATUS: "ad-auditor/get-cdp-status",
  GET_ENHANCED_STATS: "ad-auditor/get-enhanced-stats"
} as const

export type StatsPayload = {
  requestCount: number
  requestCountText: string
  requestItems: RequestListItem[]
  resources: number
  resourcesText: string
  transferred: number
  transferredText: string
  url: string
}

/** Font mismatch as sent over the wire (no DOM element reference). */
export type WireFontMismatch = Pick<
  FontMismatch,
  "element" | "declared" | "rendered"
>

/** Issue as sent over the wire (DOM element references are not cloneable). */
export type WireOptOutIssue = Omit<OptOutIssue, "htmlElement">
export type WireBorderIssue = Omit<BorderIssue, "htmlElement">

export type WindowMessage =
  | { type: typeof WINDOW_MESSAGE.STATS; source: typeof MESSAGE_SOURCE; payload: StatsPayload }
  | { type: typeof WINDOW_MESSAGE.CHECK_FONTS_REQUEST }
  | {
      type: typeof WINDOW_MESSAGE.CHECK_FONTS_RESPONSE
      fontMismatches: WireFontMismatch[]
      iframeUrl: string
    }
  | { type: typeof WINDOW_MESSAGE.CHECK_ACCESSIBILITY_REQUEST }
  | {
      type: typeof WINDOW_MESSAGE.CHECK_ACCESSIBILITY_RESPONSE
      optOutIssues: WireOptOutIssue[]
      borderIssues: WireBorderIssue[]
      iframeUrl: string
    }
  | { type: typeof WINDOW_MESSAGE.CLEAR_FONT_HIGHLIGHTS }
  | { type: typeof WINDOW_MESSAGE.CLEAR_ACCESSIBILITY_HIGHLIGHTS }
  | {
      type: typeof WINDOW_MESSAGE.FONT_CHECK_RESULTS
      fontMismatches: WireFontMismatch[]
      iframeUrl: string
      iframeIndex: number
    }

/** Subset of a RuntimeMessage response used by content scripts. */
export type EnhancedStatsResponse = {
  ok?: boolean
  available?: boolean
  trackedRequests?: number
  tabTrackedRequests?: number
  requestDetails?: unknown
  tabRequestDetails?: unknown
  resources?: number
  tabResources?: number
  transferred?: number
  tabTransferred?: number
  reason?: string
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const toCount = (value: unknown): number => Math.max(0, Number(value) || 0)

const toStr = (value: unknown): string => (typeof value === "string" ? value : "")

export const sanitizeRequestItems = (value: unknown): RequestListItem[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const items: RequestListItem[] = []
  for (const entry of value) {
    if (!isRecord(entry)) {
      continue
    }

    items.push({
      host: toStr(entry.host),
      resources: toCount(entry.resources),
      status: entry.status === "pending" ? "pending" : "done",
      transferred: toCount(entry.transferred),
      type: toStr(entry.type),
      url: toStr(entry.url)
    })
  }

  return items
}

export const sanitizeFontMismatches = (value: unknown): WireFontMismatch[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const result: WireFontMismatch[] = []
  for (const entry of value) {
    if (!isRecord(entry)) {
      continue
    }

    result.push({
      declared: toStr(entry.declared),
      element: toStr(entry.element),
      rendered: toStr(entry.rendered)
    })
  }

  return result
}

const sanitizeIssueList = <T>(value: unknown): T[] =>
  Array.isArray(value) ? (value.filter(isRecord) as unknown as T[]) : []

/** Strip the non-cloneable `htmlElement` reference from checker issues. */
export const toWireIssues = <T extends { htmlElement?: HTMLElement }>(
  issues: T[]
): Omit<T, "htmlElement">[] =>
  issues.map(({ htmlElement: _htmlElement, ...rest }) => rest)

/** Strip non-cloneable fields (DOM element references) before posting. */
export const toWireFontMismatches = (
  mismatches: FontMismatch[]
): WireFontMismatch[] =>
  mismatches.map(({ declared, element, rendered }) => ({
    declared,
    element,
    rendered
  }))

/**
 * Validate and sanitise the `data` of a window message. Returns null for
 * anything that is not one of the registered messages with a valid shape.
 */
export const parseWindowMessage = (data: unknown): WindowMessage | null => {
  if (!isRecord(data) || typeof data.type !== "string") {
    return null
  }

  switch (data.type) {
    case WINDOW_MESSAGE.STATS: {
      if (data.source !== MESSAGE_SOURCE || !isRecord(data.payload)) {
        return null
      }

      const payload = data.payload
      const requestCount = toCount(payload.requestCount)
      return {
        payload: {
          requestCount,
          requestCountText:
            toStr(payload.requestCountText) || `${requestCount} req`,
          requestItems: sanitizeRequestItems(payload.requestItems),
          resources: toCount(payload.resources),
          resourcesText: toStr(payload.resourcesText),
          transferred: toCount(payload.transferred),
          transferredText: toStr(payload.transferredText),
          url: toStr(payload.url)
        },
        source: MESSAGE_SOURCE,
        type: WINDOW_MESSAGE.STATS
      }
    }
    case WINDOW_MESSAGE.CHECK_FONTS_REQUEST:
    case WINDOW_MESSAGE.CHECK_ACCESSIBILITY_REQUEST:
    case WINDOW_MESSAGE.CLEAR_FONT_HIGHLIGHTS:
    case WINDOW_MESSAGE.CLEAR_ACCESSIBILITY_HIGHLIGHTS:
      return { type: data.type }
    case WINDOW_MESSAGE.CHECK_FONTS_RESPONSE:
      if (!Array.isArray(data.fontMismatches)) {
        return null
      }
      return {
        fontMismatches: sanitizeFontMismatches(data.fontMismatches),
        iframeUrl: toStr(data.iframeUrl),
        type: data.type
      }
    case WINDOW_MESSAGE.CHECK_ACCESSIBILITY_RESPONSE:
      return {
        borderIssues: sanitizeIssueList<WireBorderIssue>(data.borderIssues),
        iframeUrl: toStr(data.iframeUrl),
        optOutIssues: sanitizeIssueList<WireOptOutIssue>(data.optOutIssues),
        type: data.type
      }
    case WINDOW_MESSAGE.FONT_CHECK_RESULTS: {
      const index = data.iframeIndex
      if (
        !Array.isArray(data.fontMismatches) ||
        typeof index !== "number" ||
        !Number.isInteger(index) ||
        index < 0
      ) {
        return null
      }
      return {
        fontMismatches: sanitizeFontMismatches(data.fontMismatches),
        iframeIndex: index,
        iframeUrl: toStr(data.iframeUrl),
        type: data.type
      }
    }
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Origins and senders
// ---------------------------------------------------------------------------

const learnedFrameOrigins = new WeakMap<object, string>()

const toHttpOrigin = (value: string): string | null => {
  try {
    const parsed = new URL(value)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.origin
      : null
  } catch {
    return null
  }
}

/** Origin of an iframe `src`, or null when not a usable http(s) origin. */
export const getOriginFromSrc = (
  src: string,
  baseUrl?: string
): string | null => {
  if (!src) {
    return null
  }

  try {
    return toHttpOrigin(new URL(src, baseUrl).toString())
  } catch {
    return null
  }
}

/** Remember the origin a frame actually posted from (handles redirects). */
export const rememberFrameOrigin = (
  source: MessageEventSource | null,
  origin: string
) => {
  if (!source || typeof source === "string") {
    return
  }

  const httpOrigin = toHttpOrigin(origin)
  if (httpOrigin) {
    learnedFrameOrigins.set(source, httpOrigin)
  }
}

/** Target origin for host -> iframe messages ("*" only when unknowable). */
export const getFrameTargetOrigin = (iframe: HTMLIFrameElement): string => {
  const windowRef = iframe.contentWindow
  const learned = windowRef ? learnedFrameOrigins.get(windowRef) : undefined
  if (learned) {
    return learned
  }

  return (
    getOriginFromSrc(iframe.getAttribute("src") || "", window.location.href) ??
    "*"
  )
}

const getParentOrigin = (): string | null => {
  const ancestors = window.location.ancestorOrigins
  const parentOrigin = ancestors && ancestors.length > 0 ? ancestors[0] : ""
  return parentOrigin ? toHttpOrigin(parentOrigin) : null
}

/** Target origin for iframe -> parent messages ("*" only when unknowable). */
export const getParentTargetOrigin = (): string => getParentOrigin() ?? "*"

export const postToFrame = (
  iframe: HTMLIFrameElement,
  message: WindowMessage
) => {
  iframe.contentWindow?.postMessage(message, getFrameTargetOrigin(iframe))
}

export const postToParent = (message: WindowMessage) => {
  if (window.parent === window) {
    return
  }

  window.parent.postMessage(message, getParentTargetOrigin())
}

/** host-overlay and creatives-host share one window; post to it directly. */
export const postToSelf = (message: WindowMessage) => {
  window.postMessage(message, toHttpOrigin(window.location.origin) ?? "*")
}

// ---------------------------------------------------------------------------
// Receiver-side sender checks
// ---------------------------------------------------------------------------

export const findIframeBySourceWindow = (
  sourceWindow: MessageEventSource | null,
  root: ParentNode = document
): HTMLIFrameElement | null => {
  if (!sourceWindow || typeof sourceWindow === "string") {
    return null
  }

  for (const frame of root.querySelectorAll("iframe")) {
    if (frame.contentWindow === sourceWindow) {
      return frame
    }
  }

  return null
}

/**
 * For host-side receivers: resolve the iframe a message came from and remember
 * the origin it posted from. Returns null when the sender is not an iframe of
 * this document.
 */
export const resolveSenderIframe = (
  event: MessageEvent
): HTMLIFrameElement | null => {
  const iframe = findIframeBySourceWindow(event.source)
  if (iframe) {
    rememberFrameOrigin(event.source, event.origin)
  }
  return iframe
}

/** For iframe-side receivers: only the embedding parent may send requests. */
export const isMessageFromParent = (event: MessageEvent): boolean => {
  if (window.parent === window || event.source !== window.parent) {
    return false
  }

  const parentOrigin = getParentOrigin()
  return parentOrigin === null || event.origin === parentOrigin
}

/** For same-window messages (host-overlay -> creatives-host). */
export const isMessageFromSelf = (event: MessageEvent): boolean =>
  event.source === window

// ---------------------------------------------------------------------------
// Runtime messages
// ---------------------------------------------------------------------------

/**
 * True while this content script is still attached to a live extension.
 * After the extension is reloaded/updated, Chrome keeps the old content script
 * running in open tabs and every chrome.* call throws
 * "Extension context invalidated"; the page has to be reloaded.
 */
export const isExtensionContextValid = (): boolean => {
  try {
    return Boolean(chrome.runtime?.id)
  } catch {
    return false
  }
}

export const sendOpenTab = (url: string) => {
  if (!url || !isExtensionContextValid()) {
    return
  }

  try {
    chrome.runtime.sendMessage({ type: RUNTIME_MESSAGE.OPEN_TAB, url })
  } catch {
    // Context invalidated between the check and the call.
  }
}

/** Calls back with the response, or null when the runtime call failed. */
export const requestEnhancedStats = (
  documentUrl: string,
  callback: (response: EnhancedStatsResponse | null) => void
) => {
  if (!isExtensionContextValid()) {
    callback(null)
    return
  }

  try {
    chrome.runtime.sendMessage(
      { documentUrl, type: RUNTIME_MESSAGE.GET_ENHANCED_STATS },
      (response) => {
        if (chrome.runtime.lastError) {
          callback(null)
          return
        }

        callback(
          isRecord(response) ? (response as EnhancedStatsResponse) : null
        )
      }
    )
  } catch {
    callback(null)
  }
}

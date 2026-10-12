import { STORAGE_KEYS } from "~lib/storage/keys"
import { parsers } from "~lib/storage/parsers"
import type { DebuggeeWithSession, TabSession, RequestMetric, RequestDetails } from "~lib/cdp/types"
import {
  attachDebugger,
  sendDebuggerCommand,
  setCacheDisabledForDebuggee,
  clearBrowserCacheForTab
} from "~lib/cdp/debugger"
import {
  sessionsByTabId,
  getOrCreateSession,
  clearSessionMetrics,
  removeSession
} from "~lib/cdp/session-manager"
import {
  handleNetworkRequestWillBeSent,
  handleNetworkDataReceived,
  handleNetworkLoadingFinished,
  handleNetworkLoadingFailed
} from "~lib/cdp/network-tracker"
import {
  getInstallDefaults,
  runSettingsMigration,
  getDisableCacheValue
} from "~lib/storage/settings"
import {
  isTargetAuditUrl,
  isCacheControlUrl
} from "~lib/utils/url-validators"
import { getEnhancedStatsErrorPayload } from "~lib/cdp/enhanced-stats"
import { normalizeDocumentUrl, getDocumentKey } from "~lib/utils/url-validators"

const OPEN_TAB_DEDUPE_WINDOW_MS = 800
const lastOpenRequestByKey = new Map<string, number>()
let disableCacheEnabled = false

const syncCachePolicyForSession = async (
  tabId: number,
  session: TabSession,
  shouldClearCache: boolean
) => {
  if (!session.attached) {
    return
  }

  try {
    await setCacheDisabledForDebuggee({ tabId }, disableCacheEnabled)
  } catch {
    // Ignore when debugger target is not ready anymore.
  }

  for (const childSessionId of session.childSessionIds) {
    try {
      await setCacheDisabledForDebuggee({ sessionId: childSessionId, tabId }, disableCacheEnabled)
    } catch {
      // Ignore detached child targets.
    }
  }

  if (!disableCacheEnabled || !shouldClearCache) {
    return
  }

  try {
    await clearBrowserCacheForTab(tabId)
  } catch {
    // Ignore cache clear errors.
  }
}

const syncCachePolicyForAttachedTabs = (shouldClearCache: boolean) => {
  for (const [tabId, session] of sessionsByTabId) {
    syncCachePolicyForSession(tabId, session, shouldClearCache).catch(
      () => undefined
    )
  }
}

const ensureDebuggerAttached = async (tabId: number): Promise<TabSession> => {
  const session = getOrCreateSession(tabId)

  if (session.attached) {
    await syncCachePolicyForSession(tabId, session, false)
    return session
  }

  if (!session.attachPromise) {
    session.attachPromise = (async () => {
      try {
        await attachDebugger(tabId)
        const rootDebuggee: chrome.debugger.Debuggee = { tabId }
        await sendDebuggerCommand(rootDebuggee, "Target.setAutoAttach", {
          autoAttach: true,
          flatten: true,
          waitForDebuggerOnStart: false
        })
        await sendDebuggerCommand(rootDebuggee, "Network.enable")
        await setCacheDisabledForDebuggee(rootDebuggee, disableCacheEnabled)
        session.attached = true
        session.attachError = null
      } catch (error) {
        session.attached = false
        session.attachError =
          error instanceof Error ? error.message : "Failed to attach debugger"
      } finally {
        session.attachPromise = null
      }
    })()
  }

  await session.attachPromise
  return session
}

const getRequestKey = (session: TabSession, requestId: string): string => {
  const mapped = session.requestKeyByRequestId.get(requestId)
  if (mapped) {
    return mapped
  }

  const fallback = `${requestId}#0`
  session.requestKeyByRequestId.set(requestId, fallback)
  return fallback
}

const getScopedRequestId = (
  source: chrome.debugger.Debuggee,
  requestId: string
): string => {
  const sourceWithSession = source as DebuggeeWithSession
  const sessionId =
    typeof sourceWithSession.sessionId === "string" &&
    sourceWithSession.sessionId.length > 0
      ? sourceWithSession.sessionId
      : "root"

  return `${sessionId}:${requestId}`
}

const getOrCreateRequestMetric = (
  session: TabSession,
  requestKey: string
): RequestMetric => {
  const existing = session.requests.get(requestKey)
  if (existing) {
    return existing
  }

  const created: RequestMetric = {
    completed: false,
    decodedBytes: 0,
    documentKey: "",
    documentUrl: "",
    encodedBytesFromChunks: 0,
    frameId: "",
    finalEncodedBytes: null,
    loaderId: "",
    requestUrl: "",
    requestType: "",
    requestUrlHost: "",
    startedAt: 0
  }

  session.requests.set(requestKey, created)
  return created
}

const handleDebuggerEvent = (
  source: chrome.debugger.Debuggee,
  method: string,
  params?: Record<string, unknown>
) => {
  const tabId = source.tabId
  if (typeof tabId !== "number") {
    return
  }

  const session = getOrCreateSession(tabId)

  if (method === "Target.attachedToTarget") {
    const attachedSessionId =
      typeof params?.sessionId === "string" ? params.sessionId : ""
    if (!attachedSessionId) {
      return
    }

    session.childSessionIds.add(attachedSessionId)

    sendDebuggerCommand(
      { sessionId: attachedSessionId, tabId },
      "Network.enable"
    )
      .then(() =>
        setCacheDisabledForDebuggee({ sessionId: attachedSessionId, tabId }, disableCacheEnabled)
      )
      .catch(() => undefined)
    return
  }

  if (method === "Network.requestWillBeSent") {
    handleNetworkRequestWillBeSent(session, source, params)
    return
  }

  if (method === "Network.dataReceived") {
    handleNetworkDataReceived(session, source, params)
    return
  }

  if (method === "Network.loadingFinished") {
    handleNetworkLoadingFinished(session, source, params)
    return
  }

  if (method === "Network.loadingFailed") {
    handleNetworkLoadingFailed(session, source, params)
  }
}

const getEnhancedStatsForTab = async (tabId: number, documentUrl: string) => {
  const session = await ensureDebuggerAttached(tabId)

  if (!session.attached) {
    return {
      available: false,
      requestDetails: [],
      reason: session.attachError ?? "Debugger is not attached",
      resources: 0,
      tabRequestDetails: [],
      tabResources: 0,
      tabTrackedRequests: 0,
      tabTransferred: 0,
      trackedRequests: 0,
      transferred: 0
    }
  }

  let transferred = 0
  let resources = 0
  let trackedRequests = 0
  let docTransferred = 0
  let docResources = 0
  let docTrackedRequests = 0
  const docRequestDetails: RequestDetails[] = []
  const tabRequestDetails: RequestDetails[] = []
  const normalizedDocumentUrl = normalizeDocumentUrl(documentUrl)
  const documentKey = getDocumentKey(normalizedDocumentUrl)
  let activeDocumentLoaderId = ""
  let activeDocumentFrameId = ""
  let activeDocumentStartedAt = -1
  const FONT_HOSTS = new Set([
    "fonts.googleapis.com",
    "fonts.gstatic.com",
    "use.typekit.net",
    "p.typekit.net"
  ])

  for (const metric of session.requests.values()) {
    const requestUrl = normalizeDocumentUrl(metric.requestUrl)
    if (
      metric.requestType === "Document" &&
      normalizedDocumentUrl &&
      requestUrl === normalizedDocumentUrl
    ) {
      if (metric.startedAt >= activeDocumentStartedAt) {
        activeDocumentStartedAt = metric.startedAt
        activeDocumentLoaderId = metric.loaderId
        activeDocumentFrameId = metric.frameId
      }
    }
  }

  for (const metric of session.requests.values()) {
    const metricTransferred = metric.completed
      ? (metric.finalEncodedBytes ?? metric.encodedBytesFromChunks)
      : metric.encodedBytesFromChunks
    const metricResources = metric.decodedBytes
    const metricStatus: "done" | "pending" = metric.completed ? "done" : "pending"
    const requestDetails: RequestDetails = {
      host: metric.requestUrlHost,
      resources: Math.max(0, Math.round(metricResources)),
      status: metricStatus,
      transferred: Math.max(0, Math.round(metricTransferred)),
      type: metric.requestType || "Other",
      url: metric.requestUrl || "(unknown URL)"
    }

    trackedRequests += 1
    transferred += metricTransferred
    resources += metricResources
    tabRequestDetails.push(requestDetails)

    const normalizedRequestUrl = normalizeDocumentUrl(metric.requestUrl)
    const matchesByDocumentKey = documentKey
      ? metric.documentKey === documentKey
      : false
    const matchesByDocumentRequest =
      metric.requestType === "Document" &&
      normalizedDocumentUrl !== "" &&
      normalizedRequestUrl === normalizedDocumentUrl &&
      metric.startedAt === activeDocumentStartedAt
    const matchesByLoaderId =
      activeDocumentLoaderId !== "" && metric.loaderId === activeDocumentLoaderId
    const matchesByFrameId =
      activeDocumentFrameId !== "" && metric.frameId === activeDocumentFrameId
    const matchesByDocumentKeyFallback =
      activeDocumentLoaderId === "" &&
      activeDocumentFrameId === "" &&
      matchesByDocumentKey

    const matchesDocument =
      matchesByDocumentKeyFallback ||
      matchesByDocumentRequest ||
      matchesByLoaderId ||
      matchesByFrameId

    const isExternalFontForDocument =
      metric.requestType === "Font" &&
      FONT_HOSTS.has(metric.requestUrlHost) &&
      (matchesDocument || matchesByLoaderId || matchesByFrameId)

    if (!matchesDocument && !isExternalFontForDocument) {
      continue
    }

    docTrackedRequests += 1
    docTransferred += metricTransferred
    docResources += metricResources
    docRequestDetails.push(requestDetails)
  }

  return {
    available: true,
    requestDetails: docRequestDetails,
    resources: Math.max(0, Math.round(docResources)),
    tabRequestDetails,
    tabResources: Math.max(0, Math.round(resources)),
    tabTrackedRequests: trackedRequests,
    tabTransferred: Math.max(0, Math.round(transferred)),
    trackedRequests: docTrackedRequests,
    transferred: Math.max(0, Math.round(docTransferred))
  }
}

const getCdpStatusForTab = async (tabId: number) => {
  const tab = await new Promise<chrome.tabs.Tab | null>((resolve) => {
    chrome.tabs.get(tabId, (resolvedTab) => {
      const err = chrome.runtime.lastError
      if (err) {
        resolve(null)
        return
      }

      resolve(resolvedTab)
    })
  })

  if (!tab) {
    return {
      reason: "Tab not found",
      status: "error" as const
    }
  }

  const tabUrl = tab.pendingUrl ?? tab.url ?? ""
  if (!isTargetAuditUrl(tabUrl)) {
    return {
      reason: "Open a supported preview domain to attach CDP.",
      status: "fallback" as const
    }
  }

  const session = await ensureDebuggerAttached(tabId)
  if (!session.attached) {
    return {
      reason: session.attachError ?? "Failed to attach debugger",
      status: "error" as const
    }
  }

  return {
    reason: "",
    status: "attached" as const
  }
}

chrome.debugger.onEvent.addListener(handleDebuggerEvent)

chrome.debugger.onDetach.addListener((source, reason) => {
  const tabId = source.tabId
  if (typeof tabId !== "number") {
    return
  }

  const session = getOrCreateSession(tabId)
  const detachedSessionId =
    typeof (source as DebuggeeWithSession).sessionId === "string"
      ? (source as DebuggeeWithSession).sessionId
      : ""

  if (detachedSessionId) {
    session.childSessionIds.delete(detachedSessionId)
    return
  }

  session.attached = false
  session.attachError = reason
  session.attachPromise = null
  session.childSessionIds.clear()
  clearSessionMetrics(session)
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const session = getOrCreateSession(tabId)

  if (changeInfo.status === "complete") {
    session.isTopNavigationInProgress = false
    return
  }

  if (changeInfo.status !== "loading") {
    return
  }

  const nextUrl = changeInfo.url ?? tab.pendingUrl ?? tab.url ?? ""
  if (!isTargetAuditUrl(nextUrl)) {
    return
  }

  const normalizedNavigationUrl = normalizeDocumentUrl(nextUrl)

  if (
    session.isTopNavigationInProgress &&
    session.lastNavigationUrl === normalizedNavigationUrl
  ) {
    return
  }

  session.isTopNavigationInProgress = true
  session.lastNavigationUrl = normalizedNavigationUrl
  clearSessionMetrics(session)

  ensureDebuggerAttached(tabId)
    .then((attachedSession) => {
      if (disableCacheEnabled && isCacheControlUrl(nextUrl)) {
        return syncCachePolicyForSession(tabId, attachedSession, true)
      }

      return undefined
    })
    .catch(() => undefined)
})

chrome.tabs.onRemoved.addListener((tabId) => {
  const session = sessionsByTabId.get(tabId)
  if (!session) {
    return
  }

  if (session.attached) {
    chrome.debugger.detach({ tabId }, () => undefined)
  }

  removeSession(tabId)
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ad-auditor/open-tab") {
    const url = typeof message?.url === "string" ? message.url : ""

    if (!url) {
      sendResponse({ ok: false, reason: "Missing URL" })
      return true
    }

    const senderTabId = sender.tab?.id ?? -1
    const senderFrameId = sender.frameId ?? -1
    const requestKey = `${senderTabId}:${senderFrameId}:${url}`
    const now = Date.now()
    const lastOpenAt = lastOpenRequestByKey.get(requestKey) ?? 0

    if (now - lastOpenAt < OPEN_TAB_DEDUPE_WINDOW_MS) {
      sendResponse({ deduped: true, ok: true })
      return true
    }

    lastOpenRequestByKey.set(requestKey, now)

    chrome.tabs.create({ url }, () => {
      const err = chrome.runtime.lastError

      if (err) {
        sendResponse({ ok: false, reason: err.message })
        return
      }

      sendResponse({ ok: true })
    })

    return true
  }

  if (message?.type === "ad-auditor/get-cdp-status") {
    const tabId = typeof message?.tabId === "number" ? message.tabId : sender.tab?.id

    if (typeof tabId !== "number") {
      sendResponse({
        ok: false,
        reason: "Missing tab id",
        status: "error"
      })
      return true
    }

    getCdpStatusForTab(tabId)
      .then((status) => {
        sendResponse({
          ok: true,
          ...status
        })
      })
      .catch((error: unknown) => {
        sendResponse({
          ok: false,
          reason: error instanceof Error ? error.message : "Failed to inspect CDP",
          status: "error"
        })
      })

    return true
  }

  if (message?.type === "ad-auditor/get-enhanced-stats") {
    const tabId = sender.tab?.id
    const documentUrl =
      typeof message?.documentUrl === "string" ? message.documentUrl : sender.url ?? ""

    if (typeof tabId !== "number") {
      sendResponse({
        ...getEnhancedStatsErrorPayload("Missing sender tab id"),
        ok: false
      })
      return true
    }

    getEnhancedStatsForTab(tabId, documentUrl)
      .then((stats) => {
        sendResponse({
          ...stats,
          ok: true
        })
      })
      .catch((error: unknown) => {
        sendResponse({
          ...getEnhancedStatsErrorPayload(
            error instanceof Error ? error.message : "Failed to get stats"
          ),
          ok: false
        })
      })

    return true
  }

  return undefined
})

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== "install") {
    return
  }

  const defaults = getInstallDefaults()

  chrome.storage.sync.set(defaults, () => {
    getDisableCacheValue().then((value) => {
      disableCacheEnabled = value
    }).catch(() => undefined)

    chrome.tabs.create({
      url: chrome.runtime.getURL("tabs/welcome.html")
    })
  })
})

runSettingsMigration()
  .then(() => getDisableCacheValue())
  .then((value) => {
    disableCacheEnabled = value
  })
  .catch(() => undefined)

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync" || !changes[STORAGE_KEYS.DISABLE_CACHE]) {
    return
  }

  const nextValue = parsers.disableCache(changes[STORAGE_KEYS.DISABLE_CACHE].newValue)
  const shouldClearCache = !disableCacheEnabled && nextValue
  disableCacheEnabled = nextValue
  syncCachePolicyForAttachedTabs(shouldClearCache)
})

import {
  DEFAULT_DISABLE_CACHE,
  DISABLE_CACHE_KEY,
  parseDisableCache
} from "~lib/display-mode"

const OPEN_TAB_DEDUPE_WINDOW_MS = 800
const DEBUGGER_PROTOCOL_VERSION = "1.3"
const lastOpenRequestByKey = new Map<string, number>()
type DebuggeeWithSession = chrome.debugger.Debuggee & {
  sessionId?: string
}

type RequestMetric = {
  completed: boolean
  decodedBytes: number
  documentKey: string
  documentUrl: string
  encodedBytesFromChunks: number
  frameId: string
  finalEncodedBytes: number | null
  loaderId: string
  requestUrl: string
  requestType: string
  requestUrlHost: string
  startedAt: number
}

type RequestDetails = {
  host: string
  resources: number
  status: "done" | "pending"
  transferred: number
  type: string
  url: string
}

type TabSession = {
  attachError: string | null
  attachPromise: Promise<void> | null
  attached: boolean
  childSessionIds: Set<string>
  isTopNavigationInProgress: boolean
  lastNavigationUrl: string
  requestKeyByRequestId: Map<string, string>
  requestSequenceByRequestId: Map<string, number>
  requests: Map<string, RequestMetric>
}

const sessionsByTabId = new Map<number, TabSession>()

const TARGET_HOSTS = new Set([
  "creatives-preview.rtbhouse.com",
  "statics.creativecdn.com",
  "ams.creativecdn.com"
])
const CACHE_CONTROL_HOSTS = new Set([
  "creatives-preview.rtbhouse.com",
  "ams.creativecdn.com"
])
let disableCacheEnabled = DEFAULT_DISABLE_CACHE

const asNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  return 0
}

const getDocumentKey = (url: string): string => {
  if (!url) {
    return ""
  }

  try {
    const parsed = new URL(normalizeDocumentUrl(url))
    return `${parsed.origin.toLowerCase()}${parsed.pathname}${parsed.search}`
  } catch {
    return normalizeDocumentUrl(url)
  }
}

const getUrlHost = (url: string): string => {
  if (!url) {
    return ""
  }

  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ""
  }
}

const normalizeDocumentUrl = (url: string): string => {
  if (!url) {
    return ""
  }

  try {
    const parsed = new URL(url)
    parsed.hash = ""
    return parsed.toString()
  } catch {
    return url
  }
}

const isTargetAuditUrl = (url: string): boolean => {
  if (!url) {
    return false
  }

  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" && TARGET_HOSTS.has(parsed.hostname)
  } catch {
    return false
  }
}

const isCacheControlUrl = (url: string): boolean => {
  if (!url) {
    return false
  }

  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" && CACHE_CONTROL_HOSTS.has(parsed.hostname)
  } catch {
    return false
  }
}

const getOrCreateSession = (tabId: number): TabSession => {
  const existing = sessionsByTabId.get(tabId)
  if (existing) {
    return existing
  }

  const created: TabSession = {
    attachError: null,
    attachPromise: null,
    attached: false,
    childSessionIds: new Set<string>(),
    isTopNavigationInProgress: false,
    lastNavigationUrl: "",
    requestKeyByRequestId: new Map<string, string>(),
    requestSequenceByRequestId: new Map<string, number>(),
    requests: new Map<string, RequestMetric>()
  }

  sessionsByTabId.set(tabId, created)
  return created
}

const clearSessionMetrics = (session: TabSession) => {
  session.requestKeyByRequestId.clear()
  session.requestSequenceByRequestId.clear()
  session.requests.clear()
}

const getDisableCacheSetting = (): Promise<boolean> =>
  new Promise((resolve) => {
    chrome.storage.sync.get([DISABLE_CACHE_KEY], (result) => {
      resolve(parseDisableCache(result[DISABLE_CACHE_KEY]))
    })
  })

const sendDebuggerCommand = <T>(
  debuggee: DebuggeeWithSession,
  method: string,
  params?: Record<string, unknown>
): Promise<T> =>
  new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(
      debuggee as chrome.debugger.Debuggee,
      method,
      params,
      (result) => {
        const err = chrome.runtime.lastError
        if (err) {
          reject(new Error(err.message))
          return
        }

        resolve(result as T)
      }
    )
  })

const attachDebugger = (tabId: number): Promise<void> =>
  new Promise((resolve, reject) => {
    chrome.debugger.attach({ tabId }, DEBUGGER_PROTOCOL_VERSION, () => {
      const err = chrome.runtime.lastError
      if (err) {
        reject(new Error(err.message))
        return
      }

      resolve()
    })
  })

const setCacheDisabledForDebuggee = async (debuggee: DebuggeeWithSession) => {
  await sendDebuggerCommand<void>(debuggee, "Network.setCacheDisabled", {
    cacheDisabled: disableCacheEnabled
  })
}

const clearBrowserCacheForTab = async (tabId: number) => {
  await sendDebuggerCommand<void>({ tabId }, "Network.clearBrowserCache")
}

const syncCachePolicyForSession = async (
  tabId: number,
  session: TabSession,
  shouldClearCache: boolean
) => {
  if (!session.attached) {
    return
  }

  try {
    await setCacheDisabledForDebuggee({ tabId })
  } catch {
    // Ignore when debugger target is not ready anymore.
  }

  for (const childSessionId of session.childSessionIds) {
    try {
      await setCacheDisabledForDebuggee({ sessionId: childSessionId, tabId })
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
        await setCacheDisabledForDebuggee(rootDebuggee)
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
        setCacheDisabledForDebuggee({ sessionId: attachedSessionId, tabId })
      )
      .catch(() => undefined)
    return
  }

  if (method === "Network.requestWillBeSent") {
    const requestId = typeof params?.requestId === "string" ? params.requestId : ""
    if (!requestId) {
      return
    }

    const scopedRequestId = getScopedRequestId(source, requestId)
    const hasRedirectResponse = Boolean(params?.redirectResponse)
    const currentSequence =
      session.requestSequenceByRequestId.get(scopedRequestId) ?? 0
    const nextSequence = hasRedirectResponse ? currentSequence + 1 : currentSequence
    session.requestSequenceByRequestId.set(scopedRequestId, nextSequence)

    const requestKey = `${scopedRequestId}#${nextSequence}`
    session.requestKeyByRequestId.set(scopedRequestId, requestKey)
    const documentUrl = normalizeDocumentUrl(
      typeof params?.documentURL === "string" ? params.documentURL : ""
    )

    const requestUrlRecord =
      typeof params?.request === "object" && params.request !== null
        ? (params.request as Record<string, unknown>)
        : undefined
    const requestUrlValue =
      requestUrlRecord && typeof requestUrlRecord.url === "string"
        ? requestUrlRecord.url
        : ""
    const requestType = typeof params?.type === "string" ? params.type : ""
    const frameId = typeof params?.frameId === "string" ? params.frameId : ""
    const loaderId = typeof params?.loaderId === "string" ? params.loaderId : ""
    const normalizedRequestUrl = normalizeDocumentUrl(requestUrlValue)
    const effectiveDocumentUrl =
      documentUrl ||
      (requestType === "Document" ? normalizedRequestUrl : "")

    session.requests.set(requestKey, {
      completed: false,
      decodedBytes: 0,
      documentKey: getDocumentKey(effectiveDocumentUrl),
      documentUrl: effectiveDocumentUrl,
      encodedBytesFromChunks: 0,
      frameId,
      finalEncodedBytes: null,
      loaderId,
      requestUrl: requestUrlValue,
      requestType,
      requestUrlHost: getUrlHost(requestUrlValue),
      startedAt: Date.now()
    })
    return
  }

  if (method === "Network.dataReceived") {
    const requestId = typeof params?.requestId === "string" ? params.requestId : ""
    if (!requestId) {
      return
    }

    const requestKey = getRequestKey(session, getScopedRequestId(source, requestId))
    const metric = getOrCreateRequestMetric(session, requestKey)
    metric.decodedBytes += asNumber(params?.dataLength)
    metric.encodedBytesFromChunks += asNumber(params?.encodedDataLength)
    return
  }

  if (method === "Network.loadingFinished") {
    const requestId = typeof params?.requestId === "string" ? params.requestId : ""
    if (!requestId) {
      return
    }

    const requestKey = getRequestKey(session, getScopedRequestId(source, requestId))
    const metric = getOrCreateRequestMetric(session, requestKey)
    metric.completed = true
    metric.finalEncodedBytes = asNumber(params?.encodedDataLength)
    return
  }

  if (method === "Network.loadingFailed") {
    const requestId = typeof params?.requestId === "string" ? params.requestId : ""
    if (!requestId) {
      return
    }

    const requestKey = getRequestKey(session, getScopedRequestId(source, requestId))
    const metric = session.requests.get(requestKey)
    if (metric) {
      metric.completed = true
    }
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

const getEnhancedStatsErrorPayload = (reason: string) => ({
  available: false,
  requestDetails: [],
  reason,
  resources: 0,
  tabRequestDetails: [],
  tabResources: 0,
  tabTrackedRequests: 0,
  tabTransferred: 0,
  trackedRequests: 0,
  transferred: 0
})

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

  sessionsByTabId.delete(tabId)
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

  chrome.tabs.create({
    url: chrome.runtime.getURL("tabs/welcome.html")
  })
})

getDisableCacheSetting()
  .then((value) => {
    disableCacheEnabled = value
  })
  .catch(() => undefined)

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync" || !changes[DISABLE_CACHE_KEY]) {
    return
  }

  const nextValue = parseDisableCache(changes[DISABLE_CACHE_KEY].newValue)
  const shouldClearCache = !disableCacheEnabled && nextValue
  disableCacheEnabled = nextValue
  syncCachePolicyForAttachedTabs(shouldClearCache)
})

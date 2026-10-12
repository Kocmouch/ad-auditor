import type { DebuggeeWithSession, RequestMetric, TabSession } from "./types"
import { asNumber } from "~lib/utils/formatters"
import { getDocumentKey, getUrlHost, normalizeDocumentUrl } from "~lib/utils/formatters"

export const getRequestKey = (session: TabSession, requestId: string): string => {
  const mapped = session.requestKeyByRequestId.get(requestId)
  if (mapped) {
    return mapped
  }

  const fallback = `${requestId}#0`
  session.requestKeyByRequestId.set(requestId, fallback)
  return fallback
}

export const getScopedRequestId = (
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

export const getOrCreateRequestMetric = (
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

export const handleNetworkRequestWillBeSent = (
  session: TabSession,
  source: chrome.debugger.Debuggee,
  params?: Record<string, unknown>
) => {
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
}

export const handleNetworkDataReceived = (
  session: TabSession,
  source: chrome.debugger.Debuggee,
  params?: Record<string, unknown>
) => {
  const requestId = typeof params?.requestId === "string" ? params.requestId : ""
  if (!requestId) {
    return
  }

  const requestKey = getRequestKey(session, getScopedRequestId(source, requestId))
  const metric = getOrCreateRequestMetric(session, requestKey)
  metric.decodedBytes += asNumber(params?.dataLength)
  metric.encodedBytesFromChunks += asNumber(params?.encodedDataLength)
}

export const handleNetworkLoadingFinished = (
  session: TabSession,
  source: chrome.debugger.Debuggee,
  params?: Record<string, unknown>
) => {
  const requestId = typeof params?.requestId === "string" ? params.requestId : ""
  if (!requestId) {
    return
  }

  const requestKey = getRequestKey(session, getScopedRequestId(source, requestId))
  const metric = getOrCreateRequestMetric(session, requestKey)
  metric.completed = true
  metric.finalEncodedBytes = asNumber(params?.encodedDataLength)
}

export const handleNetworkLoadingFailed = (
  session: TabSession,
  source: chrome.debugger.Debuggee,
  params?: Record<string, unknown>
) => {
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

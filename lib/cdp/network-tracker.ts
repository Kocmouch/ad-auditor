import {
  asNumber,
  getDocumentKey,
  getUrlHost,
  normalizeDocumentUrl
} from "~lib/utils/formatters"

import type {
  DebuggeeWithSession,
  RequestMetric,
  RequestProblemFields,
  TabSession
} from "./types"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

/** Case-insensitive header lookup (CDP header names keep the wire casing). */
const getHeader = (headers: unknown, name: string): string | undefined => {
  if (!isRecord(headers)) {
    return undefined
  }

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === name && typeof value === "string") {
      return value
    }
  }
  return undefined
}

/** Only the problem-detection fields that are actually set, for the wire. */
export const getRequestProblemFields = (
  metric: RequestMetric
): RequestProblemFields => {
  const fields: RequestProblemFields = {}
  if (metric.httpStatus !== undefined) fields.httpStatus = metric.httpStatus
  if (metric.failed) fields.failed = true
  if (metric.blocked) fields.blocked = true
  if (metric.errorText) fields.errorText = metric.errorText
  if (metric.contentEncoding !== undefined) {
    fields.contentEncoding = metric.contentEncoding
  }
  if (metric.completed && metric.decodedBytes > 0) {
    fields.decodedBytes = metric.decodedBytes
  }
  if (metric.redirectChain && metric.redirectChain.length > 0) {
    fields.redirectChain = metric.redirectChain
  }
  return fields
}

export const getRequestKey = (
  session: TabSession,
  requestId: string
): string => {
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
  const requestId =
    typeof params?.requestId === "string" ? params.requestId : ""
  if (!requestId) {
    return
  }

  const scopedRequestId = getScopedRequestId(source, requestId)
  const hasRedirectResponse = Boolean(params?.redirectResponse)
  const currentSequence =
    session.requestSequenceByRequestId.get(scopedRequestId) ?? 0
  const nextSequence = hasRedirectResponse
    ? currentSequence + 1
    : currentSequence
  session.requestSequenceByRequestId.set(scopedRequestId, nextSequence)

  const requestKey = `${scopedRequestId}#${nextSequence}`
  const previousMetric = hasRedirectResponse
    ? session.requests.get(`${scopedRequestId}#${currentSequence}`)
    : undefined
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
    documentUrl || (requestType === "Document" ? normalizedRequestUrl : "")

  let redirectChain: string[] | undefined
  if (previousMetric) {
    const status = isRecord(params?.redirectResponse)
      ? params.redirectResponse.status
      : undefined
    if (typeof status === "number" && status > 0) {
      previousMetric.httpStatus = status
    }
    redirectChain = [
      ...(previousMetric.redirectChain ?? []),
      previousMetric.requestUrl
    ]
  }

  session.requests.set(requestKey, {
    ...(redirectChain ? { redirectChain } : {}),
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

export const handleNetworkResponseReceived = (
  session: TabSession,
  source: chrome.debugger.Debuggee,
  params?: Record<string, unknown>
) => {
  const requestId =
    typeof params?.requestId === "string" ? params.requestId : ""
  const response = params?.response
  if (!requestId || !isRecord(response)) {
    return
  }

  const metric = session.requests.get(
    getRequestKey(session, getScopedRequestId(source, requestId))
  )
  if (!metric) {
    return
  }

  if (typeof response.status === "number" && response.status > 0) {
    metric.httpStatus = response.status
  }

  // Headers are only meaningful for network responses (not data:/blob:).
  if (typeof response.url === "string" && /^https?:/i.test(response.url)) {
    metric.contentEncoding = getHeader(response.headers, "content-encoding") ?? ""
  }
}

export const handleNetworkDataReceived = (
  session: TabSession,
  source: chrome.debugger.Debuggee,
  params?: Record<string, unknown>
) => {
  const requestId =
    typeof params?.requestId === "string" ? params.requestId : ""
  if (!requestId) {
    return
  }

  const requestKey = getRequestKey(
    session,
    getScopedRequestId(source, requestId)
  )
  const metric = getOrCreateRequestMetric(session, requestKey)
  metric.decodedBytes += asNumber(params?.dataLength)
  metric.encodedBytesFromChunks += asNumber(params?.encodedDataLength)
}

export const handleNetworkLoadingFinished = (
  session: TabSession,
  source: chrome.debugger.Debuggee,
  params?: Record<string, unknown>
) => {
  const requestId =
    typeof params?.requestId === "string" ? params.requestId : ""
  if (!requestId) {
    return
  }

  const requestKey = getRequestKey(
    session,
    getScopedRequestId(source, requestId)
  )
  const metric = getOrCreateRequestMetric(session, requestKey)
  metric.completed = true
  metric.finalEncodedBytes = asNumber(params?.encodedDataLength)
}

export const handleNetworkLoadingFailed = (
  session: TabSession,
  source: chrome.debugger.Debuggee,
  params?: Record<string, unknown>
) => {
  const requestId =
    typeof params?.requestId === "string" ? params.requestId : ""
  if (!requestId) {
    return
  }

  const requestKey = getRequestKey(
    session,
    getScopedRequestId(source, requestId)
  )
  const metric = session.requests.get(requestKey)
  if (metric) {
    metric.completed = true
    // Cancellations (navigation, aborted ads) are not problems on their own.
    const blockedReason =
      typeof params?.blockedReason === "string" ? params.blockedReason : ""
    const errorText =
      typeof params?.errorText === "string" ? params.errorText : ""
    if (blockedReason) {
      metric.blocked = true
      metric.errorText = blockedReason
    } else if (params?.canceled !== true) {
      metric.failed = true
      metric.errorText = errorText
    }
  }
}

export type DebuggeeWithSession = chrome.debugger.Debuggee & {
  sessionId?: string
}

export type RequestMetric = {
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

export type RequestDetails = {
  host: string
  resources: number
  status: "done" | "pending"
  transferred: number
  type: string
  url: string
}

export type TabSession = {
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

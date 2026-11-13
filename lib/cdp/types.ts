import type { RequestRecord } from "~lib/features/request-errors"

export type DebuggeeWithSession = chrome.debugger.Debuggee & {
  sessionId?: string
}

/** Optional extras filled from CDP Network events (see network-tracker). */
export type RequestProblemFields = Pick<
  RequestRecord,
  | "blocked"
  | "contentEncoding"
  | "decodedBytes"
  | "errorText"
  | "failed"
  | "httpStatus"
  | "redirectChain"
>

export type RequestMetric = RequestProblemFields & {
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

export type RequestDetails = RequestProblemFields & {
  host: string
  resources: number
  status: "done" | "pending"
  transferred: number
  type: string
  url: string
}

export type ConsoleProblemKind =
  | "exception"
  | "console-error"
  | "console-warning"
  | "log-error"
  | "log-warning"
  | "issue"

export type ConsoleProblem = {
  column?: number
  count: number
  frameId?: string
  kind: ConsoleProblemKind
  line?: number
  message: string
  severity: "error" | "warning" | "info"
  timestamp: number
  url?: string
}

export type TabSession = {
  attachError: string | null
  attachPromise: Promise<void> | null
  attached: boolean
  childSessionIds: Set<string>
  consoleProblems: ConsoleProblem[]
  isTopNavigationInProgress: boolean
  lastNavigationUrl: string
  requestKeyByRequestId: Map<string, string>
  requestSequenceByRequestId: Map<string, number>
  requests: Map<string, RequestMetric>
}

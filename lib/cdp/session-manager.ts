import type { TabSession, RequestMetric } from "./types"

export const sessionsByTabId = new Map<number, TabSession>()

export const getOrCreateSession = (tabId: number): TabSession => {
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

export const clearSessionMetrics = (session: TabSession) => {
  session.requestKeyByRequestId.clear()
  session.requestSequenceByRequestId.clear()
  session.requests.clear()
}

export const removeSession = (tabId: number) => {
  sessionsByTabId.delete(tabId)
}

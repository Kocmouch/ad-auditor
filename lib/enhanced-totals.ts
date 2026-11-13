import type { Totals } from "~lib/features/snapshot"
import { sanitizeRequestItems, type EnhancedStatsResponse } from "~lib/messaging"

export type EnhancedTotalsResult =
  /** Background reports CDP data unavailable (or the call failed). */
  | { kind: "unavailable" }
  /** Nothing tracked yet; keep the last good snapshot to avoid flicker. */
  | { kind: "empty" }
  | { kind: "totals"; totals: Totals }

const toCount = (value: unknown): number => Math.max(0, Number(value) || 0)

/**
 * Interprets a get-enhanced-stats response. In the top frame, falls back to
 * tab-wide numbers when the document itself has no tracked requests.
 */
export const interpretEnhancedStats = (
  response: EnhancedStatsResponse | null,
  isIframeContext: boolean
): EnhancedTotalsResult => {
  if (!response?.ok || !response?.available) {
    return { kind: "unavailable" }
  }

  const trackedRequests = toCount(response.trackedRequests)
  const tabTrackedRequests = toCount(response.tabTrackedRequests)

  if (trackedRequests === 0 && tabTrackedRequests === 0) {
    return { kind: "empty" }
  }

  const useTabFallback =
    !isIframeContext && trackedRequests === 0 && tabTrackedRequests > 0

  return {
    kind: "totals",
    totals: {
      requestItems: sanitizeRequestItems(
        useTabFallback ? response.tabRequestDetails : response.requestDetails
      ),
      requests: useTabFallback ? tabTrackedRequests : trackedRequests,
      resources: toCount(
        useTabFallback ? response.tabResources : response.resources
      ),
      transferred: toCount(
        useTabFallback ? response.tabTransferred : response.transferred
      )
    }
  }
}

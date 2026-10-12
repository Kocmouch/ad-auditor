import type { RequestDetails } from "~lib/cdp/types"

type RequestItem = {
  host: string
  resources: number
  status: "done" | "pending"
  transferred: number
  type: string
  url: string
}

export const getEnhancedStatsErrorPayload = (reason: string) => ({
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

export const buildRequestDetails = (
  transferred: number,
  resources: number,
  status: "done" | "pending",
  host: string,
  type: string,
  url: string
): RequestDetails => ({
  host,
  resources: Math.max(0, Math.round(resources)),
  status,
  transferred: Math.max(0, Math.round(transferred)),
  type: type || "Other",
  url: url || "(unknown URL)"
})

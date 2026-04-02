import type { RequestListItem } from "~lib/request-list"

export type AuditTotals = {
  requests: number
  resources: number
  transferred: number
}

export type WaterfallEntry = {
  label: string
  ratio: number
  resources: number
  transferred: number
}

const getDominantLabel = (item: RequestListItem): string => {
  if (item.host) {
    return item.host
  }

  return item.url || "(unknown)"
}

export const filterFocusOffenders = (
  items: RequestListItem[],
  limitBytes: number
): RequestListItem[] => {
  const threshold = Math.max(Math.round(limitBytes * 0.15), 50 * 1024)

  return items.filter(
    (item) =>
      item.status === "pending" ||
      item.transferred >= threshold ||
      item.resources >= threshold
  )
}

export const buildWaterfallLite = (
  items: RequestListItem[],
  maxBars = 5
): WaterfallEntry[] => {
  const sorted = [...items]
    .sort((left, right) => right.transferred - left.transferred)
    .slice(0, maxBars)
  const maxTransferred = Math.max(1, ...sorted.map((item) => item.transferred))

  return sorted.map((item) => ({
    label: getDominantLabel(item),
    ratio: Math.max(0.06, item.transferred / maxTransferred),
    resources: item.resources,
    transferred: item.transferred
  }))
}

export const buildEnglishAlerts = (
  totals: AuditTotals,
  items: RequestListItem[],
  limitBytes: number
): string[] => {
  const alerts: string[] = []

  if (totals.requests === 0) {
    alerts.push("No network requests captured yet.")
    return alerts
  }

  const pendingCount = items.filter((item) => item.status === "pending").length
  if (pendingCount > 0) {
    alerts.push(`${pendingCount} request(s) are still pending.`)
  }

  if (totals.requests >= 120) {
    alerts.push(`High request volume detected (${totals.requests} requests).`)
  }

  if (totals.transferred > limitBytes) {
    alerts.push("Transferred bytes exceed your configured limit.")
  }

  if (totals.resources > limitBytes) {
    alerts.push("Resource bytes exceed your configured limit.")
  }

  const heavyThreshold = Math.max(Math.round(limitBytes * 0.35), 150 * 1024)
  const heavyRequest = items.find(
    (item) => item.transferred >= heavyThreshold || item.resources >= heavyThreshold
  )
  if (heavyRequest) {
    alerts.push(`Heavy request spotted on ${getDominantLabel(heavyRequest)}.`)
  }

  if (alerts.length === 0) {
    alerts.push("No obvious network issues detected.")
  }

  return alerts.slice(0, 3)
}

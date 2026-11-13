import type { Totals } from "~lib/features/snapshot"
import type { RequestListItem } from "~lib/request-list"

type SizedEntry = {
  decodedBodySize?: number
  encodedBodySize?: number
  transferSize?: number
}

type NamedEntry = SizedEntry & {
  initiatorType?: string
  name?: string
}

const addEntrySizes = (totals: Totals, entry: SizedEntry) => {
  const transferSize = Math.max(0, entry.transferSize || 0)
  const decodedBodySize = Math.max(0, entry.decodedBodySize || 0)
  const encodedBodySize = Math.max(0, entry.encodedBodySize || 0)

  totals.transferred += transferSize
  totals.resources += Math.max(decodedBodySize, encodedBodySize)
}

const hostnameOf = (url: string): string => {
  try {
    return new URL(url).hostname
  } catch {
    return ""
  }
}

export const createEmptyTotals = (): Totals => ({
  requestItems: [],
  requests: 0,
  resources: 0,
  transferred: 0
})

/** Builds totals from Performance API entries (legacy measurement method). */
export const buildLegacyTotals = (
  resourceEntries: NamedEntry[],
  navigationEntry: SizedEntry | undefined,
  documentInfo: { hostname: string; href: string }
): Totals => {
  const requestItems: RequestListItem[] = []
  const totals: Totals = {
    requestItems,
    requests: 0,
    resources: 0,
    transferred: 0
  }

  for (const entry of resourceEntries) {
    addEntrySizes(totals, entry)
    requestItems.push({
      host: hostnameOf(entry.name ?? ""),
      resources: Math.max(
        0,
        entry.decodedBodySize || entry.encodedBodySize || 0
      ),
      status: "done",
      transferred: Math.max(0, entry.transferSize || 0),
      type: entry.initiatorType || "resource",
      url: entry.name || "(resource)"
    })
  }
  totals.requests += resourceEntries.length

  if (navigationEntry) {
    addEntrySizes(totals, navigationEntry)
    totals.requests += 1
    requestItems.push({
      host: documentInfo.hostname,
      resources: Math.max(
        0,
        navigationEntry.decodedBodySize || navigationEntry.encodedBodySize || 0
      ),
      status: "done",
      transferred: Math.max(0, navigationEntry.transferSize || 0),
      type: "document",
      url: documentInfo.href
    })
  }

  return totals
}

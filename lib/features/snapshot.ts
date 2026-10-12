export type Totals = {
  requestItems: RequestItem[]
  requests: number
  resources: number
  transferred: number
}

export type RequestItem = {
  host: string
  resources: number
  status: "done" | "pending"
  transferred: number
  type: string
  url: string
}

export const saveSnapshot = (
  url: string,
  totals: Totals,
  snapshotStore: Map<string, Totals & { capturedAt: number }>
) => {
  if (!url) {
    return
  }

  snapshotStore.set(url, {
    ...totals,
    capturedAt: Date.now()
  })
}

export const compareSnapshot = (
  url: string,
  currentTotals: Totals,
  snapshotStore: Map<string, Totals & { capturedAt: number }>
): string => {
  if (!url) {
    return "No snapshot target URL available."
  }

  const saved = snapshotStore.get(url)
  if (!saved) {
    return "No snapshot saved for this URL."
  }

  const transferredDelta = currentTotals.transferred - saved.transferred
  const resourcesDelta = currentTotals.resources - saved.resources
  const requestsDelta = currentTotals.requests - saved.requests
  const formatSigned = (value: number) => (value >= 0 ? `+${value}` : `${value}`)

  return `delta req ${formatSigned(requestsDelta)}, delta tr ${formatSigned(Math.round(transferredDelta / 1000))} kB, delta res ${formatSigned(Math.round(resourcesDelta / 1000))} kB`
}

export const getSnapshotInfo = (
  url: string,
  snapshotStore: Map<string, Totals & { capturedAt: number }>
): string => {
  const existing = snapshotStore.get(url)
  return existing
    ? `Saved ${new Date(existing.capturedAt).toLocaleTimeString()}`
    : "No snapshot saved"
}

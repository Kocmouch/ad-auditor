import {
  CHECK_NAMES,
  getOverallStatus,
  type CheckName,
  type CheckOutcome,
  type CheckOutcomes,
  type OverallStatus
} from "~lib/audit-summary"

export type AuditReportRow = {
  /** Creative identifier (iframe id/name, or its position on the page). */
  id: string
  /** "300x250" or "-" when unknown. */
  size: string
  checks: CheckOutcomes
}

export const CHECK_LABELS: Record<CheckName, string> = {
  accessibility: "Accessibility",
  content: "Content",
  fonts: "Fonts",
  requests: "Requests"
}

const STATUS_LABELS: Record<OverallStatus, string> = {
  amber: "warning",
  green: "ok",
  none: "-",
  red: "error"
}

export const describeCreative = (
  frame: { id?: string; name?: string; width: number; height: number },
  index: number
): { id: string; size: string } => ({
  id: frame.id || frame.name || `#${index + 1}`,
  size:
    frame.width > 0 && frame.height > 0
      ? `${Math.round(frame.width)}x${Math.round(frame.height)}`
      : "-"
})

/** "ok", "warning (3)" or "-" when the check did not run. */
export const formatOutcome = (outcome: CheckOutcome | undefined): string => {
  if (!outcome) {
    return "-"
  }
  return outcome.severity === "ok" || outcome.count === 0
    ? outcome.severity
    : `${outcome.severity} (${outcome.count})`
}

export const getRowStatusLabel = (row: AuditReportRow): string =>
  STATUS_LABELS[getOverallStatus(row.checks)]

const escapeCell = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\s+/g, " ")

/** Markdown report: one table row per creative. */
export const formatAuditReportMarkdown = (
  rows: AuditReportRow[],
  options: { pageUrl?: string; generatedAt?: Date } = {}
): string => {
  const lines = ["# Ad Auditor report", ""]
  if (options.pageUrl) {
    lines.push(`Page: ${options.pageUrl}`)
  }
  if (options.generatedAt) {
    lines.push(`Generated: ${options.generatedAt.toISOString()}`)
  }
  if (options.pageUrl || options.generatedAt) {
    lines.push("")
  }

  if (rows.length === 0) {
    lines.push("No creatives were audited.")
    return lines.join("\n")
  }

  const header = [
    "Creative",
    "Size",
    ...CHECK_NAMES.map((name) => CHECK_LABELS[name]),
    "Overall"
  ]
  lines.push(
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`
  )
  for (const row of rows) {
    const cells = [
      escapeCell(row.id),
      escapeCell(row.size),
      ...CHECK_NAMES.map((name) => formatOutcome(row.checks[name])),
      getRowStatusLabel(row)
    ]
    lines.push(`| ${cells.join(" | ")} |`)
  }

  return lines.join("\n")
}

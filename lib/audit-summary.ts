/**
 * Pure aggregation of per-check results into one status for a creative.
 * A check that has not run is simply absent from `CheckOutcomes`.
 */
export type CheckName = "fonts" | "accessibility" | "content" | "requests"

export type CheckSeverity = "ok" | "info" | "warning" | "error"

export type CheckOutcome = { severity: CheckSeverity; count: number }

export type CheckOutcomes = Partial<Record<CheckName, CheckOutcome>>

/** Traffic light shown on the stats bar; "none" until a check has run. */
export type OverallStatus = "none" | "green" | "amber" | "red"

export const CHECK_NAMES: readonly CheckName[] = [
  "fonts",
  "accessibility",
  "content",
  "requests"
]

const RANK: Record<CheckSeverity, number> = {
  ok: 0,
  info: 1,
  warning: 2,
  error: 3
}

export const isCheckSeverity = (value: unknown): value is CheckSeverity =>
  typeof value === "string" && value in RANK

export const worstSeverity = (
  severities: ReadonlyArray<CheckSeverity | undefined>
): CheckSeverity => {
  let worst: CheckSeverity = "ok"
  for (const severity of severities) {
    if (severity && RANK[severity] > RANK[worst]) {
      worst = severity
    }
  }
  return worst
}

/** Outcome of a list of issues that each carry a severity. */
export const outcomeFromSeverities = (
  severities: ReadonlyArray<CheckSeverity>
): CheckOutcome => ({
  count: severities.length,
  severity: worstSeverity(severities)
})

export const fontOutcome = (mismatchCount: number): CheckOutcome => ({
  count: mismatchCount,
  severity: mismatchCount > 0 ? "warning" : "ok"
})

type OptOutType =
  | "missing"
  | "low-contrast"
  | "hidden"
  | "contrast-unverifiable"
type BorderType = "missing" | "invisible"

export const accessibilityOutcome = (
  optOutIssues: ReadonlyArray<{ issueType: OptOutType }>,
  borderIssues: ReadonlyArray<{ issueType: BorderType }>
): CheckOutcome =>
  outcomeFromSeverities([
    ...optOutIssues.map(
      (issue): CheckSeverity =>
        issue.issueType === "contrast-unverifiable" ? "info" : "error"
    ),
    ...borderIssues.map(
      (issue): CheckSeverity =>
        issue.issueType === "invisible" ? "warning" : "error"
    )
  ])

export const contentOutcome = (
  issues: ReadonlyArray<{ severity: CheckSeverity }>
): CheckOutcome => outcomeFromSeverities(issues.map((issue) => issue.severity))

export const requestOutcome = (summary: {
  total: number
  errors: number
}): CheckOutcome => ({
  count: summary.total,
  severity: summary.errors > 0 ? "error" : summary.total > 0 ? "warning" : "ok"
})

/**
 * Adds the request-problems outcome, but only once some other check has run
 * (the status dot is hidden until the user audits the creative).
 */
export const withRequestOutcome = (
  checks: CheckOutcomes,
  requests: CheckOutcome
): CheckOutcomes =>
  Object.keys(checks).length === 0 ? checks : { ...checks, requests }

export const getOverallStatus = (checks: CheckOutcomes): OverallStatus => {
  const outcomes = CHECK_NAMES.map((name) => checks[name]).filter(
    (outcome): outcome is CheckOutcome => outcome !== undefined
  )
  if (outcomes.length === 0) {
    return "none"
  }

  const worst = worstSeverity(outcomes.map((outcome) => outcome.severity))
  return worst === "error" ? "red" : worst === "warning" ? "amber" : "green"
}

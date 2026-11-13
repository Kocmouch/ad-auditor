import type { ConsoleProblem } from "~lib/cdp/types"

/** Rows shown in the request panel before "+N more". */
export const MAX_CONSOLE_ROWS = 5

const FAILED_RESOURCE = /^failed to load resource/i

/**
 * Log.entryAdded "Failed to load resource" entries duplicate what network
 * tracking already reports (Network.loadingFailed / HTTP errors), so they are
 * skipped here.
 */
export const filterConsoleProblems = (
  problems: ReadonlyArray<ConsoleProblem>
): ConsoleProblem[] =>
  problems.filter(
    (problem) =>
      !(
        (problem.kind === "log-error" || problem.kind === "log-warning") &&
        FAILED_RESOURCE.test(problem.message)
      )
  )

export type ConsoleRowView = {
  /** Short kind marker: "!" for errors/exceptions, "~" for warnings, "i" otherwise. */
  icon: string
  message: string
  severity: ConsoleProblem["severity"]
  /** "x3" or "" when it happened once. */
  countText: string
  /** "file.js:12" or "". */
  source: string
}

export type ConsoleView = {
  rows: ConsoleRowView[]
  /** "+N more" or "". */
  footer: string
  errors: number
  warnings: number
  total: number
}

const ICONS: Record<ConsoleProblem["kind"], string> = {
  "console-error": "!",
  "console-warning": "~",
  exception: "!",
  issue: "i",
  "log-error": "!",
  "log-warning": "~"
}

const shortSource = (url: string | undefined, line: number | undefined) => {
  if (!url) {
    return ""
  }
  let name = url
  try {
    const parsed = new URL(url)
    name = parsed.pathname.split("/").filter(Boolean).pop() || parsed.hostname
  } catch {
    // keep the raw url
  }
  return line ? `${name}:${line}` : name
}

/** Errors first, then warnings, then info; capped at `max` rows. */
export const buildConsoleView = (
  problems: ReadonlyArray<ConsoleProblem>,
  max: number = MAX_CONSOLE_ROWS
): ConsoleView => {
  const visible = filterConsoleProblems(problems)
  const rank = { error: 0, info: 2, warning: 1 } as const
  const sorted = [...visible].sort(
    (a, b) => rank[a.severity] - rank[b.severity] || b.count - a.count
  )
  return {
    errors: visible.filter((p) => p.severity === "error").length,
    footer: sorted.length > max ? `+${sorted.length - max} more` : "",
    rows: sorted.slice(0, max).map((problem) => ({
      countText: problem.count > 1 ? `x${problem.count}` : "",
      icon: ICONS[problem.kind],
      message: problem.message,
      severity: problem.severity,
      source: shortSource(problem.url, problem.line)
    })),
    total: visible.length,
    warnings: visible.filter((p) => p.severity === "warning").length
  }
}

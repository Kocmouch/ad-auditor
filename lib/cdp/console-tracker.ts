import type { ConsoleProblem, TabSession } from "./types"

export const MAX_CONSOLE_PROBLEMS = 100
export const MAX_CONSOLE_MESSAGE_LENGTH = 300

type Params = Record<string, unknown> | undefined
type ProblemInput = Omit<ConsoleProblem, "count" | "timestamp">
type ProblemStore = Pick<TabSession, "consoleProblems">

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const asString = (value: unknown): string =>
  typeof value === "string" ? value : ""

export const trimMessage = (message: string): string => {
  const trimmed = message.trim()
  return trimmed.length > MAX_CONSOLE_MESSAGE_LENGTH
    ? `${trimmed.slice(0, MAX_CONSOLE_MESSAGE_LENGTH - 1)}…`
    : trimmed
}

/** CDP line/column numbers are 0-based; the wire format is 1-based. */
const toOneBased = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value + 1
    : undefined

/** Adds a problem or bumps the count of an identical one. Returns true if the list changed. */
export const addConsoleProblem = (
  session: ProblemStore,
  input: ProblemInput,
  now: number = Date.now()
): boolean => {
  const message = trimMessage(input.message)
  if (!message) {
    return false
  }

  const problems = session.consoleProblems
  const existing = problems.find(
    (p) =>
      p.kind === input.kind &&
      p.message === message &&
      (p.url ?? "") === (input.url ?? "") &&
      p.line === input.line
  )
  if (existing) {
    existing.count += 1
    existing.timestamp = now
    return true
  }

  if (problems.length >= MAX_CONSOLE_PROBLEMS) {
    return false
  }

  const problem: ConsoleProblem = {
    count: 1,
    kind: input.kind,
    message,
    severity: input.severity,
    timestamp: now
  }
  if (input.url) problem.url = input.url
  if (input.line !== undefined) problem.line = input.line
  if (input.column !== undefined) problem.column = input.column
  if (input.frameId) problem.frameId = input.frameId
  problems.push(problem)
  return true
}

/** Runtime.exceptionThrown: uncaught JS errors and unhandled rejections. */
export const handleRuntimeExceptionThrown = (
  session: ProblemStore,
  params?: Params
) => {
  const details = params?.exceptionDetails
  if (!isRecord(details)) {
    return
  }

  const exception = isRecord(details.exception) ? details.exception : undefined
  // description is "Error: msg\n    at ..." - keep only the first line.
  const firstLine = asString(exception?.description).split("\n")[0]?.trim()
  const message = firstLine || asString(exception?.value) || asString(details.text)

  addConsoleProblem(session, {
    column: toOneBased(details.columnNumber),
    kind: "exception",
    line: toOneBased(details.lineNumber),
    message,
    severity: "error",
    url: asString(details.url) || undefined
  })
}

const stringifyConsoleArg = (arg: unknown): string => {
  if (!isRecord(arg)) {
    return ""
  }
  if (typeof arg.value === "string") return arg.value
  if (
    typeof arg.value === "number" ||
    typeof arg.value === "boolean" ||
    arg.value === null
  ) {
    return String(arg.value)
  }
  const description = asString(arg.description)
  if (description) return description.split("\n")[0] ?? ""
  return asString(arg.type)
}

/** Runtime.consoleAPICalled: only console.error / console.warn. */
export const handleRuntimeConsoleApiCalled = (
  session: ProblemStore,
  params?: Params
) => {
  const type = asString(params?.type)
  if (type !== "error" && type !== "warning") {
    return
  }

  const args = Array.isArray(params?.args) ? params.args : []
  const message = args.map(stringifyConsoleArg).filter(Boolean).join(" ")

  const stackTrace = isRecord(params?.stackTrace) ? params.stackTrace : undefined
  const frames = Array.isArray(stackTrace?.callFrames)
    ? stackTrace.callFrames
    : []
  const top = isRecord(frames[0]) ? frames[0] : undefined

  addConsoleProblem(session, {
    column: toOneBased(top?.columnNumber),
    kind: type === "error" ? "console-error" : "console-warning",
    line: toOneBased(top?.lineNumber),
    message,
    severity: type,
    url: asString(top?.url) || undefined
  })
}

/** Log.entryAdded: browser-generated messages (network, deprecation, intervention...). */
export const handleLogEntryAdded = (session: ProblemStore, params?: Params) => {
  const entry = params?.entry
  if (!isRecord(entry)) {
    return
  }

  const level = asString(entry.level)
  if (level !== "error" && level !== "warning") {
    return
  }

  addConsoleProblem(session, {
    kind: level === "error" ? "log-error" : "log-warning",
    line: toOneBased(entry.lineNumber),
    message: asString(entry.text),
    severity: level,
    url: asString(entry.url) || undefined
  })
}

/**
 * Audits.issueAdded: only heavy-ad interventions and deprecations are kept;
 * other issue kinds (cookies, CORS, ...) are too noisy for creative audits.
 */
export const handleAuditsIssueAdded = (
  session: ProblemStore,
  params?: Params
) => {
  const issue = params?.issue
  if (!isRecord(issue)) {
    return
  }

  const code = asString(issue.code)
  const details = isRecord(issue.details) ? issue.details : {}

  if (code === "HeavyAdIssue") {
    const d = isRecord(details.heavyAdIssueDetails)
      ? details.heavyAdIssueDetails
      : {}
    const reason = asString(d.reason)
    const resolution = asString(d.resolution)
    const frame = isRecord(d.frame) ? d.frame : undefined
    addConsoleProblem(session, {
      frameId: asString(frame?.frameId) || undefined,
      kind: "issue",
      message: `Heavy ad intervention${reason ? `: ${reason}` : ""}${
        resolution ? ` (${resolution})` : ""
      }`,
      severity: "warning"
    })
    return
  }

  if (code === "DeprecationIssue") {
    const d = isRecord(details.deprecationIssueDetails)
      ? details.deprecationIssueDetails
      : {}
    const location = isRecord(d.sourceCodeLocation)
      ? d.sourceCodeLocation
      : undefined
    const type = asString(d.type)
    addConsoleProblem(session, {
      column: toOneBased(location?.columnNumber),
      kind: "issue",
      line: toOneBased(location?.lineNumber),
      message: `Deprecation${type ? `: ${type}` : ""}`,
      severity: "info",
      url: asString(location?.url) || undefined
    })
  }
}

export const clearConsoleProblems = (session: ProblemStore) => {
  session.consoleProblems.length = 0
}

/** Routes a CDP event to the matching handler. Returns true if the method was console-related. */
export const handleConsoleEvent = (
  session: ProblemStore,
  method: string,
  params?: Params
): boolean => {
  switch (method) {
    case "Runtime.exceptionThrown":
      handleRuntimeExceptionThrown(session, params)
      return true
    case "Runtime.consoleAPICalled":
      handleRuntimeConsoleApiCalled(session, params)
      return true
    case "Log.entryAdded":
      handleLogEntryAdded(session, params)
      return true
    case "Audits.issueAdded":
      handleAuditsIssueAdded(session, params)
      return true
    default:
      return false
  }
}

export const summarizeConsoleProblems = (
  problems: readonly ConsoleProblem[]
): { total: number; errors: number; warnings: number } => {
  let errors = 0
  let warnings = 0
  for (const p of problems) {
    if (p.severity === "error") errors += 1
    else if (p.severity === "warning") warnings += 1
  }
  return { errors, total: problems.length, warnings }
}

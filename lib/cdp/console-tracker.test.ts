import { describe, expect, test } from "bun:test"

import {
  handleAuditsIssueAdded,
  handleConsoleEvent,
  handleLogEntryAdded,
  handleRuntimeConsoleApiCalled,
  handleRuntimeExceptionThrown,
  MAX_CONSOLE_MESSAGE_LENGTH,
  MAX_CONSOLE_PROBLEMS,
  summarizeConsoleProblems
} from "./console-tracker"
import { clearSessionMetrics, getOrCreateSession } from "./session-manager"
import type { ConsoleProblem } from "./types"

const createStore = () => ({ consoleProblems: [] as ConsoleProblem[] })

describe("handleRuntimeExceptionThrown", () => {
  test("normalizes an uncaught exception with 1-based location", () => {
    const store = createStore()
    handleRuntimeExceptionThrown(store, {
      exceptionDetails: {
        columnNumber: 4,
        exception: {
          description: "TypeError: x is undefined\n    at foo (a.js:1:1)"
        },
        lineNumber: 9,
        text: "Uncaught",
        url: "https://cdn.test/a.js"
      }
    })

    expect(store.consoleProblems.length).toBe(1)
    const problem = store.consoleProblems[0]
    expect(problem.kind).toBe("exception")
    expect(problem.severity).toBe("error")
    expect(problem.message).toBe("TypeError: x is undefined")
    expect(problem.url).toBe("https://cdn.test/a.js")
    expect(problem.line).toBe(10)
    expect(problem.column).toBe(5)
    expect(problem.count).toBe(1)
  })

  test("falls back to text and ignores malformed payloads", () => {
    const store = createStore()
    handleRuntimeExceptionThrown(store, undefined)
    handleRuntimeExceptionThrown(store, { exceptionDetails: "nope" })
    handleRuntimeExceptionThrown(store, { exceptionDetails: {} })
    handleRuntimeExceptionThrown(store, {
      exceptionDetails: { text: "Uncaught (in promise)" }
    })
    expect(store.consoleProblems.length).toBe(1)
    expect(store.consoleProblems[0].message).toBe("Uncaught (in promise)")
    expect("line" in store.consoleProblems[0]).toBe(false)
  })
})

describe("handleRuntimeConsoleApiCalled", () => {
  test("keeps error and warning, ignores other types", () => {
    const store = createStore()
    const frame = {
      callFrames: [{ columnNumber: 0, lineNumber: 2, url: "u.js" }]
    }
    handleRuntimeConsoleApiCalled(store, {
      args: [
        { type: "string", value: "boom" },
        { type: "number", value: 3 }
      ],
      stackTrace: frame,
      type: "error"
    })
    handleRuntimeConsoleApiCalled(store, {
      args: [{ type: "string", value: "careful" }],
      type: "warning"
    })
    handleRuntimeConsoleApiCalled(store, {
      args: [{ type: "string", value: "hi" }],
      type: "log"
    })

    expect(store.consoleProblems.length).toBe(2)
    expect(store.consoleProblems[0].kind).toBe("console-error")
    expect(store.consoleProblems[0].message).toBe("boom 3")
    expect(store.consoleProblems[0].line).toBe(3)
    expect(store.consoleProblems[0].url).toBe("u.js")
    expect(store.consoleProblems[1].kind).toBe("console-warning")
    expect(store.consoleProblems[1].severity).toBe("warning")
  })

  test("uses object descriptions for non-primitive args", () => {
    const store = createStore()
    handleRuntimeConsoleApiCalled(store, {
      args: [{ description: "Error: bad\n  at x", type: "object" }],
      type: "error"
    })
    expect(store.consoleProblems[0].message).toBe("Error: bad")
  })
})

describe("handleLogEntryAdded", () => {
  test("keeps error/warning levels only", () => {
    const store = createStore()
    handleLogEntryAdded(store, {
      entry: {
        level: "error",
        lineNumber: 0,
        source: "network",
        text: "Failed to load resource: net::ERR_BLOCKED_BY_CLIENT",
        url: "https://t.test/p.gif"
      }
    })
    handleLogEntryAdded(store, {
      entry: { level: "warning", source: "deprecation", text: "Deprecated API" }
    })
    handleLogEntryAdded(store, { entry: { level: "info", text: "ignored" } })
    handleLogEntryAdded(store, { entry: { level: "verbose", text: "ignored" } })

    expect(store.consoleProblems.length).toBe(2)
    expect(store.consoleProblems[0].kind).toBe("log-error")
    expect(store.consoleProblems[0].line).toBe(1)
    expect(store.consoleProblems[1].kind).toBe("log-warning")
    expect(store.consoleProblems[1].severity).toBe("warning")
  })
})

describe("handleAuditsIssueAdded", () => {
  test("records heavy ad interventions as warnings with frame id", () => {
    const store = createStore()
    handleAuditsIssueAdded(store, {
      issue: {
        code: "HeavyAdIssue",
        details: {
          heavyAdIssueDetails: {
            frame: { frameId: "F1" },
            reason: "NetworkTotalLimit",
            resolution: "HeavyAdBlocked"
          }
        }
      }
    })
    expect(store.consoleProblems.length).toBe(1)
    expect(store.consoleProblems[0].kind).toBe("issue")
    expect(store.consoleProblems[0].severity).toBe("warning")
    expect(store.consoleProblems[0].frameId).toBe("F1")
    expect(store.consoleProblems[0].message).toBe(
      "Heavy ad intervention: NetworkTotalLimit (HeavyAdBlocked)"
    )
  })

  test("records deprecations as info and ignores other issues", () => {
    const store = createStore()
    handleAuditsIssueAdded(store, {
      issue: {
        code: "DeprecationIssue",
        details: {
          deprecationIssueDetails: {
            sourceCodeLocation: { lineNumber: 4, url: "d.js" },
            type: "UnloadHandler"
          }
        }
      }
    })
    handleAuditsIssueAdded(store, {
      issue: { code: "CookieIssue", details: {} }
    })
    expect(store.consoleProblems.length).toBe(1)
    expect(store.consoleProblems[0].severity).toBe("info")
    expect(store.consoleProblems[0].message).toBe("Deprecation: UnloadHandler")
    expect(store.consoleProblems[0].line).toBe(5)
  })
})

describe("dedupe, trimming and cap", () => {
  test("dedupes by kind+message+url+line and increments count", () => {
    const store = createStore()
    const payload = {
      exceptionDetails: {
        exception: { description: "Error: x" },
        lineNumber: 1,
        url: "a.js"
      }
    }
    handleRuntimeExceptionThrown(store, payload)
    handleRuntimeExceptionThrown(store, payload)
    handleRuntimeExceptionThrown(store, {
      exceptionDetails: {
        exception: { description: "Error: x" },
        lineNumber: 2,
        url: "a.js"
      }
    })
    expect(store.consoleProblems.length).toBe(2)
    expect(store.consoleProblems[0].count).toBe(2)
    expect(store.consoleProblems[1].count).toBe(1)
  })

  test("same message but different kind is not merged", () => {
    const store = createStore()
    handleRuntimeConsoleApiCalled(store, {
      args: [{ type: "string", value: "same" }],
      type: "error"
    })
    handleRuntimeConsoleApiCalled(store, {
      args: [{ type: "string", value: "same" }],
      type: "warning"
    })
    expect(store.consoleProblems.length).toBe(2)
  })

  test("trims long messages", () => {
    const store = createStore()
    handleLogEntryAdded(store, {
      entry: { level: "error", text: `  ${"x".repeat(1000)}  ` }
    })
    expect(store.consoleProblems[0].message.length).toBe(
      MAX_CONSOLE_MESSAGE_LENGTH
    )
  })

  test("caps distinct problems but still counts duplicates of kept ones", () => {
    const store = createStore()
    for (let i = 0; i < MAX_CONSOLE_PROBLEMS + 20; i++) {
      handleLogEntryAdded(store, { entry: { level: "error", text: `m${i}` } })
    }
    expect(store.consoleProblems.length).toBe(MAX_CONSOLE_PROBLEMS)
    handleLogEntryAdded(store, { entry: { level: "error", text: "m0" } })
    expect(store.consoleProblems[0].count).toBe(2)
  })
})

describe("handleConsoleEvent and session lifecycle", () => {
  test("routes known methods and reports unknown ones", () => {
    const store = createStore()
    expect(
      handleConsoleEvent(store, "Log.entryAdded", {
        entry: { level: "error", text: "e" }
      })
    ).toBe(true)
    expect(handleConsoleEvent(store, "Network.requestWillBeSent", {})).toBe(
      false
    )
    expect(store.consoleProblems.length).toBe(1)
  })

  test("clearSessionMetrics clears console problems", () => {
    const session = getOrCreateSession(987654)
    handleConsoleEvent(session, "Log.entryAdded", {
      entry: { level: "error", text: "e" }
    })
    expect(session.consoleProblems.length).toBe(1)
    clearSessionMetrics(session)
    expect(session.consoleProblems.length).toBe(0)
  })
})

describe("summarizeConsoleProblems", () => {
  test("counts by severity", () => {
    const base = {
      count: 1,
      kind: "issue" as const,
      message: "m",
      timestamp: 0
    }
    expect(summarizeConsoleProblems([])).toEqual({
      errors: 0,
      total: 0,
      warnings: 0
    })
    expect(
      summarizeConsoleProblems([
        { ...base, severity: "error" },
        { ...base, severity: "warning" },
        { ...base, severity: "warning" },
        { ...base, severity: "info" }
      ])
    ).toEqual({ errors: 1, total: 4, warnings: 2 })
  })
})

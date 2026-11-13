import { describe, expect, test } from "bun:test"

import type { ConsoleProblem } from "~lib/cdp/types"
import {
  buildConsoleView,
  filterConsoleProblems
} from "~lib/features/console-problems"
import { renderConsoleProblems } from "~lib/ui/request-panel"

const problem = (overrides: Partial<ConsoleProblem>): ConsoleProblem => ({
  count: 1,
  kind: "console-error",
  message: "boom",
  severity: "error",
  timestamp: 1,
  ...overrides
})

describe("filterConsoleProblems", () => {
  test("skips Log entries that duplicate network failures", () => {
    const kept = filterConsoleProblems([
      problem({
        kind: "log-error",
        message: "Failed to load resource: net::ERR_FAILED"
      }),
      problem({ kind: "log-error", message: "Other log error" }),
      problem({ kind: "exception", message: "Failed to load resource" })
    ])
    expect(kept.map((entry) => entry.message)).toEqual([
      "Other log error",
      "Failed to load resource"
    ])
  })
})

describe("buildConsoleView", () => {
  test("orders errors first, shows count and source, caps with +N more", () => {
    const view = buildConsoleView(
      [
        problem({
          kind: "console-warning",
          message: "warn",
          severity: "warning"
        }),
        problem({
          count: 3,
          line: 12,
          message: "err",
          url: "https://x.test/js/app.js"
        }),
        problem({ message: "e2" }),
        problem({ message: "e3" })
      ],
      2
    )
    expect(view.rows.length).toBe(2)
    expect(view.rows[0].message).toBe("err")
    expect(view.rows[0].countText).toBe("x3")
    expect(view.rows[0].source).toBe("app.js:12")
    expect(view.footer).toBe("+2 more")
    expect(view.errors).toBe(3)
    expect(view.warnings).toBe(1)
  })
})

describe("renderConsoleProblems", () => {
  test("hides when empty and shows the tab-wide footnote when asked", () => {
    const container = document.createElement("div")
    renderConsoleProblems(container, [], true)
    expect(container.style.display).toBe("none")
    renderConsoleProblems(container, [problem({ message: "<i>x</i>" })], true)
    expect(container.style.display).toBe("flex")
    expect(container.querySelector("i")).toBeNull()
    expect(container.textContent).toContain("tab-wide")
    expect(
      container.querySelectorAll('[data-console-severity="error"]').length
    ).toBe(1)
    renderConsoleProblems(container, [problem({})], false)
    expect(container.textContent).not.toContain("tab-wide")
  })
})

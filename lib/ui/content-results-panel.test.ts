import { describe, expect, test } from "bun:test"

import type { WireContentIssue } from "~lib/messaging"
import { createContentResultsPanel } from "~lib/ui/content-results-panel"
import { getDarkTheme } from "~lib/ui/theme"

const issues: WireContentIssue[] = [
  {
    category: "links",
    kind: "empty-href",
    message: "warn link",
    severity: "warning"
  },
  {
    category: "images",
    kind: "broken",
    message: "<b>broken</b>",
    severity: "error"
  },
  { category: "images", kind: "format", message: "info img", severity: "info" },
  { category: "links", kind: "x", message: "second error", severity: "error" }
]

describe("createContentResultsPanel", () => {
  test("groups rows by severity with counts", () => {
    const panel = createContentResultsPanel(issues, getDarkTheme(), {
      onSelect: () => {}
    })
    const sections = Array.from(panel.querySelectorAll("[data-severity]"))
    expect(sections.map((s) => s.getAttribute("data-severity"))).toEqual([
      "error",
      "warning",
      "info"
    ])
    expect(sections[0].querySelector("h3")?.textContent).toBe("Errors (2)")
    expect(sections[0].querySelectorAll("button").length).toBe(2)
  })

  test("row click reports the original issue index", () => {
    const selected: number[] = []
    const panel = createContentResultsPanel(issues, getDarkTheme(), {
      onSelect: (index) => selected.push(index)
    })
    panel.querySelector<HTMLButtonElement>('[data-issue-index="3"]')?.click()
    panel.querySelector<HTMLButtonElement>('[data-issue-index="0"]')?.click()
    expect(selected).toEqual([3, 0])
  })

  test("issue text is not parsed as HTML", () => {
    const panel = createContentResultsPanel(issues, getDarkTheme(), {
      onSelect: () => {}
    })
    expect(panel.querySelector("b")).toBeNull()
    expect(panel.textContent).toContain("<b>broken</b>")
  })

  test("shows an all-clear message and close calls onClose", () => {
    let closed = 0
    const panel = createContentResultsPanel([], getDarkTheme(), {
      onClose: () => {
        closed += 1
      },
      onSelect: () => {}
    })
    document.body.appendChild(panel)
    expect(panel.textContent).toContain("No image or link issues")
    panel.querySelector("button")?.click()
    expect(closed).toBe(1)
    expect(panel.isConnected).toBe(false)
  })
})

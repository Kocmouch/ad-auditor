import { describe, expect, test } from "bun:test"

import {
  describeCreative,
  formatAuditReportMarkdown,
  formatOutcome,
  type AuditReportRow
} from "./audit-report"

const rows: AuditReportRow[] = [
  {
    checks: {
      accessibility: { count: 1, severity: "error" },
      content: { count: 0, severity: "ok" },
      console: { count: 1, severity: "warning" },
      fonts: { count: 2, severity: "warning" },
      quality: { count: 3, severity: "info" },
      requests: { count: 0, severity: "ok" }
    },
    id: "banner-1",
    size: "300x250"
  },
  {
    checks: { fonts: { count: 0, severity: "ok" } },
    id: "a|b",
    size: "-"
  }
]

describe("describeCreative", () => {
  test("prefers id, then name, then position", () => {
    expect(
      describeCreative({ height: 250, id: "x", name: "n", width: 300 }, 0)
    ).toEqual({ id: "x", size: "300x250" })
    expect(
      describeCreative({ height: 90.4, name: "n", width: 728.2 }, 1).id
    ).toBe("n")
    expect(describeCreative({ height: 0, width: 0 }, 2)).toEqual({
      id: "#3",
      size: "-"
    })
  })
})

describe("formatOutcome", () => {
  test("renders ok, counted and not-run outcomes", () => {
    expect(formatOutcome(undefined)).toBe("-")
    expect(formatOutcome({ count: 0, severity: "ok" })).toBe("ok")
    expect(formatOutcome({ count: 3, severity: "warning" })).toBe("warning (3)")
  })
})

describe("formatAuditReportMarkdown", () => {
  test("builds a table with an overall column", () => {
    const markdown = formatAuditReportMarkdown(rows, {
      generatedAt: new Date("2026-01-02T03:04:05.000Z"),
      pageUrl: "https://creatives-preview.rtbhouse.com/x"
    })
    const lines = markdown.split("\n")
    expect(lines[0]).toBe("# Ad Auditor report")
    expect(markdown).toContain("Page: https://creatives-preview.rtbhouse.com/x")
    expect(markdown).toContain("Generated: 2026-01-02T03:04:05.000Z")
    expect(markdown).toContain(
      "| Creative | Size | Fonts | Accessibility | Content | Quality | Requests | Console | Overall |"
    )
    expect(markdown).toContain(
      "| banner-1 | 300x250 | warning (2) | error (1) | ok | info (3) | ok | warning (1) | error |"
    )
  })

  test("escapes pipes and marks checks that did not run", () => {
    const markdown = formatAuditReportMarkdown(rows)
    expect(markdown).toContain("| a\\|b | - | ok | - | - | - | - | - | ok |")
  })

  test("handles an empty report", () => {
    expect(formatAuditReportMarkdown([])).toContain(
      "No creatives were audited."
    )
  })
})

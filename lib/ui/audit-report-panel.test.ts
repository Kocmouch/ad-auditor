import { describe, expect, test } from "bun:test"

import type { AuditReportRow } from "~lib/audit-report"
import { createAuditReportPanel } from "~lib/ui/audit-report-panel"
import { getDarkTheme } from "~lib/ui/theme"

const rows: AuditReportRow[] = [
  {
    checks: {
      content: { count: 2, severity: "error" },
      fonts: { count: 0, severity: "ok" }
    },
    id: "<i>one</i>",
    size: "300x250"
  }
]

describe("createAuditReportPanel", () => {
  test("renders one table row per creative as text", () => {
    const panel = createAuditReportPanel(rows, getDarkTheme())
    expect(panel.querySelectorAll("tbody tr").length).toBe(1)
    expect(panel.querySelector("i")).toBeNull()
    expect(panel.textContent).toContain("error (2)")
  })

  test("Copy report copies Markdown", async () => {
    const copied: string[] = []
    const panel = createAuditReportPanel(rows, getDarkTheme(), {
      copyText: async (text) => {
        copied.push(text)
      },
      pageUrl: "https://creatives-preview.rtbhouse.com/"
    })
    const button = Array.from(panel.querySelectorAll("button")).find(
      (entry) => entry.textContent === "Copy report"
    )
    button?.click()
    await Promise.resolve()
    expect(copied.length).toBe(1)
    expect(copied[0]).toContain("| Creative | Size |")
    expect(copied[0]).toContain("Page: https://creatives-preview.rtbhouse.com/")
    expect(button?.textContent).toBe("Copied")
  })

  test("close removes the panel and notifies", () => {
    let closed = 0
    const panel = createAuditReportPanel(rows, getDarkTheme(), {
      onClose: () => {
        closed += 1
      }
    })
    document.body.appendChild(panel)
    Array.from(panel.querySelectorAll("button"))
      .find((entry) => entry.textContent === "✕")
      ?.click()
    expect(closed).toBe(1)
    expect(panel.isConnected).toBe(false)
  })

  test("shows a message when nothing was audited", () => {
    const panel = createAuditReportPanel([], getDarkTheme())
    expect(panel.textContent).toContain("No creatives were audited.")
  })
})

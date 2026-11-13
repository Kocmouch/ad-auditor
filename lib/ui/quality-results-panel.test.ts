import { describe, expect, test } from "bun:test"

import type { WireQualityIssue } from "~lib/messaging"
import {
  createQualityResultsPanel,
  formatCoverage
} from "~lib/ui/quality-results-panel"
import { getDarkTheme } from "~lib/ui/theme"

const issues: WireQualityIssue[] = [
  {
    category: "clicks",
    kind: "low-coverage",
    message: "Only 40% clickable",
    severity: "warning"
  },
  {
    category: "structure",
    hasElement: true,
    kind: "tiny-font",
    message: "tiny",
    severity: "error"
  }
]

describe("createQualityResultsPanel", () => {
  test("shows coverage in the header and only elements are clickable", () => {
    const selected: number[] = []
    const panel = createQualityResultsPanel(issues, 40, getDarkTheme(), {
      onSelect: (index) => selected.push(index)
    })
    expect(
      panel.querySelector('[data-panel-subtitle="true"]')?.textContent
    ).toBe("Click coverage: 40%")
    panel.querySelector<HTMLElement>('[data-issue-index="0"]')?.click()
    panel.querySelector<HTMLElement>('[data-issue-index="1"]')?.click()
    expect(selected).toEqual([1])
    expect(panel.id).toBe("ad-auditor-quality-check-results")
  })

  test("unknown coverage shows no subtitle", () => {
    expect(formatCoverage(null) === undefined).toBe(true)
    const panel = createQualityResultsPanel([], null, getDarkTheme(), {
      onSelect: () => {}
    })
    expect(panel.querySelector('[data-panel-subtitle="true"]')).toBeNull()
    expect(panel.textContent).toContain("No structure, click or animation")
  })
})

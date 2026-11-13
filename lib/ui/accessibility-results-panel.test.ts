import { describe, expect, test } from "bun:test"

import { createAccessibilityResultsPanel } from "~lib/ui/accessibility-results-panel"

const theme = {
  background: "#000",
  surface: "#111",
  text: "#fff",
  textMuted: "#999",
  shadowLight: "#222",
  shadowDark: "#000",
  accent: "#0f0"
}

describe("createAccessibilityResultsPanel", () => {
  test("page-derived strings are not parsed as HTML", () => {
    const panel = createAccessibilityResultsPanel(
      [
        {
          element: '<img src=x onerror="alert(1)">',
          issueType: "low-contrast",
          contrastRatio: 2,
          details: "<b>d</b>"
        },
        { element: "x", issueType: "contrast-unverifiable", details: "d" }
      ],
      [{ element: "<script>1</script>", issueType: "missing", details: "d" }],
      theme
    )
    expect(panel.querySelector("img")).toBeNull()
    expect(panel.querySelector("script")).toBeNull()
    expect(panel.querySelector("b")).toBeNull()
    expect(panel.textContent).toContain('<img src=x onerror="alert(1)">')
    expect(panel.textContent).toContain("manual check")
  })
})

import { beforeEach, describe, expect, test } from "bun:test"

import {
  clearQualityHighlights,
  runQualityChecks
} from "~lib/features/quality-checker"
import { getHighlightCount } from "~lib/ui/highlight"

beforeEach(() => {
  clearQualityHighlights()
  document.body.innerHTML = ""
})

const addTinyText = () => {
  const tiny = document.createElement("p")
  tiny.textContent = "legal"
  tiny.style.fontSize = "4px"
  tiny.getBoundingClientRect = () =>
    ({
      bottom: 10,
      height: 10,
      left: 0,
      right: 50,
      top: 0,
      width: 50
    }) as DOMRect
  document.body.appendChild(tiny)
  return tiny
}

describe("runQualityChecks", () => {
  test("tags issues by category and reports coverage", () => {
    const tiny = addTinyText()
    const result = runQualityChecks(document)
    const issue = result.issues.find((entry) => entry.kind === "tiny-font")
    expect(issue?.category).toBe("structure")
    expect(issue?.element).toBe(tiny)
    expect(typeof result.coveragePercent).toBe("number")
    expect(getHighlightCount("structure")).toBe(1)
  })

  test("accepts bounds and re-running replaces highlights", () => {
    addTinyText()
    const bounds = { height: 250, left: 0, top: 0, width: 300 }
    runQualityChecks(document, bounds)
    runQualityChecks(document, bounds)
    expect(getHighlightCount("structure")).toBe(1)
    clearQualityHighlights()
    expect(getHighlightCount("structure")).toBe(0)
  })
})

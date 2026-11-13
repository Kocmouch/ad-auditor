import { beforeEach, describe, expect, test } from "bun:test"

import {
  clearContentCheck,
  clearQualityCheck,
  focusContentIssue,
  focusQualityIssue,
  runAllChecks,
  runContentCheck,
  runQualityCheck
} from "./audit-actions"
import { getHighlightCount } from "./ui/highlight"

const addBrokenImage = () => {
  const img = document.createElement("img")
  img.setAttribute("src", "https://example.com/missing.png")
  Object.defineProperty(img, "complete", { value: true })
  Object.defineProperty(img, "naturalWidth", { value: 0 })
  Object.defineProperty(img, "naturalHeight", { value: 0 })
  document.body.appendChild(img)
}

beforeEach(() => {
  clearContentCheck()
  document.body.innerHTML = ""
})

describe("content check actions", () => {
  test("focusContentIssue focuses a highlighted issue by index", () => {
    addBrokenImage()
    const issues = runContentCheck()
    expect(issues.length).toBeGreaterThan(0)
    expect(focusContentIssue(0)).toBe(true)
    expect(focusContentIssue(99)).toBe(false)
  })

  test("clearContentCheck drops highlights and the remembered issues", () => {
    addBrokenImage()
    runContentCheck()
    clearContentCheck()
    expect(getHighlightCount("images")).toBe(0)
    expect(focusContentIssue(0)).toBe(false)
  })
})

describe("quality check actions", () => {
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
  }

  test("focusQualityIssue focuses by index and clear forgets issues", () => {
    addTinyText()
    const result = runQualityCheck()
    const index = result.issues.findIndex((issue) => issue.kind === "tiny-font")
    expect(index).toBeGreaterThan(-1)
    expect(focusQualityIssue(index)).toBe(true)
    expect(focusQualityIssue(999)).toBe(false)
    clearQualityCheck()
    expect(getHighlightCount("structure")).toBe(0)
    expect(focusQualityIssue(index)).toBe(false)
  })

  test("runAllChecks includes a quality outcome", () => {
    addTinyText()
    expect(runAllChecks().quality?.count).toBeGreaterThan(0)
  })
})

describe("runAllChecks", () => {
  test("reports every check and leaves no highlights behind", () => {
    addBrokenImage()
    const outcomes = runAllChecks()
    expect(outcomes.content?.severity).toBe("error")
    expect(outcomes.fonts?.severity).toBe("ok")
    expect(outcomes.accessibility !== undefined).toBe(true)
    expect(getHighlightCount()).toBe(0)
  })
})

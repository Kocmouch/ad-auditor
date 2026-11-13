import { beforeEach, describe, expect, test } from "bun:test"

import {
  clearContentHighlights,
  runContentChecks,
  shortLabel
} from "~lib/features/content-checker"
import { getHighlightCount } from "~lib/ui/highlight"

beforeEach(() => {
  clearContentHighlights()
  document.body.innerHTML = ""
})

const addBrokenImage = () => {
  const img = document.createElement("img")
  img.setAttribute("src", "https://example.com/missing.png")
  Object.defineProperty(img, "complete", { value: true })
  Object.defineProperty(img, "naturalWidth", { value: 0 })
  Object.defineProperty(img, "naturalHeight", { value: 0 })
  document.body.appendChild(img)
  return img
}

describe("shortLabel", () => {
  test("truncates long messages", () => {
    expect(shortLabel("short")).toBe("short")
    expect(shortLabel("x".repeat(100)).length).toBe(40)
  })
})

describe("runContentChecks", () => {
  test("returns no issues for an empty document", () => {
    const result = runContentChecks()
    expect(result.issues.length).toBe(0)
    expect(result.summary.total).toBe(0)
  })

  test("tags image issues, keeps the element and highlights it", () => {
    const img = addBrokenImage()
    const result = runContentChecks()
    const issue = result.issues.find((entry) => entry.category === "images")
    expect(issue?.kind).toBe("broken")
    expect(issue?.severity).toBe("error")
    expect(issue?.element).toBe(img)
    expect(result.summary.errors).toBeGreaterThan(0)
    expect(getHighlightCount("images")).toBe(1)
  })

  test("re-running replaces earlier highlights and clear removes them", () => {
    addBrokenImage()
    runContentChecks()
    runContentChecks()
    expect(getHighlightCount("images")).toBe(1)
    clearContentHighlights()
    expect(getHighlightCount("images")).toBe(0)
  })

  test("reports template leaks, highlighted in their own group", () => {
    const heading = document.createElement("h1")
    heading.textContent = "Hello {{ product.name }}"
    document.body.appendChild(heading)
    const result = runContentChecks()
    const issue = result.issues.find((entry) => entry.category === "template")
    expect(issue?.element).toBe(heading)
    expect(getHighlightCount("template")).toBe(1)
    clearContentHighlights()
    expect(getHighlightCount("template")).toBe(0)
  })

  test("reports link issues", () => {
    const anchor = document.createElement("a")
    anchor.setAttribute("href", "#")
    anchor.textContent = "Shop now"
    document.body.appendChild(anchor)
    const result = runContentChecks()
    expect(result.issues.some((entry) => entry.category === "links")).toBe(true)
  })
})

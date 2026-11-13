import { afterEach, beforeEach, describe, expect, test } from "bun:test"

import {
  addHighlight,
  clearAllHighlights,
  clearHighlights,
  focusHighlight,
  getHighlightCount,
  HIGHLIGHT_LAYER_ID,
  SEVERITY_COLORS
} from "./highlight"

const makeEl = () => {
  const el = document.createElement("p")
  el.textContent = "hi"
  el.style.color = "red"
  document.body.appendChild(el)
  el.getBoundingClientRect = () =>
    ({
      left: 10,
      top: 5,
      width: 100,
      height: 20,
      right: 110,
      bottom: 25
    }) as DOMRect
  return el
}

beforeEach(() => {
  clearAllHighlights()
})

afterEach(() => {
  clearAllHighlights()
  document.body.innerHTML = ""
})

describe("highlight", () => {
  test("draws in a layer on documentElement and never mutates the element", () => {
    const el = makeEl()
    const before = el.outerHTML
    addHighlight(el, { severity: "error", label: "Oops", group: "g" })
    expect(el.outerHTML).toBe(before)
    const layer = document.getElementById(HIGHLIGHT_LAYER_ID)!
    expect(layer.parentElement).toBe(document.documentElement)
    expect(layer.style.pointerEvents).toBe("none")
    expect(layer.style.zIndex).toBe("2147483647")
    const box = layer.querySelector<HTMLElement>("[data-highlight-severity]")!
    expect(box.style.left).toBe("10px")
    expect(box.style.width).toBe("100px")
    expect(box.style.cssText).toContain("#ef4444")
    expect(box.style.cssText).not.toContain("gradient")
  })

  test("severity colors and numbered label", () => {
    const a = makeEl()
    const b = makeEl()
    addHighlight(a, { severity: "warning", label: "A", group: "g" })
    addHighlight(b, { severity: "info", label: "B", group: "g" })
    const badges = [...document.querySelectorAll("[data-highlight-badge]")]
    expect(badges.map((x) => x.textContent)).toEqual([
      "1 \u00b7 A",
      "2 \u00b7 B"
    ])
    expect(SEVERITY_COLORS.warning.color).toBe("#f59e0b")
    expect(SEVERITY_COLORS.info.color).toBe("#3b82f6")
  })

  test("groups clear independently; layer removed when empty", () => {
    const a = makeEl()
    const b = makeEl()
    addHighlight(a, { severity: "error", group: "font" })
    addHighlight(b, { severity: "error", group: "border" })
    clearHighlights("font")
    expect(getHighlightCount("font")).toBe(0)
    expect(getHighlightCount("border")).toBe(1)
    clearHighlights("border")
    expect(document.getElementById(HIGHLIGHT_LAYER_ID)).toBeNull()
  })

  test("same element + group replaces; handle.remove works", () => {
    const a = makeEl()
    addHighlight(a, { severity: "error", group: "g" })
    const h = addHighlight(a, { severity: "warning", group: "g" })
    expect(getHighlightCount("g")).toBe(1)
    h.remove()
    expect(getHighlightCount()).toBe(0)
  })

  test("badge stays inside viewport at edges", () => {
    const el = makeEl()
    el.getBoundingClientRect = () =>
      ({
        left: -50,
        top: 0,
        width: 100,
        height: 20,
        right: 50,
        bottom: 20
      }) as DOMRect
    addHighlight(el, { severity: "error", label: "Edge" })
    const badge = document.querySelector<HTMLElement>("[data-highlight-badge]")!
    expect(parseFloat(badge.style.left)).toBeGreaterThan(-1)
    expect(parseFloat(badge.style.top)).toBeGreaterThan(-1)
  })

  test("focusHighlight flashes known elements only", () => {
    const el = makeEl()
    el.scrollIntoView = () => {}
    expect(focusHighlight(el)).toBe(false)
    addHighlight(el, { severity: "error" })
    expect(focusHighlight(el)).toBe(true)
    expect(document.querySelector(".ad-auditor-hl-flash")).not.toBeNull()
  })
})

import { beforeEach, describe, expect, test } from "bun:test"

import {
  detectBannerBounds,
  MIN_BANNER_SIZE,
  unionBounds
} from "~lib/utils/banner-bounds"

const viewport = { height: 800, width: 1200 }

describe("unionBounds", () => {
  test("returns the union box of the rectangles", () => {
    expect(
      unionBounds(
        [
          { height: 250, left: 450, top: 100, width: 300 },
          { height: 20, left: 460, top: 300, width: 100 }
        ],
        viewport
      )
    ).toEqual({ height: 250, left: 450, top: 100, width: 300 })
  })

  test("clips to the viewport", () => {
    expect(
      unionBounds([{ height: 2000, left: -50, top: 0, width: 2000 }], viewport)
    ).toEqual({ height: 800, left: 0, top: 0, width: 1200 })
  })

  test("ignores empty rectangles and returns undefined when nothing is left", () => {
    expect(unionBounds([], viewport) === undefined).toBe(true)
    expect(
      unionBounds([{ height: 0, left: 0, top: 0, width: 100 }], viewport) ===
        undefined
    ).toBe(true)
  })

  test("rejects results below the minimum size", () => {
    const tiny = MIN_BANNER_SIZE - 1
    expect(
      unionBounds([{ height: tiny, left: 0, top: 0, width: 300 }], viewport) ===
        undefined
    ).toBe(true)
  })
})

describe("detectBannerBounds", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  test("returns undefined for an empty document", () => {
    expect(detectBannerBounds(document) === undefined).toBe(true)
  })

  test("ignores extension UI", () => {
    const badge = document.createElement("div")
    badge.id = "ad-auditor-badge"
    badge.style.backgroundColor = "black"
    badge.getBoundingClientRect = () =>
      ({ height: 100, left: 0, top: 0, width: 400 }) as DOMRect
    document.body.appendChild(badge)
    expect(detectBannerBounds(document) === undefined).toBe(true)
  })

  test("uses the rects of painted elements", () => {
    const img = document.createElement("img")
    img.getBoundingClientRect = () =>
      ({ height: 250, left: 10, top: 20, width: 300 }) as DOMRect
    document.body.appendChild(img)
    const bounds = detectBannerBounds(document)
    expect(bounds?.width).toBe(300)
    expect(bounds?.height).toBe(250)
    expect(bounds?.left).toBe(10)
    expect(bounds?.top).toBe(20)
  })
})

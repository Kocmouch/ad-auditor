import { beforeEach, describe, expect, test } from "bun:test"

import {
  checkFontsInDocument,
  clearFontHighlights
} from "~lib/features/font-checker"

beforeEach(() => {
  document.body.innerHTML = ""
})

// happy-dom has no real canvas; stub measureText so a "missing" font renders
// with the same width as a generic fallback.
const stubCanvas = (widthFor: (font: string) => number) => {
  const orig = document.createElement.bind(document)
  document.createElement = ((tag: string, ...rest: any[]) => {
    if (tag === "canvas") {
      const ctx = {
        font: "",
        measureText() {
          return { width: widthFor(this.font) }
        }
      }
      return { getContext: () => ctx } as any
    }
    return (orig as any)(tag, ...rest)
  }) as any
  return () => {
    document.createElement = orig as any
  }
}

describe("checkFontsInDocument", () => {
  test("flags font that falls back to a generic family", () => {
    document.body.innerHTML =
      '<p style="font-family: MissingFont, sans-serif; font-size: 16px">Hello</p>'
    const restore = stubCanvas((f) =>
      f.includes("MissingFont") || f.endsWith("sans-serif") ? 100 : 80
    )
    try {
      const result = checkFontsInDocument()
      expect(result).toHaveLength(1)
      expect(result[0].rendered).toBe("sans-serif")
      expect(result[0].declared).toContain("MissingFont")
    } finally {
      restore()
    }
  })

  test("no mismatch when declared font differs from all fallbacks", () => {
    document.body.innerHTML =
      '<p style="font-family: RealFont; font-size: 16px">Hello</p>'
    const restore = stubCanvas((f) =>
      f.includes("RealFont") ? 123.4 : 50 + f.length
    )
    try {
      expect(checkFontsInDocument()).toEqual([])
    } finally {
      restore()
    }
  })

  test("generic families are skipped; clear is safe", () => {
    document.body.innerHTML = '<p style="font-family: serif">Hello</p>'
    expect(checkFontsInDocument()).toEqual([])
    clearFontHighlights()
  })
})

import { beforeEach, describe, expect, test } from "bun:test"

import {
  checkBorderElements,
  isBorderVisible
} from "~lib/features/border-checker"

beforeEach(() => {
  document.body.innerHTML = ""
})

const white = { r: 255, g: 255, b: 255 }

describe("isBorderVisible", () => {
  test("dark border on white is visible", () => {
    expect(isBorderVisible("rgb(0, 0, 0)", white).visible).toBe(true)
  })
  test("same color is invisible", () => {
    expect(isBorderVisible("rgb(255, 255, 255)", white).visible).toBe(false)
  })
  test("subtle #dedede passes", () => {
    expect(isBorderVisible("#dedede", white).visible).toBe(true)
  })
  test("transparent border is invisible", () => {
    expect(isBorderVisible("rgba(0, 0, 0, 0)", white).visible).toBe(false)
  })
  test("semi-transparent border is composited over background", () => {
    expect(isBorderVisible("rgb(0 0 0 / 50%)", white).visible).toBe(true)
    expect(isBorderVisible("rgb(0 0 0 / 5%)", white).visible).toBe(false)
  })
  test("multi-color computed value uses first", () => {
    expect(isBorderVisible("rgb(0, 0, 0) rgb(0, 0, 0)", white).visible).toBe(
      true
    )
  })
})

describe("checkBorderElements", () => {
  test("missing .banner", () => {
    expect(checkBorderElements()[0].issueType).toBe("missing")
  })
  test("banner without border is missing", () => {
    document.body.innerHTML = '<div class="banner"></div>'
    const issues = checkBorderElements()
    expect(issues).toHaveLength(1)
    expect(issues[0].issueType).toBe("missing")
  })
  test("visible border-container passes", () => {
    document.body.innerHTML =
      '<div class="banner" style="background:#fff"><div class="border-container" style="border:1px solid #000"></div></div>'
    expect(checkBorderElements()).toEqual([])
  })
  test("invisible border-container is flagged", () => {
    document.body.innerHTML =
      '<div class="banner" style="background:#fff"><div class="border-container" style="border:1px solid #fff"></div></div>'
    expect(checkBorderElements().map((i) => i.issueType)).toEqual(["invisible"])
  })
})

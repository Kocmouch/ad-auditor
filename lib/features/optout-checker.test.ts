import { beforeEach, describe, expect, test } from "bun:test"

import { checkOptOutElements } from "~lib/features/optout-checker"

beforeEach(() => {
  document.body.innerHTML = ""
})

describe("checkOptOutElements", () => {
  test("reports missing opt-out", () => {
    document.body.innerHTML = "<div>hello</div>"
    const issues = checkOptOutElements()
    expect(issues).toHaveLength(1)
    expect(issues[0].issueType).toBe("missing")
  })

  test("reports hidden opt-out", () => {
    document.body.innerHTML =
      '<div class="optout" style="display:none;color:#000;background:#fff">x</div>'
    expect(checkOptOutElements().map((i) => i.issueType)).toEqual(["hidden"])
  })

  test("reports low contrast", () => {
    document.body.innerHTML =
      '<div class="optout" style="color:#ccc;background-color:#fff">x</div>'
    const issues = checkOptOutElements()
    expect(issues).toHaveLength(1)
    expect(issues[0].issueType).toBe("low-contrast")
    expect(issues[0].contrastRatio).toBeLessThan(4.5)
  })

  test("no issue with good contrast", () => {
    document.body.innerHTML =
      '<div class="optout" style="color:#000;background-color:#fff">x</div>'
    expect(checkOptOutElements()).toEqual([])
  })

  test("uses ancestor background", () => {
    document.body.innerHTML =
      '<div style="background-color:#000"><div class="optout" style="color:#111">x</div></div>'
    expect(checkOptOutElements()[0]?.issueType).toBe("low-contrast")
  })

  test("background image is unverifiable, not assumed white", () => {
    document.body.innerHTML =
      '<div class="optout" style="color:#fff;background-image:linear-gradient(#000,#333)">x</div>'
    expect(checkOptOutElements()[0]?.issueType).toBe("contrast-unverifiable")
  })
})

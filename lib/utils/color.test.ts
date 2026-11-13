import { describe, expect, test } from "bun:test"

import {
  compositeOver,
  getContrastRatio,
  getLuminance,
  getTextContrast,
  parseColor,
  resolveBackground
} from "~lib/utils/color"

describe("parseColor", () => {
  test("hex forms", () => {
    expect(parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(parseColor("#1a2b3c")).toEqual({ r: 26, g: 43, b: 60, a: 1 })
    expect(parseColor("#00000080")!.a).toBeCloseTo(0.502, 2)
    expect(parseColor("#0008")!.a).toBeCloseTo(0.533, 2)
    expect(parseColor("#12")).toBeNull()
    expect(parseColor("#ggg")).toBeNull()
  })
  test("rgb comma syntax", () => {
    expect(parseColor("rgb(1, 2, 3)")).toEqual({ r: 1, g: 2, b: 3, a: 1 })
    expect(parseColor("rgba(1, 2, 3, 0.5)")).toEqual({
      r: 1,
      g: 2,
      b: 3,
      a: 0.5
    })
  })
  test("rgb space/slash syntax", () => {
    expect(parseColor("rgb(0 0 0 / 50%)")).toEqual({ r: 0, g: 0, b: 0, a: 0.5 })
    expect(parseColor("rgb(10 20 30)")).toEqual({ r: 10, g: 20, b: 30, a: 1 })
    expect(parseColor("rgb(0 0 0 / 0.25)")!.a).toBe(0.25)
    expect(parseColor("rgb(100% 0% 0%)")).toEqual({ r: 255, g: 0, b: 0, a: 1 })
  })
  test("transparent and invalid", () => {
    expect(parseColor("transparent")!.a).toBe(0)
    expect(parseColor("rgba(0, 0, 0, 0)")!.a).toBe(0)
    expect(parseColor("red")).toBeNull()
    expect(parseColor("")).toBeNull()
    expect(parseColor(undefined)).toBeNull()
  })
})

describe("contrast math", () => {
  const black = { r: 0, g: 0, b: 0 }
  const white = { r: 255, g: 255, b: 255 }
  test("luminance extremes", () => {
    expect(getLuminance(black)).toBe(0)
    expect(getLuminance(white)).toBeCloseTo(1, 5)
  })
  test("black on white is 21:1", () => {
    expect(getContrastRatio(black, white)).toBeCloseTo(21, 5)
    expect(getContrastRatio(white, black)).toBeCloseTo(21, 5)
  })
  test("#777 on white is ~4.48", () => {
    expect(getContrastRatio({ r: 119, g: 119, b: 119 }, white)).toBeCloseTo(
      4.48,
      1
    )
  })
  test("composite over", () => {
    const c = compositeOver({ r: 0, g: 0, b: 0, a: 0.5 }, { ...white, a: 1 })
    expect(c.r).toBeCloseTo(127.5, 5)
    expect(c.a).toBe(1)
  })
  test("semi-transparent text lowers contrast", () => {
    const solid = getTextContrast({ r: 0, g: 0, b: 0, a: 1 }, white)
    const faded = getTextContrast({ r: 0, g: 0, b: 0, a: 0.3 }, white)
    expect(faded).toBeLessThan(solid)
    expect(faded).toBeLessThan(4.5)
  })
})

describe("resolveBackground", () => {
  const make = (styles: Record<string, [string, string]>) => {
    document.body.innerHTML =
      '<div id="a"><div id="b"><span id="c">x</span></div></div>'
    return (el: Element) => {
      const [backgroundColor, backgroundImage] = styles[el.id] ?? [
        "rgba(0, 0, 0, 0)",
        "none"
      ]
      return { backgroundColor, backgroundImage }
    }
  }
  const c = () => document.getElementById("c")!

  test("walks up to nearest opaque ancestor", () => {
    const get = make({ a: ["rgb(10, 20, 30)", "none"] })
    expect(resolveBackground(c(), get)).toEqual({
      kind: "color",
      color: { r: 10, g: 20, b: 30, a: 1 }
    })
  })
  test("composites semi-transparent layers", () => {
    const get = make({
      a: ["rgb(0, 0, 0)", "none"],
      b: ["rgba(255, 255, 255, 0.5)", "none"]
    })
    const r = resolveBackground(c(), get)
    expect(r.kind).toBe("color")
    if (r.kind === "color") expect(r.color.r).toBeCloseTo(127.5, 3)
  })
  test("defaults to white canvas", () => {
    expect(resolveBackground(c(), make({}))).toEqual({
      kind: "color",
      color: { r: 255, g: 255, b: 255, a: 1 }
    })
  })
  test("image/gradient is unverifiable", () => {
    const get = make({ b: ["rgba(0, 0, 0, 0)", "linear-gradient(red, blue)"] })
    expect(resolveBackground(c(), get).kind).toBe("unverifiable")
  })
  test("opaque layer above an image hides it", () => {
    const get = make({
      c: ["rgb(0, 0, 0)", "none"],
      a: ["rgba(0, 0, 0, 0)", "url(x.png)"]
    })
    expect(resolveBackground(c(), get).kind).toBe("color")
  })
})

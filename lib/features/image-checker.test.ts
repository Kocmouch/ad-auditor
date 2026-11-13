import { beforeEach, describe, expect, test } from "bun:test"

import {
  checkImagesInDocument,
  extractCssUrls,
  getImageFormat,
  getSizeFromImageUrl,
  MAX_ISSUES
} from "~lib/features/image-checker"

type ImgOpts = {
  src: string
  natural?: [number, number]
  rendered?: [number, number]
  complete?: boolean
  style?: string
}

const addImg = ({
  src,
  natural = [100, 100],
  rendered = [100, 100],
  complete = true,
  style = ""
}: ImgOpts) => {
  const img = document.createElement("img")
  img.setAttribute("src", src)
  if (style) img.setAttribute("style", style)
  Object.defineProperty(img, "naturalWidth", { value: natural[0] })
  Object.defineProperty(img, "naturalHeight", { value: natural[1] })
  Object.defineProperty(img, "complete", { value: complete })
  img.getBoundingClientRect = () =>
    ({ width: rendered[0], height: rendered[1] }) as DOMRect
  document.body.appendChild(img)
  return img
}

beforeEach(() => {
  document.body.innerHTML = ""
})

describe("helpers", () => {
  test("getImageFormat", () => {
    expect(getImageFormat("https://a/b.PNG?x=1")).toBe("png")
    expect(getImageFormat("data:image/jpeg;base64,AAA")).toBe("jpeg")
    expect(getImageFormat("https://a/b")).toBeNull()
  })
  test("extractCssUrls", () => {
    expect(
      extractCssUrls('url("a.png"), linear-gradient(red, blue), url(b.jpg)')
    ).toEqual(["a.png", "b.jpg"])
  })
})

describe("checkImagesInDocument", () => {
  test("empty document", () => {
    expect(checkImagesInDocument()).toEqual({
      issues: [],
      summary: { total: 0, errors: 0, warnings: 0 }
    })
  })

  test("oversized warning", () => {
    addImg({ src: "a.webp", natural: [400, 300], rendered: [200, 150] }) // 4x
    const { issues, summary } = checkImagesInDocument()
    expect(issues).toHaveLength(1)
    expect(issues[0].kind).toBe("oversized")
    expect(issues[0].severity).toBe("warning")
    expect(issues[0].wastedPixelRatio).toBe(0.75)
    expect(summary).toEqual({ total: 1, errors: 0, warnings: 1 })
  })

  test("oversized error", () => {
    addImg({ src: "a.webp", natural: [1000, 1000], rendered: [100, 100] })
    expect(checkImagesInDocument().issues[0].severity).toBe("error")
  })

  test("right-sized image is fine", () => {
    addImg({ src: "a.webp", natural: [200, 200], rendered: [160, 160] })
    expect(checkImagesInDocument().issues).toEqual([])
  })

  test("png/jpeg give info format issue", () => {
    addImg({ src: "a.png" })
    addImg({ src: "data:image/jpeg;base64,AAAA" })
    const { issues, summary } = checkImagesInDocument()
    expect(issues.map((i) => [i.kind, i.severity])).toEqual([
      ["format", "info"],
      ["format", "info"]
    ])
    expect(summary).toEqual({ total: 2, errors: 0, warnings: 0 })
  })

  test("large gif warns, small gif is info", () => {
    addImg({ src: "big.gif", natural: [600, 500], rendered: [600, 500] })
    addImg({ src: "small.gif", natural: [50, 50], rendered: [50, 50] })
    const bySrc = Object.fromEntries(
      checkImagesInDocument().issues.map((i) => [i.src, i.severity])
    )
    expect(bySrc["big.gif"]).toBe("warning")
    expect(bySrc["small.gif"]).toBe("info")
  })

  test("broken image is an error", () => {
    const img = addImg({ src: "x.webp", natural: [0, 0], complete: true })
    const { issues } = checkImagesInDocument()
    expect(issues).toHaveLength(1)
    expect(issues[0].kind).toBe("broken")
    expect(issues[0].severity).toBe("error")
    expect(issues[0].element).toBe(img)
  })

  test("incomplete image is not reported as broken", () => {
    addImg({ src: "x.webp", natural: [0, 0], complete: false })
    expect(checkImagesInDocument().issues).toEqual([])
  })

  test("ignores hidden, zero-size and tracking pixels", () => {
    addImg({ src: "a.png", style: "display:none" })
    addImg({ src: "b.png", style: "visibility:hidden" })
    addImg({ src: "c.png", rendered: [0, 0] })
    addImg({ src: "d.png", natural: [1, 1], rendered: [1, 1] })
    addImg({ src: "e.png", natural: [500, 500], rendered: [1, 1] })
    expect(checkImagesInDocument().issues).toEqual([])
  })

  test("dedupes by src and kind", () => {
    addImg({ src: "a.png" })
    addImg({ src: "a.png" })
    expect(checkImagesInDocument().issues).toHaveLength(1)
  })

  test("caps issues and sorts errors first", () => {
    for (let i = 0; i < MAX_ISSUES + 10; i++) addImg({ src: `i${i}.png` })
    addImg({ src: "broken.webp", natural: [0, 0] })
    const { issues, summary } = checkImagesInDocument()
    expect(issues).toHaveLength(MAX_ISSUES)
    expect(issues[0].kind).toBe("broken")
    expect(summary.total).toBe(MAX_ISSUES)
  })

  test("background-image gets format info when rendered", () => {
    const div = document.createElement("div")
    div.setAttribute("style", "background-image:url('https://x/bg.jpg')")
    div.getBoundingClientRect = () => ({ width: 300, height: 250 }) as DOMRect
    document.body.appendChild(div)
    const { issues } = checkImagesInDocument()
    expect(issues).toHaveLength(1)
    expect(issues[0].kind).toBe("format")
    expect(issues[0].severity).toBe("info")
    expect(issues[0].src).toBe("https://x/bg.jpg")
    expect(issues[0].element).toBe(div)
  })

  test("background-image on hidden element ignored", () => {
    const div = document.createElement("div")
    div.setAttribute("style", "display:none;background-image:url(bg.jpg)")
    div.getBoundingClientRect = () => ({ width: 300, height: 250 }) as DOMRect
    document.body.appendChild(div)
    expect(checkImagesInDocument().issues).toEqual([])
  })
})

describe("getSizeFromImageUrl", () => {
  test("reads w/h from RTB House image URLs", () => {
    expect(
      getSizeFromImageUrl(
        "https://ams.creativecdn.com/ad/images?id=abc&w=269&h=300&o=G1&f=3"
      )
    ).toEqual({ width: 269, height: 300 })
  })

  test("returns null for other URLs or missing params", () => {
    expect(getSizeFromImageUrl("https://x.com/a.png?w=10&h=10")).toBe(null)
    expect(
      getSizeFromImageUrl("https://ams.creativecdn.com/ad/images?id=abc")
    ).toBe(null)
    expect(getSizeFromImageUrl("not a url")).toBe(null)
  })
})

describe("upscaled images", () => {
  const bgBox = (url: string, size: string, w: number, h: number) => {
    document.body.innerHTML = `<div id="b" style="background-image:url('${url}');background-size:${size}"></div>`
    const el = document.getElementById("b") as HTMLElement
    el.getBoundingClientRect = () => ({ width: w, height: h }) as DOMRect
    return el
  }
  const url = "https://ams.creativecdn.com/ad/images?id=x&w=80&h=294&f=3"

  test("flags a small image stretched to a much larger cover box", () => {
    bgBox(url, "cover", 300, 300)
    const issue = checkImagesInDocument(document).issues.find(
      (i) => i.kind === "upscaled"
    )
    expect(issue?.severity).toBe("error")
  })

  test("contain uses the limiting side", () => {
    bgBox(url, "contain", 300, 294)
    expect(
      checkImagesInDocument(document).issues.some((i) => i.kind === "upscaled")
    ).toBe(false)
  })

  test("natural-size backgrounds are never upscaled", () => {
    bgBox(url, "auto", 300, 300)
    expect(
      checkImagesInDocument(document).issues.some((i) => i.kind === "upscaled")
    ).toBe(false)
  })
})

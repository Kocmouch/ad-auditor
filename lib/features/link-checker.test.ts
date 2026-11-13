import { beforeEach, describe, expect, test } from "bun:test"

import {
  checkLinksInDocument,
  COLLAPSE_THRESHOLD,
  MAX_LINK_ISSUES
} from "~lib/features/link-checker"

// happy-dom has no layout, so supply a size.
const measure = () => ({ width: 100, height: 20 })
const run = () => checkLinksInDocument(document, { measure })
const kinds = () => run().issues.map((i) => i.kind)

beforeEach(() => {
  document.body.innerHTML = ""
  const w = window as unknown as Record<string, unknown>
  delete w.clickTag
  delete w.clickTAG
})

describe("checkLinksInDocument", () => {
  test("clean link has no issues", () => {
    document.body.innerHTML =
      '<a href="https://x.com" target="_blank" rel="noopener">Go</a>'
    const r = run()
    expect(r.issues).toEqual([])
    expect([r.summary.total, r.summary.errors, r.summary.warnings]).toEqual([0, 0, 0])
  })

  test("empty/placeholder href on offer-like anchor is an error", () => {
    for (const href of ["", "#", "javascript:void(0)", "javascript:void(0);"]) {
      document.body.innerHTML = `<a class="offer" href="${href}" target="_blank" rel="noopener">x</a>`
      const r = run()
      expect(r.issues).toHaveLength(1)
      expect(r.issues[0].kind).toBe("empty-href")
      expect(r.issues[0].severity).toBe("error")
      expect(r.issues[0].element instanceof HTMLElement).toBe(true)
    }
  })

  test("logo-like anchor detected via img alt", () => {
    document.body.innerHTML =
      '<a href="#" target="_blank" rel="noopener"><img alt="Brand logo" src="a.png"></a>'
    expect(kinds()).toEqual(["empty-href"])
  })

  test("empty href on unrelated anchor is ignored", () => {
    document.body.innerHTML =
      '<a href="#" target="_blank" rel="noopener">next</a>'
    expect(kinds()).toEqual([])
  })

  test("http link is a warning", () => {
    document.body.innerHTML =
      '<a href="http://x.com" target="_blank" rel="noopener">a</a>'
    const r = run()
    expect(r.issues[0].kind).toBe("insecure-link")
    expect(r.issues[0].severity).toBe("warning")
    expect(r.issues[0].href).toBe("http://x.com")
    expect(r.summary.warnings).toBe(1)
  })

  test("missing or wrong target is a warning", () => {
    document.body.innerHTML = '<a href="https://x.com">a</a>'
    expect(run().issues[0].kind).toBe("missing-target")
    expect(run().issues[0].severity).toBe("warning")
    document.body.innerHTML = '<a href="https://x.com" target="_self">a</a>'
    expect(run().issues[0].message).toContain("_self")
  })

  test("missing noopener on _blank is info", () => {
    document.body.innerHTML = '<a href="https://x.com" target="_blank">a</a>'
    expect(run().issues[0].kind).toBe("missing-noopener")
    expect(run().issues[0].severity).toBe("info")
  })

  test("noreferrer also satisfies rel check", () => {
    document.body.innerHTML =
      '<a href="https://x.com" target="_blank" rel="noreferrer">a</a>'
    expect(kinds()).toEqual([])
  })

  test("zero-size anchors are info", () => {
    document.body.innerHTML =
      '<a href="https://x.com" target="_blank" rel="noopener">a</a>'
    const r = checkLinksInDocument(document, {
      measure: () => ({ width: 0, height: 0 })
    })
    expect(r.issues.map((i) => i.kind)).toEqual(["not-visible"])
    expect(r.issues[0].severity).toBe("info")
  })

  test("hidden anchors are skipped entirely", () => {
    document.body.innerHTML =
      '<a class="offer" href="#" style="display:none">a</a>' +
      '<div style="display:none"><a class="logo" href="">b</a></div>' +
      '<a class="logo" href="" style="visibility:hidden">c</a>'
    expect(run().issues).toEqual([])
  })

  test("duplicate hrefs collapse into a count", () => {
    document.body.innerHTML = Array.from(
      { length: 5 },
      () => '<a href="https://x.com">a</a>'
    ).join("")
    const r = run()
    const dup = r.issues.find((i) => i.kind === "duplicate-href")!
    expect(dup.count).toBe(5)
    const target = r.issues.filter((i) => i.kind === "missing-target")
    expect(target).toHaveLength(1)
    expect(target[0].count).toBe(5)
    expect(target[0].message).toContain("5 links")
  })

  test("below threshold is not collapsed", () => {
    document.body.innerHTML = Array.from(
      { length: COLLAPSE_THRESHOLD - 1 },
      () => '<a href="https://x.com">a</a>'
    ).join("")
    const r = run()
    expect(r.issues.filter((i) => i.kind === "missing-target")).toHaveLength(
      COLLAPSE_THRESHOLD - 1
    )
    expect(r.issues.some((i) => i.kind === "duplicate-href")).toBe(false)
  })

  test("data-href / data-clicktag hints are checked", () => {
    document.body.innerHTML =
      '<div data-href="http://x.com">a</div><div data-clicktag="#">b</div><div onclick="go()">c</div>'
    const r = run()
    expect(r.issues.map((i) => i.kind).sort()).toEqual([
      "empty-href",
      "insecure-link"
    ])
    expect(r.issues.every((i) => i.severity === "warning")).toBe(true)
  })

  test("clickTag globals", () => {
    const w = window as unknown as Record<string, unknown>
    w.clickTag = ""
    w.clickTAG = "http://x.com"
    const r = run()
    expect(r.issues.map((i) => i.kind)).toEqual([
      "empty-clicktag",
      "insecure-clicktag"
    ])
    expect(r.issues[0].severity).toBe("error")
    expect(r.issues[0].element === undefined).toBe(true)
  })

  test("valid clickTag yields nothing", () => {
    ;(window as unknown as Record<string, unknown>).clickTag = "https://x.com"
    expect(run().issues).toEqual([])
  })

  test("sorted by severity and capped at 50", () => {
    document.body.innerHTML =
      '<a href="https://a.com" target="_blank">i</a>' +
      '<a href="https://b.com">w</a>' +
      '<a class="offer" href="#" target="_blank" rel="noopener">e</a>'
    expect(run().issues.map((i) => i.severity)).toEqual([
      "error",
      "warning",
      "info"
    ])

    document.body.innerHTML = Array.from(
      { length: 80 },
      (_, i) => `<a href="https://x.com/${i}">a</a>`
    ).join("")
    const r = run()
    expect(r.issues).toHaveLength(MAX_LINK_ISSUES)
    expect(r.summary.total).toBe(80)
    expect(r.summary.truncated).toBe(true)
  })
})

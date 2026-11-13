import { beforeEach, describe, expect, test } from "bun:test"

import {
  checkClickability,
  MAX_CLICK_ISSUES
} from "~lib/features/click-checker"

const viewport = { width: 300, height: 250 }

type Box = { width: number; height: number; left?: number; top?: number }

const run = (
  sizes: (el: HTMLElement) => Box = () => ({ width: 100, height: 40 }),
  hitTest: (x: number, y: number) => Element | null = () =>
    document.body.firstElementChild
) => checkClickability(document, { measure: sizes, hitTest, viewport })

const byId = (id: string) => document.getElementById(id) as HTMLElement

beforeEach(() => {
  document.body.innerHTML = ""
})

describe("checkClickability", () => {
  test("small close button is flagged with size; error under 12px", () => {
    document.body.innerHTML =
      '<div id="banner" onclick="x()"><button id="close">x</button></div>'
    const r = run((el) =>
      el.id === "close" ? { width: 8, height: 8 } : { width: 300, height: 250 }
    )
    const small = r.issues.filter((i) => i.kind === "small-target")
    expect(small).toHaveLength(1)
    expect(small[0].severity).toBe("error")
    expect(small[0].width).toBe(8)
    expect(small[0].height).toBe(8)
    expect(small[0].message).toContain("8x8")
    expect(small[0].element === byId("close")).toBe(true)
  })

  test("20x20 is a warning, 24x24 is fine", () => {
    document.body.innerHTML =
      '<button id="a">a</button><button id="b">b</button>'
    const r = run(
      (el) =>
        el.id === "a" ? { width: 20, height: 20 } : { width: 24, height: 24 },
      () => document.body.firstElementChild
    )
    const small = r.issues.filter((i) => i.kind === "small-target")
    expect(small).toHaveLength(1)
    expect(small[0].severity).toBe("warning")
  })

  test("whole-banner click areas and inline paragraph links are exempt", () => {
    document.body.innerHTML =
      '<div id="all" data-clicktag="x"></div><p>text <a id="inl">link</a></p>'
    const r = run((el) =>
      el.id === "all" ? { width: 300, height: 250 } : { width: 20, height: 10 }
    )
    expect(r.issues.filter((i) => i.kind === "small-target")).toEqual([])
  })

  test("hidden and zero-size clickables are ignored", () => {
    document.body.innerHTML =
      '<button id="h" style="display:none">h</button><button id="z">z</button>'
    const r = run((el) =>
      el.id === "z" ? { width: 0, height: 0 } : { width: 5, height: 5 }
    )
    expect(r.issues.filter((i) => i.kind === "small-target")).toEqual([])
  })

  test("cursor:pointer elements count as clickable", () => {
    document.body.innerHTML = '<div id="p" style="cursor:pointer"></div>'
    const r = run(() => ({ width: 10, height: 10 }))
    expect(r.issues.some((i) => i.kind === "small-target")).toBe(true)
  })

  test("missing href is never flagged", () => {
    document.body.innerHTML = '<div id="d" data-offer-id="1"></div>'
    const r = run(() => ({ width: 100, height: 100 }))
    expect(r.issues).toEqual([])
  })

  test("full coverage yields 100% and no issue", () => {
    document.body.innerHTML = '<div id="c" onclick="x()"></div>'
    const r = run(() => ({ width: 300, height: 250 }))
    expect(r.coverage).toEqual({ percent: 100, sampled: 120, covered: 120 })
    expect(r.issues).toEqual([])
  })

  test("hit descendant of clickable counts as covered", () => {
    document.body.innerHTML = '<a id="c"><span id="s">x</span></a>'
    const r = run(
      () => ({ width: 300, height: 250 }),
      () => byId("s")
    )
    expect(r.coverage.percent).toBe(100)
  })

  test("coverage below 60% warns, below 25% errors", () => {
    document.body.innerHTML =
      '<div id="c" onclick="x()"></div><div id="bg"></div>'
    // Cover left 5 of 12 columns = ~41.7%.
    const half = run(
      () => ({ width: 300, height: 250 }),
      (x) => (x < 125 ? byId("c") : byId("bg"))
    )
    expect(half.coverage.percent).toBe(41.7)
    const w = half.issues.find((i) => i.kind === "low-coverage")!
    expect(w.severity).toBe("warning")
    expect(w.element === undefined).toBe(true)

    const none = run(
      () => ({ width: 300, height: 250 }),
      () => byId("bg")
    )
    expect(none.coverage.covered).toBe(0)
    expect(none.issues.find((i) => i.kind === "low-coverage")!.severity).toBe(
      "error"
    )
  })

  test("null hit points are uncovered", () => {
    document.body.innerHTML = '<div onclick="x()"></div>'
    const r = run(undefined, () => null)
    expect(r.coverage.covered).toBe(0)
  })

  test("obstructed opt-out reports the covering element", () => {
    document.body.innerHTML =
      '<div id="c" onclick="x()"></div><div class="overlay big"></div><a id="o" class="optout">i</a>'
    const overlay = document.querySelector(".overlay") as HTMLElement
    const r = run(
      (el) =>
        el.id === "o"
          ? { width: 30, height: 30, left: 10, top: 10 }
          : { width: 300, height: 250 },
      (x, y) => (x === 25 && y === 25 ? overlay : byId("c"))
    )
    const obs = r.issues.filter((i) => i.kind === "obstructed")
    expect(obs).toHaveLength(1)
    expect(obs[0].severity).toBe("warning")
    expect(obs[0].message).toContain("div.overlay")
    expect(obs[0].element === byId("o")).toBe(true)
  })

  test("unobstructed small clickable is fine", () => {
    document.body.innerHTML = '<a id="o" class="optout">i</a>'
    const r = run(
      () => ({ width: 30, height: 30, left: 10, top: 10 }),
      () => byId("o")
    )
    expect(r.issues.filter((i) => i.kind === "obstructed")).toEqual([])
  })

  test("errors sort first and list is capped", () => {
    document.body.innerHTML =
      '<div onclick="x()">' +
      Array.from(
        { length: 60 },
        (_, i) => `<button id="b${i}">x</button>`
      ).join("") +
      "</div>"
    const r = run(
      (el) =>
        el.id === "b59"
          ? { width: 5, height: 5 }
          : el.tagName === "DIV"
            ? { width: 300, height: 250 }
            : { width: 20, height: 20 },
      () => document.body.firstElementChild
    )
    expect(r.issues).toHaveLength(MAX_CLICK_ISSUES)
    expect(r.issues[0].severity).toBe("error")
    expect(r.summary.total).toBe(60)
    expect(r.summary.errors).toBe(1)
    expect(r.summary.warnings).toBe(59)
    expect(r.summary.truncated).toBe(true)
  })
})

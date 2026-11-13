import { beforeEach, describe, expect, test } from "bun:test"

import {
  checkStructure,
  ERROR_FONT_PX,
  MAX_ISSUES,
  type ElementMetrics,
  type StructureIssue
} from "~lib/features/structure-checker"

type Box = {
  rect?: [number, number, number, number] // left, top, width, height
  scroll?: [number, number]
  client?: [number, number]
}

const metrics = new Map<Element, ElementMetrics>()

const setBox = (
  el: Element,
  { rect = [0, 0, 100, 20], scroll, client }: Box = {}
) => {
  const [left, top, width, height] = rect
  const [cw, ch] = client ?? [width, height]
  const [sw, sh] = scroll ?? [cw, ch]
  metrics.set(el, {
    rect: {
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height
    },
    scrollWidth: sw,
    clientWidth: cw,
    scrollHeight: sh,
    clientHeight: ch
  })
  return el as HTMLElement
}

const ZERO: ElementMetrics = {
  rect: { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 },
  scrollWidth: 0,
  clientWidth: 0,
  scrollHeight: 0,
  clientHeight: 0
}

const run = () =>
  checkStructure(document, {
    measure: (el) => metrics.get(el) ?? ZERO,
    viewport: { width: 300, height: 250 }
  })

const byKind = (issues: StructureIssue[], kind: StructureIssue["kind"]) =>
  issues.filter((i) => i.kind === kind)

const add = (html: string) => {
  const host = document.createElement("div")
  host.innerHTML = html
  const el = host.firstElementChild as HTMLElement
  document.body.appendChild(el)
  return el
}

beforeEach(() => {
  metrics.clear()
  document.head.innerHTML = '<meta charset="utf-8">'
  document.body.innerHTML = ""
  document.documentElement.removeAttribute("style")
  document.body.removeAttribute("style")
  Reflect.deleteProperty(document, "doctype")
  Reflect.deleteProperty(document, "compatMode")
})

const setDoctype = (compat: string) => {
  Object.defineProperty(document, "doctype", {
    value: { name: "html" },
    configurable: true
  })
  Object.defineProperty(document, "compatMode", {
    value: compat,
    configurable: true
  })
}

describe("document", () => {
  test("missing doctype warns", () => {
    const r = run()
    const q = byKind(r.issues, "quirks-mode")
    expect(q.length).toBe(1)
    expect(q[0].severity).toBe("warning")
  })

  test("standards mode is clean", () => {
    setDoctype("CSS1Compat")
    expect(byKind(run().issues, "quirks-mode").length).toBe(0)
  })

  test("BackCompat with doctype warns", () => {
    setDoctype("BackCompat")
    expect(byKind(run().issues, "quirks-mode").length).toBe(1)
  })

  test("missing charset is info, http-equiv counts", () => {
    document.head.innerHTML = ""
    const r = run()
    const c = byKind(r.issues, "charset")
    expect(c.length).toBe(1)
    expect(c[0].severity).toBe("info")
    document.head.innerHTML =
      '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">'
    expect(byKind(run().issues, "charset").length).toBe(0)
  })

  test("duplicate ids are listed with counts", () => {
    add('<div id="a"></div>')
    add('<div id="a"></div>')
    add('<div id="b"></div>')
    add('<div id="b"></div>')
    add('<div id="b"></div>')
    add('<div id="c"></div>')
    const d = byKind(run().issues, "duplicate-id")
    expect(d.length).toBe(1)
    expect(d[0].severity).toBe("warning")
    expect(d[0].message.includes('"a" x2')).toBe(true)
    expect(d[0].message.includes('"b" x3')).toBe(true)
    expect(d[0].message.includes('"c"')).toBe(false)
  })

  test("duplicate id list is capped at 10", () => {
    for (let i = 0; i < 12; i++) {
      add(`<div id="id${i}"></div>`)
      add(`<div id="id${i}"></div>`)
    }
    const d = byKind(run().issues, "duplicate-id")
    expect(d[0].message.includes("and 2 more")).toBe(true)
    expect(d[0].message.includes('"id11"')).toBe(false)
  })

  test("ids inside the overlay layer are ignored", () => {
    add(
      '<div id="ad-auditor-highlight-layer"><i id="x"></i><i id="x"></i></div>'
    )
    expect(byKind(run().issues, "duplicate-id").length).toBe(0)
  })
})

describe("invalid attributes", () => {
  test("curly-quote width on img", () => {
    add('<img src="a.png" width="“1”" height="1">')
    const a = byKind(run().issues, "invalid-attribute")
    expect(a.length).toBe(1)
    expect(a[0].message.includes("width")).toBe(true)
    expect(a[0].severity).toBe("warning")
  })

  test("valid numeric, px and % lengths pass", () => {
    add('<img src="a.png" width="10" height="20px">')
    add('<canvas width="50%" height="1.5"></canvas>')
    expect(byKind(run().issues, "invalid-attribute").length).toBe(0)
  })

  test("svg viewport without viewBox", () => {
    document.body.innerHTML = '<svg viewport="0 0 10 10"></svg>'
    const a = byKind(run().issues, "invalid-attribute")
    expect(a.length).toBe(1)
    expect(a[0].message.includes("viewBox")).toBe(true)
    document.body.innerHTML =
      '<svg viewport="0 0 10 10" viewBox="0 0 10 10"></svg>'
    expect(byKind(run().issues, "invalid-attribute").length).toBe(0)
  })

  test("img without src and srcset", () => {
    add("<img>")
    add('<img srcset="a.png 2x">')
    expect(byKind(run().issues, "invalid-attribute").length).toBe(1)
  })
})

describe("overflow", () => {
  test("page scrollbars warn with numbers", () => {
    setBox(document.documentElement, {
      rect: [0, 0, 300, 250],
      client: [300, 250],
      scroll: [320, 400]
    })
    const o = byKind(run().issues, "overflow")
    expect(o.length).toBe(2)
    expect(o[0].message.includes("+20px")).toBe(true)
    expect(o[1].message.includes("+150px")).toBe(true)
  })

  test("1px difference and hidden overflow are ignored", () => {
    setBox(document.documentElement, { client: [300, 250], scroll: [301, 251] })
    expect(byKind(run().issues, "overflow").length).toBe(0)
    document.body.setAttribute("style", "overflow:hidden")
    setBox(document.body, { client: [300, 250], scroll: [900, 900] })
    expect(byKind(run().issues, "overflow").length).toBe(0)
  })
})

describe("clipped text", () => {
  test("warns when more than 20% is cut", () => {
    const el = add('<div style="overflow:hidden">Hello world</div>')
    setBox(el, { rect: [0, 0, 50, 20], client: [50, 20], scroll: [100, 20] })
    const c = byKind(run().issues, "clipped-text")
    expect(c.length).toBe(1)
    expect(c[0].severity).toBe("warning")
    expect(c[0].element).toBe(el)
  })

  test("info for a small cut", () => {
    const el = add('<div style="overflow:hidden">Hello</div>')
    setBox(el, { client: [100, 20], scroll: [110, 20] })
    expect(byKind(run().issues, "clipped-text")[0].severity).toBe("info")
  })

  test("ellipsis, visible overflow and no direct text are skipped", () => {
    const a = add(
      '<div style="overflow:hidden;text-overflow:ellipsis">Long</div>'
    )
    setBox(a, { client: [50, 20], scroll: [100, 20] })
    const b = add("<div>Visible</div>")
    setBox(b, { client: [50, 20], scroll: [100, 20] })
    const c = add('<div style="overflow:hidden"><span>x</span></div>')
    setBox(c, { client: [50, 20], scroll: [100, 20] })
    expect(byKind(run().issues, "clipped-text").length).toBe(0)
  })

  test("is capped per document", () => {
    for (let i = 0; i < 40; i++) {
      const el = add('<p style="overflow:hidden">t</p>')
      setBox(el, { client: [10, 10], scroll: [50, 10] })
    }
    expect(byKind(run().issues, "clipped-text").length).toBe(20)
  })
})

describe("tiny fonts", () => {
  test("warning under 8px, error under 5px, with size", () => {
    const a = add('<span class="legal" style="font-size:7px">terms</span>')
    setBox(a)
    const b = add('<span class="micro" style="font-size:4px">x</span>')
    setBox(b)
    const c = add('<span style="font-size:12px">ok</span>')
    setBox(c)
    const t = byKind(run().issues, "tiny-font")
    expect(t.length).toBe(2)
    expect(t[0].severity).toBe("error")
    expect(t[0].message.includes("4px")).toBe(true)
    expect(t[1].severity).toBe("warning")
    expect(t[1].message.includes("span.legal")).toBe(true)
    expect(ERROR_FONT_PX).toBe(5)
  })

  test("collapses by class and size", () => {
    for (let i = 0; i < 3; i++) {
      setBox(add('<span class="fine" style="font-size:6px">t</span>'))
    }
    const t = byKind(run().issues, "tiny-font")
    expect(t.length).toBe(1)
    expect(t[0].message.includes("3 elements")).toBe(true)
  })

  test("hidden elements are skipped", () => {
    setBox(add('<span style="font-size:6px;display:none">t</span>'))
    setBox(add('<span style="font-size:6px;visibility:hidden">t</span>'))
    expect(byKind(run().issues, "tiny-font").length).toBe(0)
  })

  test("overlay elements are skipped", () => {
    const layer = add('<div id="ad-auditor-highlight-layer"></div>')
    const inner = document.createElement("span")
    inner.setAttribute("style", "font-size:6px")
    inner.textContent = "t"
    layer.appendChild(inner)
    setBox(inner)
    expect(byKind(run().issues, "tiny-font").length).toBe(0)
  })
})

describe("offscreen", () => {
  test("flags elements fully right/below the viewport as info", () => {
    const right = add("<div></div>")
    setBox(right, { rect: [350, 10, 50, 50] })
    const below = add("<div></div>")
    setBox(below, { rect: [10, 300, 50, 50] })
    const inside = add("<div></div>")
    setBox(inside, { rect: [250, 200, 100, 100] })
    const o = byKind(run().issues, "offscreen")
    expect(o.length).toBe(2)
    expect(o[0].severity).toBe("info")
  })

  test("ignores tiny elements and descendants of reported ones", () => {
    const tiny = add("<div></div>")
    setBox(tiny, { rect: [400, 0, 5, 5] })
    const parent = add("<div><p></p></div>")
    setBox(parent, { rect: [400, 0, 50, 50] })
    setBox(parent.firstElementChild as Element, { rect: [400, 0, 20, 20] })
    const o = byKind(run().issues, "offscreen")
    expect(o.length).toBe(1)
    expect(o[0].element).toBe(parent)
  })
})

describe("bounds (standalone mode)", () => {
  const runBounds = () =>
    checkStructure(document, {
      measure: (el) => metrics.get(el) ?? ZERO,
      viewport: { width: 1200, height: 800 },
      bounds: { left: 100, top: 50, width: 300, height: 250 }
    })

  test("elements beyond bounds but inside the window are info", () => {
    const out = add("<div></div>")
    setBox(out, { rect: [450, 60, 50, 50] })
    const below = add("<div></div>")
    setBox(below, { rect: [120, 320, 50, 50] })
    const inside = add("<div></div>")
    setBox(inside, { rect: [380, 280, 100, 100] })
    const o = byKind(runBounds().issues, "offscreen")
    expect(o.length).toBe(2)
    expect(o[0].severity).toBe("info")
    // Same elements are fine against the full viewport.
    expect(
      byKind(
        checkStructure(document, {
          measure: (el) => metrics.get(el) ?? ZERO,
          viewport: { width: 1200, height: 800 }
        }).issues,
        "offscreen"
      ).length
    ).toBe(0)
  })

  test("document scrollbar check is skipped when bounds is given", () => {
    setBox(document.documentElement, {
      client: [1200, 800],
      scroll: [1500, 2000]
    })
    expect(byKind(runBounds().issues, "overflow").length).toBe(0)
  })
})

describe("result", () => {
  test("errors first, summary counts, cap", () => {
    setBox(add('<span style="font-size:6px">w</span>'))
    setBox(add('<span style="font-size:2px">e</span>'))
    const r = run()
    expect(r.issues[0].severity).toBe("error")
    expect(r.summary.errors).toBe(1)
    expect(r.summary.total).toBe(r.issues.length)

    for (let i = 0; i < 80; i++) {
      setBox(add(`<span class="c${i}" style="font-size:6px">w</span>`))
    }
    const big = run()
    expect(big.issues.length).toBe(MAX_ISSUES)
    expect(big.issues[0].severity).toBe("error")
  })
})

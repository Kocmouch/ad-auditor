import { beforeEach, describe, expect, test } from "bun:test"

import {
  checkTemplateLeaks,
  MAX_EXCERPT_LENGTH,
  MAX_TEMPLATE_LEAK_ISSUES
} from "~lib/features/template-leak-checker"

beforeEach(() => {
  document.body.innerHTML = ""
})

const run = (html: string) => {
  document.body.innerHTML = html
  return checkTemplateLeaks(document)
}
const tokens = (html: string) => run(html).issues.map((i) => i.token)

describe("text leaks", () => {
  test("clean creative has no issues", () => {
    const r = run("<div><p>Buy now for 49,99 zl</p><span>0.00</span></div>")
    expect(r.issues).toEqual([])
    expect([r.summary.total, r.summary.errors, r.summary.warnings]).toEqual([
      0, 0, 0
    ])
  })

  test("flags undefined, null and NaN as errors", () => {
    for (const word of ["undefined", "null", "NaN"]) {
      const r = run(`<p>Price: ${word} USD</p>`)
      expect(r.issues).toHaveLength(1)
      expect(r.issues[0].kind).toBe("text")
      expect(r.issues[0].severity).toBe("error")
      expect(r.issues[0].token).toBe(word)
      expect(r.issues[0].excerpt).toBe(`Price: ${word} USD`)
      expect(r.issues[0].element?.tagName).toBe("P")
    }
  })

  test("flags [object Object]", () => {
    expect(tokens("<p>Hi [object Object]</p>")).toEqual(["[object Object]"])
  })

  test("flags template syntaxes", () => {
    expect(tokens("<p>{{ product.price }}</p>")).toEqual([
      "{{ product.price }}"
    ])
    expect(tokens("<p>${price} PLN</p>")).toEqual(["${price}"])
    expect(tokens("<p>&lt;%= price %&gt;</p>")).toEqual(["<%= price %>"])
    expect(tokens("<p>Hello %s, you have %d items</p>")).toEqual(["%s", "%d"])
    expect(tokens("<p>Save {0} on {1}</p>")).toEqual(["{0}", "{1}"])
  })

  test("overlapping tokens are reported once", () => {
    expect(tokens("<p>{{ undefined }}</p>")).toEqual(["{{ undefined }}"])
  })

  test("Infinity and {name} are warnings", () => {
    const r = run("<p>Infinity</p><p>Hi {name}</p>")
    expect(r.issues.map((i) => i.severity)).toEqual(["warning", "warning"])
    expect(r.summary.warnings).toBe(2)
    expect(r.summary.errors).toBe(0)
  })

  test("false-positive guards: words containing tokens", () => {
    const r = run(
      "<p>nullable annulled undefinedly Nancy nano nan</p>" +
        "<p>non-null null-safe 50%sale 20% sale 100%discount</p>" +
        "<p>Zero 0.00 0,00 0.00 PLN</p>"
    )
    expect(r.issues).toEqual([])
  })

  test("skips script, style, noscript and template content", () => {
    const r = run(
      "<script>var a = undefined; '{{x}}'</script><style>.a::after{content:'null'}</style>" +
        "<noscript>undefined</noscript><template><p>{{ x }}</p></template>"
    )
    expect(r.issues).toEqual([])
  })

  test("skips hidden elements and hidden ancestors", () => {
    const r = run(
      '<div style="display:none"><p>undefined</p></div>' +
        '<div style="visibility:hidden">null</div>' +
        '<div style="opacity:0"><span>NaN</span></div>' +
        "<div hidden>{{ x }}</div>"
    )
    expect(r.issues).toEqual([])
  })

  test("still flags visible siblings of hidden elements", () => {
    const r = run('<div style="display:none">null</div><p>undefined</p>')
    expect(r.issues).toHaveLength(1)
    expect(r.issues[0].element?.tagName).toBe("P")
  })

  test("long text is excerpted to the limit and contains the token", () => {
    const filler = "lorem ipsum dolor sit amet ".repeat(10)
    const r = run(`<p>${filler} undefined ${filler}</p>`)
    expect(r.issues).toHaveLength(1)
    expect(r.issues[0].excerpt.length).toBeLessThanOrEqual(MAX_EXCERPT_LENGTH)
    expect(r.issues[0].excerpt).toContain("undefined")
  })

  test("very long token is truncated", () => {
    const r = run(`<p>{{ ${"a".repeat(200)} }}</p>`)
    expect(r.issues[0].token.length).toBeLessThanOrEqual(40)
  })
})

describe("url leaks", () => {
  test("flags tokens in href and src as errors", () => {
    const r = run(
      '<a href="https://shop.com/product/undefined">x</a>' +
        '<img src="https://cdn.com/img/null.png">'
    )
    expect(r.issues).toHaveLength(2)
    for (const issue of r.issues) {
      expect(issue.kind).toBe("url")
      expect(issue.severity).toBe("error")
      expect(issue.element instanceof HTMLElement).toBe(true)
    }
    expect(r.issues.map((i) => i.token).sort()).toEqual(["null", "undefined"])
  })

  test("flags NaN, [object Object], %s and placeholders", () => {
    expect(tokens('<a href="/p?id=NaN">x</a>')).toEqual(["NaN"])
    expect(tokens('<a href="/p/[object Object]">x</a>')).toEqual([
      "[object Object]"
    ])
    expect(tokens('<a href="/p/%5Bobject%20Object%5D">x</a>')).toEqual([
      "%5Bobject%20Object%5D"
    ])
    expect(tokens('<a href="/p/%s/x">x</a>')).toEqual(["%s"])
    expect(tokens('<a href="https://a.com/{{id}}">x</a>')).toEqual(["{{id}}"])
    expect(tokens('<a href="https://a.com/${id}">x</a>')).toEqual(["${id}"])
    expect(tokens('<a href="https://a.com/%7B%7Bid%7D%7D">x</a>')).toEqual([
      "%7B%7Bid%7D%7D"
    ])
  })

  test("token glued to - or _ is only a warning", () => {
    const r = run('<img src="/img/photo_null.png">')
    expect(r.issues).toHaveLength(1)
    expect(r.issues[0].severity).toBe("warning")
  })

  test("{MACRO} in url is a warning", () => {
    const r = run('<a href="https://a.com/?u={CLICK_URL}">x</a>')
    expect(r.issues).toHaveLength(1)
    expect(r.issues[0].severity).toBe("warning")
  })

  test("data-* attributes are checked only when url-like", () => {
    expect(
      tokens('<div data-src="https://a.com/undefined.jpg"></div>')
    ).toEqual(["undefined"])
    expect(tokens('<div data-label="null" data-x="undefined"></div>')).toEqual(
      []
    )
    expect(tokens('<div data-img="images/a/null.png"></div>')).toEqual(["null"])
  })

  test("hidden elements' URLs are still checked", () => {
    expect(
      tokens('<div style="display:none"><img src="/undefined.png"></div>')
    ).toEqual(["undefined"])
  })

  test("computed background-image url is checked", () => {
    const r = run(
      "<div style=\"background-image: url('https://cdn.com/bg/undefined.jpg')\"></div>"
    )
    expect(r.issues).toHaveLength(1)
    expect(r.issues[0].kind).toBe("url")
    expect(r.issues[0].severity).toBe("error")
    expect(r.issues[0].message).toContain("background-image")
  })

  test("false-positive guards", () => {
    const r = run(
      '<a href="https://shop.com/annulled/nullable">x</a>' +
        '<a href="#">y</a><a href="javascript:void(0)">z</a>' +
        '<img src="data:image/png;base64,AAnullAA">' +
        '<a href="https://a.com/sale?discount=50%25">d</a>' +
        '<a href="https://a.com/100%sale">e</a>' +
        '<div style="background-image: url(https://cdn.com/bg.jpg)"></div>'
    )
    expect(r.issues).toEqual([])
  })
})

describe("result shaping", () => {
  test("dedupes identical issues", () => {
    const r = run("<p>undefined</p><p>undefined</p><p>undefined</p>")
    expect(r.issues).toHaveLength(1)
    expect(r.summary.total).toBe(1)
  })

  test("same token with different excerpt is kept", () => {
    expect(run("<p>a undefined</p><p>b undefined</p>").issues).toHaveLength(2)
  })

  test("same token as text and url are distinct", () => {
    const r = run('<p>null</p><a href="/null">x</a>')
    expect(r.issues.map((i) => i.kind).sort()).toEqual(["text", "url"])
  })

  test("sorts errors before warnings", () => {
    const r = run("<p>Infinity</p><p>undefined</p>")
    expect(r.issues.map((i) => i.severity)).toEqual(["error", "warning"])
    expect([r.summary.total, r.summary.errors, r.summary.warnings]).toEqual([
      2, 1, 1
    ])
  })

  test("caps issues but reports full total", () => {
    const html = Array.from(
      { length: MAX_TEMPLATE_LEAK_ISSUES + 20 },
      (_, i) => `<p>item ${i} undefined</p>`
    ).join("")
    const r = run(html)
    expect(r.issues).toHaveLength(MAX_TEMPLATE_LEAK_ISSUES)
    expect(r.summary.total).toBe(MAX_TEMPLATE_LEAK_ISSUES + 20)
    expect(r.summary.errors).toBe(MAX_TEMPLATE_LEAK_ISSUES + 20)
  })

  test("excerpts never exceed the limit", () => {
    const long = "x".repeat(300)
    const r = run(`<a href="https://a.com/${long}/undefined/${long}">x</a>`)
    expect(r.issues[0].excerpt.length).toBeLessThanOrEqual(MAX_EXCERPT_LENGTH)
    expect(r.issues[0].excerpt).toContain("undefined")
  })
})

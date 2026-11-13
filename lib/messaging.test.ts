import { describe, expect, test } from "bun:test"

import {
  getFrameTargetOrigin,
  getOriginFromSrc,
  parseWindowMessage,
  sanitizeRequestItems,
  toWireFontMismatches,
  toWireIssues,
  WINDOW_MESSAGE
} from "./messaging"

describe("wire format", () => {
  test("keeps the registered message type strings", () => {
    expect(WINDOW_MESSAGE.CHECK_FONTS_REQUEST).toBe(
      "ad-auditor-check-fonts-request"
    )
    expect(WINDOW_MESSAGE.CHECK_FONTS_RESPONSE).toBe(
      "ad-auditor-check-fonts-response"
    )
    expect(WINDOW_MESSAGE.CHECK_ACCESSIBILITY_REQUEST).toBe(
      "ad-auditor-check-accessibility-request"
    )
    expect(WINDOW_MESSAGE.CHECK_ACCESSIBILITY_RESPONSE).toBe(
      "ad-auditor-check-accessibility-response"
    )
    expect(WINDOW_MESSAGE.CLEAR_FONT_HIGHLIGHTS).toBe(
      "ad-auditor-clear-font-highlights"
    )
    expect(WINDOW_MESSAGE.CLEAR_ACCESSIBILITY_HIGHLIGHTS).toBe(
      "ad-auditor-clear-accessibility-highlights"
    )
    expect(WINDOW_MESSAGE.FONT_CHECK_RESULTS).toBe(
      "ad-auditor-font-check-results"
    )
    expect(WINDOW_MESSAGE.STATS).toBe("stats")
  })
})

describe("parseWindowMessage", () => {
  test("rejects non-objects and unknown types", () => {
    expect(parseWindowMessage(null)).toBeNull()
    expect(parseWindowMessage("stats")).toBeNull()
    expect(parseWindowMessage([])).toBeNull()
    expect(parseWindowMessage({ type: 5 })).toBeNull()
    expect(parseWindowMessage({ type: "something-else" })).toBeNull()
  })

  test("accepts request messages", () => {
    expect(
      parseWindowMessage({ type: WINDOW_MESSAGE.CHECK_FONTS_REQUEST })
    ).toEqual({ type: WINDOW_MESSAGE.CHECK_FONTS_REQUEST })
    expect(
      parseWindowMessage({
        type: WINDOW_MESSAGE.CLEAR_ACCESSIBILITY_HIGHLIGHTS
      })
    ).toEqual({ type: WINDOW_MESSAGE.CLEAR_ACCESSIBILITY_HIGHLIGHTS })
  })

  test("stats requires source and payload and sanitises values", () => {
    expect(parseWindowMessage({ type: "stats", payload: {} })).toBeNull()
    expect(parseWindowMessage({ source: "ad-auditor", type: "stats" })).toBeNull()

    const parsed = parseWindowMessage({
      payload: {
        requestCount: -4,
        requestItems: [
          {
            host: "a",
            resources: 5,
            status: "pending",
            transferred: "7",
            type: "img",
            url: "u"
          },
          "junk",
          null
        ],
        resources: "12",
        transferred: Infinity,
        url: 42
      },
      source: "ad-auditor",
      type: "stats"
    })

    expect(parsed?.type).toBe("stats")
    if (parsed?.type === "stats") {
      expect(parsed.payload.requestCount).toBe(0)
      expect(parsed.payload.requestCountText).toBe("0 req")
      expect(parsed.payload.resources).toBe(12)
      expect(parsed.payload.url).toBe("")
      expect(parsed.payload.requestItems).toEqual([
        {
          host: "a",
          resources: 5,
          status: "pending",
          transferred: 7,
          type: "img",
          url: "u"
        }
      ])
    }
  })

  test("font response needs an array and drops invalid entries", () => {
    expect(
      parseWindowMessage({ type: WINDOW_MESSAGE.CHECK_FONTS_RESPONSE })
    ).toBeNull()

    expect(
      parseWindowMessage({
        fontMismatches: [
          { declared: "A 400", element: "p", rendered: "serif" },
          3
        ],
        iframeUrl: "https://x",
        type: WINDOW_MESSAGE.CHECK_FONTS_RESPONSE
      })
    ).toEqual({
      fontMismatches: [{ declared: "A 400", element: "p", rendered: "serif" }],
      iframeUrl: "https://x",
      type: WINDOW_MESSAGE.CHECK_FONTS_RESPONSE
    })
  })

  test("font results from host-overlay need a valid iframe index", () => {
    const base = {
      fontMismatches: [],
      iframeUrl: "",
      type: WINDOW_MESSAGE.FONT_CHECK_RESULTS
    }
    expect(parseWindowMessage({ ...base, iframeIndex: -1 })).toBeNull()
    expect(parseWindowMessage({ ...base, iframeIndex: 1.5 })).toBeNull()
    expect(parseWindowMessage({ ...base, iframeIndex: "0" })).toBeNull()
    expect(parseWindowMessage({ ...base, iframeIndex: 2 })).toEqual({
      ...base,
      iframeIndex: 2
    })
  })

  test("accessibility response tolerates missing arrays", () => {
    expect(
      parseWindowMessage({ type: WINDOW_MESSAGE.CHECK_ACCESSIBILITY_RESPONSE })
    ).toEqual({
      borderIssues: [],
      iframeUrl: "",
      optOutIssues: [],
      type: WINDOW_MESSAGE.CHECK_ACCESSIBILITY_RESPONSE
    })
  })
})

describe("wire helpers", () => {
  test("toWireFontMismatches drops the DOM element", () => {
    const wire = toWireFontMismatches([
      {
        declared: "A 400",
        element: "p",
        htmlElement: document.createElement("p"),
        rendered: "serif"
      }
    ])
    expect(wire).toEqual([
      { declared: "A 400", element: "p", rendered: "serif" }
    ])
    expect("htmlElement" in wire[0]).toBe(false)
  })

  test("toWireIssues drops htmlElement and result is cloneable", () => {
    const wire = toWireIssues([
      { details: "x", element: "a", htmlElement: document.createElement("a") }
    ])
    expect(wire).toEqual([{ details: "x", element: "a" }])
    expect(structuredClone(wire)).toEqual(wire)
  })

  test("sanitizeRequestItems handles non-arrays", () => {
    expect(sanitizeRequestItems(undefined)).toEqual([])
  })
})

describe("origins", () => {
  test("getOriginFromSrc only accepts http(s)", () => {
    expect(getOriginFromSrc("https://a.example.com/x?y=1")).toBe(
      "https://a.example.com"
    )
    expect(getOriginFromSrc("/relative", "https://b.example.com/page")).toBe(
      "https://b.example.com"
    )
    expect(getOriginFromSrc("about:blank")).toBeNull()
    expect(getOriginFromSrc("")).toBeNull()
    expect(getOriginFromSrc("javascript:alert(1)")).toBeNull()
  })

  test("getFrameTargetOrigin falls back to * when src is unusable", () => {
    const withSrc = document.createElement("iframe")
    withSrc.setAttribute("src", "https://ads.example.com/creative.html")
    expect(getFrameTargetOrigin(withSrc)).toBe("https://ads.example.com")

    const srcdoc = document.createElement("iframe")
    srcdoc.setAttribute("srcdoc", "<p>hi</p>")
    expect(getFrameTargetOrigin(srcdoc)).toBe("*")
  })
})

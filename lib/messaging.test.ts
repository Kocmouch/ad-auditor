import { describe, expect, test } from "bun:test"

import {
  getFrameTargetOrigin,
  getOriginFromSrc,
  parseWindowMessage,
  sanitizeCheckOutcomes,
  sanitizeConsoleProblems,
  sanitizeContentIssues,
  sanitizeQualityIssues,
  sanitizeRequestItems,
  toWireContentIssues,
  toWireFontMismatches,
  toWireIssues,
  toWireQualityIssues,
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
    expect(WINDOW_MESSAGE.CHECK_CONTENT_REQUEST).toBe(
      "ad-auditor-check-content-request"
    )
    expect(WINDOW_MESSAGE.CHECK_CONTENT_RESPONSE).toBe(
      "ad-auditor-check-content-response"
    )
    expect(WINDOW_MESSAGE.CLEAR_CONTENT_HIGHLIGHTS).toBe(
      "ad-auditor-clear-content-highlights"
    )
    expect(WINDOW_MESSAGE.FOCUS_CONTENT_ISSUE).toBe(
      "ad-auditor-focus-content-issue"
    )
    expect(WINDOW_MESSAGE.CHECK_QUALITY_REQUEST).toBe(
      "ad-auditor-check-quality-request"
    )
    expect(WINDOW_MESSAGE.CHECK_QUALITY_RESPONSE).toBe(
      "ad-auditor-check-quality-response"
    )
    expect(WINDOW_MESSAGE.CLEAR_QUALITY_HIGHLIGHTS).toBe(
      "ad-auditor-clear-quality-highlights"
    )
    expect(WINDOW_MESSAGE.FOCUS_QUALITY_ISSUE).toBe(
      "ad-auditor-focus-quality-issue"
    )
    expect(WINDOW_MESSAGE.AUDIT_REQUEST).toBe("ad-auditor-audit-request")
    expect(WINDOW_MESSAGE.AUDIT_RESPONSE).toBe("ad-auditor-audit-response")
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
    expect(
      parseWindowMessage({ source: "ad-auditor", type: "stats" })
    ).toBeNull()

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

describe("content and audit messages", () => {
  test("accepts content/audit requests and clear messages", () => {
    for (const type of [
      WINDOW_MESSAGE.CHECK_CONTENT_REQUEST,
      WINDOW_MESSAGE.CLEAR_CONTENT_HIGHLIGHTS,
      WINDOW_MESSAGE.AUDIT_REQUEST
    ]) {
      expect(parseWindowMessage({ type })).toEqual({ type })
    }
  })

  test("content response needs an array and drops invalid issues", () => {
    expect(
      parseWindowMessage({ type: WINDOW_MESSAGE.CHECK_CONTENT_RESPONSE })
    ).toBeNull()
    expect(
      parseWindowMessage({
        iframeUrl: "https://x",
        issues: [
          {
            category: "images",
            kind: "broken",
            message: "m",
            severity: "error"
          },
          { category: "other", kind: "k", message: "m", severity: "error" },
          { category: "links", kind: "k", message: "m", severity: "fatal" },
          "junk"
        ],
        type: WINDOW_MESSAGE.CHECK_CONTENT_RESPONSE
      })
    ).toEqual({
      iframeUrl: "https://x",
      issues: [
        { category: "images", kind: "broken", message: "m", severity: "error" }
      ],
      type: WINDOW_MESSAGE.CHECK_CONTENT_RESPONSE
    })
  })

  test("focus message needs a non-negative integer index", () => {
    const type = WINDOW_MESSAGE.FOCUS_CONTENT_ISSUE
    expect(parseWindowMessage({ index: 3, type })).toEqual({ index: 3, type })
    expect(parseWindowMessage({ index: -1, type })).toBeNull()
    expect(parseWindowMessage({ index: 1.2, type })).toBeNull()
    expect(parseWindowMessage({ index: "1", type })).toBeNull()
    expect(parseWindowMessage({ type })).toBeNull()
  })

  test("audit response keeps only valid check outcomes", () => {
    expect(
      parseWindowMessage({
        checks: {
          accessibility: { count: 1, severity: "bogus" },
          content: { count: 2, severity: "warning" },
          fonts: { count: -4, severity: "ok" },
          unknown: { count: 1, severity: "error" }
        },
        iframeUrl: "https://x",
        type: WINDOW_MESSAGE.AUDIT_RESPONSE
      })
    ).toEqual({
      checks: {
        content: { count: 2, severity: "warning" },
        fonts: { count: 0, severity: "ok" }
      },
      iframeUrl: "https://x",
      type: WINDOW_MESSAGE.AUDIT_RESPONSE
    })
    expect(sanitizeCheckOutcomes("nope")).toEqual({})
  })

  test("toWireContentIssues drops the element and is cloneable", () => {
    const wire = toWireContentIssues([
      {
        category: "links",
        element: document.createElement("a"),
        kind: "empty-href",
        message: "m",
        severity: "warning"
      }
    ])
    expect(wire).toEqual([
      {
        category: "links",
        hasElement: true,
        kind: "empty-href",
        message: "m",
        severity: "warning"
      }
    ])
    expect(structuredClone(wire)).toEqual(wire)
    expect(sanitizeContentIssues(undefined)).toEqual([])
  })
})

describe("quality messages", () => {
  test("accepts quality request and clear messages", () => {
    for (const type of [
      WINDOW_MESSAGE.CHECK_QUALITY_REQUEST,
      WINDOW_MESSAGE.CLEAR_QUALITY_HIGHLIGHTS
    ]) {
      expect(parseWindowMessage({ type })).toEqual({ type })
    }
  })

  test("quality response needs an array, drops invalid issues, clamps coverage", () => {
    expect(
      parseWindowMessage({ type: WINDOW_MESSAGE.CHECK_QUALITY_RESPONSE })
    ).toBeNull()
    expect(
      parseWindowMessage({
        coveragePercent: 140,
        iframeUrl: "https://x",
        issues: [
          {
            category: "clicks",
            hasElement: true,
            kind: "k",
            message: "m",
            severity: "warning"
          },
          { category: "images", kind: "k", message: "m", severity: "error" },
          { category: "clicks", kind: "k", message: "m", severity: "fatal" }
        ],
        type: WINDOW_MESSAGE.CHECK_QUALITY_RESPONSE
      })
    ).toEqual({
      coveragePercent: 100,
      iframeUrl: "https://x",
      issues: [
        {
          category: "clicks",
          hasElement: true,
          kind: "k",
          message: "m",
          severity: "warning"
        }
      ],
      type: WINDOW_MESSAGE.CHECK_QUALITY_RESPONSE
    })
    expect(
      parseWindowMessage({
        coveragePercent: "x",
        issues: [],
        type: WINDOW_MESSAGE.CHECK_QUALITY_RESPONSE
      })
    ).toEqual({
      coveragePercent: null,
      iframeUrl: "",
      issues: [],
      type: WINDOW_MESSAGE.CHECK_QUALITY_RESPONSE
    })
  })

  test("focus quality message needs a non-negative integer index", () => {
    const type = WINDOW_MESSAGE.FOCUS_QUALITY_ISSUE
    expect(parseWindowMessage({ index: 2, type })).toEqual({ index: 2, type })
    expect(parseWindowMessage({ index: -1, type })).toBeNull()
    expect(parseWindowMessage({ type })).toBeNull()
  })

  test("content responses accept the template category", () => {
    expect(
      sanitizeContentIssues([
        { category: "template", kind: "text", message: "m", severity: "error" }
      ]).length
    ).toBe(1)
  })

  test("toWireQualityIssues drops the element and is cloneable", () => {
    const wire = toWireQualityIssues([
      {
        category: "structure",
        element: document.createElement("div"),
        kind: "tiny-font",
        message: "m",
        severity: "warning"
      },
      {
        category: "clicks",
        kind: "low-coverage",
        message: "c",
        severity: "error"
      }
    ])
    expect(wire).toEqual([
      {
        category: "structure",
        hasElement: true,
        kind: "tiny-font",
        message: "m",
        severity: "warning"
      },
      {
        category: "clicks",
        kind: "low-coverage",
        message: "c",
        severity: "error"
      }
    ])
    expect(structuredClone(wire)).toEqual(wire)
    expect(sanitizeQualityIssues(undefined)).toEqual([])
  })

  test("audit response keeps quality and console outcomes", () => {
    const checks = {
      console: { count: 1, severity: "error" },
      quality: { count: 2, severity: "warning" }
    }
    expect(
      parseWindowMessage({
        checks,
        iframeUrl: "",
        type: WINDOW_MESSAGE.AUDIT_RESPONSE
      })
    ).toEqual({
      checks,
      iframeUrl: "",
      type: WINDOW_MESSAGE.AUDIT_RESPONSE
    })
  })
})

describe("console problems on stats", () => {
  test("sanitizeConsoleProblems keeps valid entries only", () => {
    const valid = {
      count: 2,
      kind: "exception",
      line: 4,
      message: "boom",
      severity: "error",
      timestamp: 5,
      url: "https://x/a.js"
    }
    expect(
      sanitizeConsoleProblems([
        valid,
        { kind: "nope", message: "x", severity: "error" },
        "junk"
      ])
    ).toEqual([valid as never])
    expect(sanitizeConsoleProblems(undefined)).toEqual([])
  })

  test("stats payload carries sanitised console problems", () => {
    const message = parseWindowMessage({
      payload: {
        consoleProblems: [
          { kind: "console-error", message: "m", severity: "error" }
        ]
      },
      source: "ad-auditor",
      type: WINDOW_MESSAGE.STATS
    })
    expect(
      message?.type === WINDOW_MESSAGE.STATS
        ? message.payload.consoleProblems.length
        : -1
    ).toBe(1)
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

  test("sanitizeRequestItems keeps well-formed problem fields only", () => {
    const [item] = sanitizeRequestItems([
      {
        blocked: "yes",
        contentEncoding: "gzip",
        decodedBytes: 100,
        errorText: "net::ERR_FAILED",
        failed: true,
        httpStatus: 404,
        redirectChain: ["a", 5, "b"],
        url: "u"
      }
    ])
    expect(item.httpStatus).toBe(404)
    expect(item.failed).toBe(true)
    expect("blocked" in item).toBe(false)
    expect(item.errorText).toBe("net::ERR_FAILED")
    expect(item.contentEncoding).toBe("gzip")
    expect(item.decodedBytes).toBe(100)
    expect(item.redirectChain).toEqual(["a", "b"])
  })

  test("sanitizeRequestItems omits absent problem fields", () => {
    const [item] = sanitizeRequestItems([{ url: "u" }])
    expect("httpStatus" in item).toBe(false)
    expect("redirectChain" in item).toBe(false)
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

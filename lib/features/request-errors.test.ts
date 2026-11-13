import { describe, expect, test } from "bun:test"

import {
  findRequestProblems,
  REDIRECT_CHAIN_MIN_HOPS,
  UNCOMPRESSED_MIN_BYTES,
  type RequestRecord
} from "~lib/features/request-errors"

const req = (over: Partial<RequestRecord> = {}): RequestRecord => ({
  host: "cdn.example.com",
  resources: 1,
  status: "done",
  transferred: 1000,
  type: "Script",
  url: "https://cdn.example.com/a.js",
  ...over
})

const kinds = (r: RequestRecord[], opts?: Parameters<typeof findRequestProblems>[1]) =>
  findRequestProblems(r, opts).problems.map((p) => p.kind)

describe("findRequestProblems", () => {
  test("healthy requests yield nothing", () => {
    const r = findRequestProblems([req({ httpStatus: 200 }), req()])
    expect(r.problems).toEqual([])
    expect(r.summary).toEqual({ total: 0, errors: 0, warnings: 0 })
  })

  test("404 and 410 have explicit messages", () => {
    const r = findRequestProblems([
      req({ httpStatus: 404 }),
      req({ httpStatus: 410 }),
      req({ httpStatus: 503 })
    ])
    expect(r.problems.map((p) => p.status)).toEqual([404, 410, 503])
    expect(r.problems[0].message).toContain("404")
    expect(r.problems[0].message).toContain("not found")
    expect(r.problems[1].message).toContain("gone")
    expect(r.problems[2].message).toContain("503")
    expect(r.problems.every((p) => p.severity === "error")).toBe(true)
  })

  test("status below 400 is fine, threshold is configurable", () => {
    expect(kinds([req({ httpStatus: 399 })])).toEqual([])
    expect(kinds([req({ httpStatus: 302 })], { minErrorStatus: 300 })).toEqual([
      "http-error"
    ])
  })

  test("failed and blocked requests", () => {
    const r = findRequestProblems([
      req({ failed: true, errorText: "net::ERR_CONNECTION_REFUSED" }),
      req({ blocked: true, errorText: "csp" }),
      req({ failed: true, blocked: true })
    ])
    expect(r.problems.map((p) => p.kind)).toEqual(["failed", "blocked", "blocked"])
    expect(r.problems[0].message).toContain("ERR_CONNECTION_REFUSED")
    expect(r.problems[1].message).toContain("csp")
    expect(r.summary.errors).toBe(3)
  })

  test("mixed content is a warning", () => {
    const r = findRequestProblems([req({ url: "http://x.com/a.png" })])
    expect(r.problems).toHaveLength(1)
    expect(r.problems[0].kind).toBe("mixed-content")
    expect(r.problems[0].severity).toBe("warning")
    expect(r.summary.warnings).toBe(1)
  })

  test("uncompressed large text resources", () => {
    const big = UNCOMPRESSED_MIN_BYTES + 1
    expect(kinds([req({ contentEncoding: "", transferred: big })])).toEqual([
      "uncompressed"
    ])
    expect(
      kinds([req({ url: "https://x.com/s.css?v=1", contentEncoding: "", decodedBytes: big })])
    ).toEqual(["uncompressed"])
    expect(
      kinds([req({ url: "https://x.com/i.svg", contentEncoding: "", transferred: big })])
    ).toEqual(["uncompressed"])
  })

  test("uncompressed check respects encoding, size, type and missing info", () => {
    const big = UNCOMPRESSED_MIN_BYTES + 1
    expect(kinds([req({ contentEncoding: "gzip", transferred: big })])).toEqual([])
    expect(kinds([req({ contentEncoding: "br", transferred: big })])).toEqual([])
    expect(
      kinds([req({ contentEncoding: "", transferred: UNCOMPRESSED_MIN_BYTES })])
    ).toEqual([])
    expect(
      kinds([
        req({ url: "https://x.com/a.png", type: "Image", contentEncoding: "", transferred: big })
      ])
    ).toEqual([])
    // no encoding info on the record: cannot judge
    expect(kinds([req({ transferred: big })])).toEqual([])
    // decoded size wins over transferred
    expect(
      kinds([req({ contentEncoding: "", transferred: 100, decodedBytes: big })])
    ).toEqual(["uncompressed"])
  })

  test("typeless-extension document counts as text", () => {
    expect(
      kinds([
        req({
          url: "https://x.com/page",
          type: "Document",
          contentEncoding: "",
          transferred: UNCOMPRESSED_MIN_BYTES + 5
        })
      ])
    ).toEqual(["uncompressed"])
  })

  test("redirect chains", () => {
    const chain = Array.from({ length: REDIRECT_CHAIN_MIN_HOPS }, (_, i) => `https://r${i}.com/`)
    const r = findRequestProblems([
      req({ redirectChain: chain }),
      req({ redirectChain: chain.slice(0, 1) })
    ])
    expect(r.problems.map((p) => p.kind)).toEqual(["redirect-chain"])
    expect(r.problems[0].message).toContain(`${REDIRECT_CHAIN_MIN_HOPS} redirects`)
  })

  test("one request can produce several problems; cap applies to list only", () => {
    const r = findRequestProblems(
      [req({ url: "http://x.com/a.js", httpStatus: 500 }), req({ httpStatus: 404 })],
      { maxProblems: 2 }
    )
    expect(r.problems).toHaveLength(2)
    expect(r.summary.total).toBe(3)
  })
})

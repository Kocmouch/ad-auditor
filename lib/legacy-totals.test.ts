import { describe, expect, test } from "bun:test"

import { buildLegacyTotals } from "./legacy-totals"

const doc = {
  hostname: "ams.creativecdn.com",
  href: "https://ams.creativecdn.com/x"
}

describe("buildLegacyTotals", () => {
  test("sums resource entries and adds the navigation entry", () => {
    const totals = buildLegacyTotals(
      [
        {
          decodedBodySize: 300,
          encodedBodySize: 100,
          initiatorType: "img",
          name: "https://cdn.example.com/a.png",
          transferSize: 120
        },
        { decodedBodySize: 0, encodedBodySize: 50, name: "", transferSize: -5 }
      ],
      { decodedBodySize: 1000, encodedBodySize: 400, transferSize: 450 },
      doc
    )

    expect(totals.requests).toBe(3)
    expect(totals.transferred).toBe(120 + 0 + 450)
    expect(totals.resources).toBe(300 + 50 + 1000)
    expect(totals.requestItems).toEqual([
      {
        host: "cdn.example.com",
        resources: 300,
        status: "done",
        transferred: 120,
        type: "img",
        url: "https://cdn.example.com/a.png"
      },
      {
        host: "",
        resources: 50,
        status: "done",
        transferred: 0,
        type: "resource",
        url: "(resource)"
      },
      {
        host: "ams.creativecdn.com",
        resources: 1000,
        status: "done",
        transferred: 450,
        type: "document",
        url: "https://ams.creativecdn.com/x"
      }
    ])
  })

  test("works without a navigation entry", () => {
    expect(buildLegacyTotals([], undefined, doc)).toEqual({
      requestItems: [],
      requests: 0,
      resources: 0,
      transferred: 0
    })
  })
})

import { describe, expect, test } from "bun:test"

import { interpretEnhancedStats } from "./enhanced-totals"

const detail = {
  host: "h",
  resources: 2,
  status: "done",
  transferred: 1,
  type: "t",
  url: "u"
}

describe("interpretEnhancedStats", () => {
  test("treats failures and unavailable data the same", () => {
    expect(interpretEnhancedStats(null, false)).toEqual({ kind: "unavailable" })
    expect(
      interpretEnhancedStats({ ok: false, available: true }, false)
    ).toEqual({ kind: "unavailable" })
    expect(
      interpretEnhancedStats({ ok: true, available: false }, false)
    ).toEqual({ kind: "unavailable" })
  })

  test("reports empty when nothing is tracked", () => {
    expect(interpretEnhancedStats({ ok: true, available: true }, false)).toEqual(
      { kind: "empty" }
    )
  })

  test("uses document numbers when present", () => {
    expect(
      interpretEnhancedStats(
        {
          available: true,
          ok: true,
          requestDetails: [detail],
          resources: 20,
          tabTrackedRequests: 9,
          trackedRequests: 2,
          transferred: 10
        },
        false
      )
    ).toEqual({
      kind: "totals",
      totals: {
        requestItems: [detail],
        requests: 2,
        resources: 20,
        transferred: 10
      }
    })
  })

  test("top frame falls back to tab numbers, iframes do not", () => {
    const response = {
      available: true,
      ok: true,
      tabRequestDetails: [detail],
      tabResources: 7,
      tabTrackedRequests: 3,
      tabTransferred: 5,
      trackedRequests: 0
    }
    expect(interpretEnhancedStats(response, false)).toEqual({
      kind: "totals",
      totals: {
        requestItems: [detail],
        requests: 3,
        resources: 7,
        transferred: 5
      }
    })
    expect(interpretEnhancedStats(response, true)).toEqual({
      kind: "totals",
      totals: { requestItems: [], requests: 0, resources: 0, transferred: 0 }
    })
  })
})

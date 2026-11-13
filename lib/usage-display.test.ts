import { describe, expect, test } from "bun:test"

import { getUsageColor } from "./usage-color"
import {
  getUsageColors,
  hasNetworkAlerts,
  NO_ISSUES_ALERT
} from "./usage-display"

describe("usage display", () => {
  test("colours only the tracked metric", () => {
    const totals = { resources: 500, transferred: 100 }
    expect(getUsageColors("resources", totals, 1000)).toEqual({
      resources: getUsageColor(500, 1000),
      transferred: "#ffffff"
    })
    expect(getUsageColors("transferred", totals, 1000)).toEqual({
      resources: "#ffffff",
      transferred: getUsageColor(100, 1000)
    })
  })

  test("all-clear message is not a network alert", () => {
    expect(hasNetworkAlerts([])).toBe(false)
    expect(hasNetworkAlerts([NO_ISSUES_ALERT])).toBe(false)
    expect(hasNetworkAlerts(["High request volume detected (130)."])).toBe(true)
  })
})

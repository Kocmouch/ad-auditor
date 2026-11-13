import { describe, expect, test } from "bun:test"

import {
  getDefaultContentSettings,
  parseContentSettings
} from "./content-settings"
import { STORAGE_KEYS } from "./storage/keys"

describe("content settings", () => {
  test("undefined values fall back to defaults when parsing a full load", () => {
    const parsed = parseContentSettings(
      {
        [STORAGE_KEYS.LIMIT_BYTES]: undefined,
        [STORAGE_KEYS.SHOW_ALERTS]: true
      },
      { ...getDefaultContentSettings(), limitBytes: 1 }
    )
    expect(parsed.limitBytes).toBe(getDefaultContentSettings().limitBytes)
    expect(parsed.alertsEnabled).toBe(true)
  })

  test("only changed keys are updated", () => {
    const base = { ...getDefaultContentSettings(), waterfallEnabled: true }
    const next = parseContentSettings(
      { [STORAGE_KEYS.LIMIT_METRIC]: "transferred" },
      base
    )
    expect(next.limitMetric).toBe("transferred")
    expect(next.waterfallEnabled).toBe(true)
  })

  test("invalid values are replaced by defaults", () => {
    const next = parseContentSettings(
      { [STORAGE_KEYS.MEASUREMENT_METHOD]: "nope" },
      { ...getDefaultContentSettings(), measurementMethod: "legacy_performance" }
    )
    expect(next.measurementMethod).toBe(
      getDefaultContentSettings().measurementMethod
    )
  })
})

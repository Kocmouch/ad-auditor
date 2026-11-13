import { describe, expect, test } from "bun:test"

import { DEFAULTS } from "./defaults"
import { parsers } from "./parsers"

describe("settings defaults", () => {
  test("uses defaults for unknown values", () => {
    expect(parsers.measurementMethod(undefined)).toBe(DEFAULTS.MEASUREMENT_METHOD)
    expect(parsers.disableCache(undefined)).toBe(DEFAULTS.DISABLE_CACHE)
    expect(parsers.showCdpStatus(undefined)).toBe(DEFAULTS.SHOW_CDP_STATUS)
    expect(parsers.enableSnapshots(undefined)).toBe(DEFAULTS.ENABLE_SNAPSHOTS)
    expect(parsers.showWaterfall(undefined)).toBe(DEFAULTS.SHOW_WATERFALL)
    expect(parsers.focusOffenders(undefined)).toBe(DEFAULTS.FOCUS_OFFENDERS)
    expect(parsers.showAlerts(undefined)).toBe(DEFAULTS.SHOW_ALERTS)
  })

  test("parses settings version safely", () => {
    expect(parsers.settingsVersion(undefined)).toBe(0)
    expect(parsers.settingsVersion("1")).toBe(0)
    expect(parsers.settingsVersion(-1)).toBe(0)
    expect(parsers.settingsVersion(2.8)).toBe(2)
  })
})

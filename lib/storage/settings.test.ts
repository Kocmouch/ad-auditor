import { describe, expect, test } from "bun:test"

import {
  DEFAULT_BELOW_IFRAME_FULL_WIDTH,
  DEFAULT_DISABLE_CACHE,
  DEFAULT_DISPLAY_MODE,
  DEFAULT_ENABLE_SNAPSHOTS,
  DEFAULT_FOCUS_OFFENDERS,
  DEFAULT_MEASUREMENT_METHOD,
  DEFAULT_SHOW_ALERTS,
  DEFAULT_SHOW_CDP_STATUS,
  DEFAULT_SHOW_WATERFALL,
  parseBelowIframeFullWidth,
  parseDisableCache,
  parseDisplayMode,
  parseEnableSnapshots,
  parseFocusOffenders,
  parseMeasurementMethod,
  parseSettingsVersion,
  parseShowAlerts,
  parseShowCdpStatus,
  parseShowWaterfall
} from "./display-mode"

describe("display-mode defaults", () => {
  test("uses defaults for unknown values", () => {
    expect(parseDisplayMode(undefined)).toBe(DEFAULT_DISPLAY_MODE)
    expect(parseMeasurementMethod(undefined)).toBe(DEFAULT_MEASUREMENT_METHOD)
    expect(parseDisableCache(undefined)).toBe(DEFAULT_DISABLE_CACHE)
    expect(parseShowCdpStatus(undefined)).toBe(DEFAULT_SHOW_CDP_STATUS)
    expect(parseBelowIframeFullWidth(undefined)).toBe(
      DEFAULT_BELOW_IFRAME_FULL_WIDTH
    )
    expect(parseEnableSnapshots(undefined)).toBe(DEFAULT_ENABLE_SNAPSHOTS)
    expect(parseShowWaterfall(undefined)).toBe(DEFAULT_SHOW_WATERFALL)
    expect(parseFocusOffenders(undefined)).toBe(DEFAULT_FOCUS_OFFENDERS)
    expect(parseShowAlerts(undefined)).toBe(DEFAULT_SHOW_ALERTS)
  })

  test("parses settings version safely", () => {
    expect(parseSettingsVersion(undefined)).toBe(0)
    expect(parseSettingsVersion("1")).toBe(0)
    expect(parseSettingsVersion(-1)).toBe(0)
    expect(parseSettingsVersion(2.8)).toBe(2)
  })
})

import { describe, expect, test } from "bun:test"

import {
  DEFAULT_BELOW_IFRAME_FULL_WIDTH,
  DEFAULT_DISABLE_CACHE,
  DEFAULT_DISPLAY_MODE,
  DEFAULT_MEASUREMENT_METHOD,
  DEFAULT_SHOW_CDP_STATUS,
  parseBelowIframeFullWidth,
  parseDisableCache,
  parseDisplayMode,
  parseMeasurementMethod,
  parseSettingsVersion,
  parseShowCdpStatus
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
  })

  test("parses settings version safely", () => {
    expect(parseSettingsVersion(undefined)).toBe(0)
    expect(parseSettingsVersion("1")).toBe(0)
    expect(parseSettingsVersion(-1)).toBe(0)
    expect(parseSettingsVersion(2.8)).toBe(2)
  })
})

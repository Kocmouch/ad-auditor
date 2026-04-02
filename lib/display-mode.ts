export type DisplayMode = "inside_always" | "inside_hover" | "below_iframe"
export type MeasurementMethod = "legacy_performance" | "enhanced_cdp"
export type LimitMetric = "resources" | "transferred"

export const SETTINGS_VERSION_KEY = "adAuditorSettingsVersion"
export const CURRENT_SETTINGS_VERSION = 2
export const DISPLAY_MODE_KEY = "adAuditorDisplayMode"
export const STANDALONE_AMS_PREVIEW_BADGE_KEY =
  "adAuditorStandaloneAmsPreviewBadgeEnabled"
export const MEASUREMENT_METHOD_KEY = "adAuditorMeasurementMethod"
export const LIMIT_METRIC_KEY = "adAuditorLimitMetric"
export const LIMIT_BYTES_KEY = "adAuditorLimitBytes"
export const DISABLE_CACHE_KEY = "adAuditorDisableCache"
export const SHOW_CDP_STATUS_KEY = "adAuditorShowCdpStatus"
export const BELOW_IFRAME_FULL_WIDTH_KEY = "adAuditorBelowIframeFullWidth"

export const DEFAULT_DISPLAY_MODE: DisplayMode = "below_iframe"
export const DEFAULT_STANDALONE_AMS_PREVIEW_BADGE_ENABLED = false
export const DEFAULT_MEASUREMENT_METHOD: MeasurementMethod = "enhanced_cdp"
export const DEFAULT_LIMIT_METRIC: LimitMetric = "resources"
export const DEFAULT_LIMIT_BYTES = Math.round(2.5 * 1024 * 1024)
export const DEFAULT_DISABLE_CACHE = true
export const DEFAULT_SHOW_CDP_STATUS = false
export const DEFAULT_BELOW_IFRAME_FULL_WIDTH = false

export const parseDisplayMode = (value: unknown): DisplayMode => {
  if (
    value === "inside_always" ||
    value === "inside_hover" ||
    value === "below_iframe"
  ) {
    return value
  }

  return DEFAULT_DISPLAY_MODE
}

export const parseStandaloneAmsPreviewBadgeEnabled = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value
  }

  return DEFAULT_STANDALONE_AMS_PREVIEW_BADGE_ENABLED
}

export const parseMeasurementMethod = (value: unknown): MeasurementMethod => {
  if (value === "legacy_performance" || value === "enhanced_cdp") {
    return value
  }

  return DEFAULT_MEASUREMENT_METHOD
}

export const parseLimitMetric = (value: unknown): LimitMetric => {
  if (value === "resources" || value === "transferred") {
    return value
  }

  return DEFAULT_LIMIT_METRIC
}

export const parseLimitBytes = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value)
  }

  return DEFAULT_LIMIT_BYTES
}

export const parseDisableCache = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value
  }

  return DEFAULT_DISABLE_CACHE
}

export const parseShowCdpStatus = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value
  }

  return DEFAULT_SHOW_CDP_STATUS
}

export const parseBelowIframeFullWidth = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value
  }

  return DEFAULT_BELOW_IFRAME_FULL_WIDTH
}

export const parseSettingsVersion = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value)
  }

  return 0
}

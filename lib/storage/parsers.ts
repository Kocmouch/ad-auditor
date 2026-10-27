import type {
  LimitMetric,
  MeasurementMethod
} from "~lib/types/settings"

import { DEFAULTS } from "./defaults"

export const parsers = {
  standaloneAmsPreviewBadgeEnabled: (value: unknown): boolean => {
    if (typeof value === "boolean") {
      return value
    }
    return DEFAULTS.STANDALONE_AMS_PREVIEW_BADGE_ENABLED
  },

  measurementMethod: (value: unknown): MeasurementMethod => {
    if (value === "legacy_performance" || value === "enhanced_cdp") {
      return value
    }
    return DEFAULTS.MEASUREMENT_METHOD
  },

  limitMetric: (value: unknown): LimitMetric => {
    if (value === "resources" || value === "transferred") {
      return value
    }
    return DEFAULTS.LIMIT_METRIC
  },

  limitBytes: (value: unknown): number => {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return Math.round(value)
    }
    return DEFAULTS.LIMIT_BYTES
  },

  disableCache: (value: unknown): boolean => {
    if (typeof value === "boolean") {
      return value
    }
    return DEFAULTS.DISABLE_CACHE
  },

  showCdpStatus: (value: unknown): boolean => {
    if (typeof value === "boolean") {
      return value
    }
    return DEFAULTS.SHOW_CDP_STATUS
  },

  enableSnapshots: (value: unknown): boolean => {
    if (typeof value === "boolean") {
      return value
    }
    return DEFAULTS.ENABLE_SNAPSHOTS
  },

  showWaterfall: (value: unknown): boolean => {
    if (typeof value === "boolean") {
      return value
    }
    return DEFAULTS.SHOW_WATERFALL
  },

  focusOffenders: (value: unknown): boolean => {
    if (typeof value === "boolean") {
      return value
    }
    return DEFAULTS.FOCUS_OFFENDERS
  },

  showAlerts: (value: unknown): boolean => {
    if (typeof value === "boolean") {
      return value
    }
    return DEFAULTS.SHOW_ALERTS
  },

  showRequestList: (value: unknown): boolean => {
    if (typeof value === "boolean") {
      return value
    }
    return DEFAULTS.SHOW_REQUEST_LIST
  },

  settingsVersion: (value: unknown): number => {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return Math.floor(value)
    }
    return 0
  }
}

// Backwards compatibility exports
export const parseStandaloneAmsPreviewBadgeEnabled =
  parsers.standaloneAmsPreviewBadgeEnabled
export const parseMeasurementMethod = parsers.measurementMethod
export const parseLimitMetric = parsers.limitMetric
export const parseLimitBytes = parsers.limitBytes
export const parseDisableCache = parsers.disableCache
export const parseShowCdpStatus = parsers.showCdpStatus
export const parseEnableSnapshots = parsers.enableSnapshots
export const parseShowWaterfall = parsers.showWaterfall
export const parseFocusOffenders = parsers.focusOffenders
export const parseShowAlerts = parsers.showAlerts
export const parseShowRequestList = parsers.showRequestList
export const parseSettingsVersion = parsers.settingsVersion

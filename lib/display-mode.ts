// This file is kept for backwards compatibility
// All functionality has been split into separate modules:
// - lib/types/settings.ts - Type definitions
// - lib/storage/keys.ts - Storage key constants
// - lib/storage/defaults.ts - Default values
// - lib/storage/parsers.ts - Parser functions

export type { DisplayMode, MeasurementMethod, LimitMetric } from "~lib/types/settings"

export {
  STORAGE_KEYS,
  CURRENT_SETTINGS_VERSION,
  SETTINGS_VERSION_KEY,
  DISPLAY_MODE_KEY,
  STANDALONE_AMS_PREVIEW_BADGE_KEY,
  MEASUREMENT_METHOD_KEY,
  LIMIT_METRIC_KEY,
  LIMIT_BYTES_KEY,
  DISABLE_CACHE_KEY,
  SHOW_CDP_STATUS_KEY,
  BELOW_IFRAME_FULL_WIDTH_KEY,
  ENABLE_SNAPSHOTS_KEY,
  SHOW_WATERFALL_KEY,
  FOCUS_OFFENDERS_KEY,
  SHOW_ALERTS_KEY,
  SHOW_REQUEST_LIST_KEY
} from "~lib/storage/keys"

export {
  DEFAULTS,
  DEFAULT_DISPLAY_MODE,
  DEFAULT_STANDALONE_AMS_PREVIEW_BADGE_ENABLED,
  DEFAULT_MEASUREMENT_METHOD,
  DEFAULT_LIMIT_METRIC,
  DEFAULT_LIMIT_BYTES,
  DEFAULT_DISABLE_CACHE,
  DEFAULT_SHOW_CDP_STATUS,
  DEFAULT_BELOW_IFRAME_FULL_WIDTH,
  DEFAULT_ENABLE_SNAPSHOTS,
  DEFAULT_SHOW_WATERFALL,
  DEFAULT_FOCUS_OFFENDERS,
  DEFAULT_SHOW_ALERTS,
  DEFAULT_SHOW_REQUEST_LIST
} from "~lib/storage/defaults"

export {
  parsers,
  parseDisplayMode,
  parseStandaloneAmsPreviewBadgeEnabled,
  parseMeasurementMethod,
  parseLimitMetric,
  parseLimitBytes,
  parseDisableCache,
  parseShowCdpStatus,
  parseBelowIframeFullWidth,
  parseEnableSnapshots,
  parseShowWaterfall,
  parseFocusOffenders,
  parseShowAlerts,
  parseShowRequestList,
  parseSettingsVersion
} from "~lib/storage/parsers"

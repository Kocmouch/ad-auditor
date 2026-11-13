import type {
  LimitMetric,
  MeasurementMethod
} from "~lib/types/settings"

export const DEFAULTS = {
  STANDALONE_AMS_PREVIEW_BADGE_ENABLED: true as boolean,
  MEASUREMENT_METHOD: "enhanced_cdp" as MeasurementMethod,
  LIMIT_METRIC: "resources" as LimitMetric,
  LIMIT_BYTES: Math.round(2.5 * 1024 * 1024) as number,
  DISABLE_CACHE: true as boolean,
  SHOW_CDP_STATUS: false as boolean,
  ENABLE_SNAPSHOTS: false as boolean,
  SHOW_WATERFALL: false as boolean,
  FOCUS_OFFENDERS: false as boolean,
  SHOW_ALERTS: false as boolean,
  SHOW_REQUEST_LIST: false as boolean,
  ENABLE_CONTENT_CHECK: true as boolean,
  ENABLE_AUDIT_ALL: true as boolean
}

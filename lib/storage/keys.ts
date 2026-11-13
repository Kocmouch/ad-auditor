export const STORAGE_KEYS = {
  SETTINGS_VERSION: "adAuditorSettingsVersion",
  STANDALONE_AMS_PREVIEW_BADGE: "adAuditorStandaloneAmsPreviewBadgeEnabled",
  MEASUREMENT_METHOD: "adAuditorMeasurementMethod",
  LIMIT_METRIC: "adAuditorLimitMetric",
  LIMIT_BYTES: "adAuditorLimitBytes",
  DISABLE_CACHE: "adAuditorDisableCache",
  SHOW_CDP_STATUS: "adAuditorShowCdpStatus",
  ENABLE_SNAPSHOTS: "adAuditorEnableSnapshots",
  SHOW_WATERFALL: "adAuditorShowWaterfall",
  FOCUS_OFFENDERS: "adAuditorFocusOffenders",
  SHOW_ALERTS: "adAuditorShowAlerts",
  SHOW_REQUEST_LIST: "adAuditorShowRequestList",
  ENABLE_CONTENT_CHECK: "adAuditorEnableContentCheck",
  ENABLE_QUALITY_CHECK: "adAuditorEnableQualityCheck",
  ENABLE_AUDIT_ALL: "adAuditorEnableAuditAll"
} as const

export const CURRENT_SETTINGS_VERSION = 6

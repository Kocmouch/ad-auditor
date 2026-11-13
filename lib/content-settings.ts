import { DEFAULTS } from "~lib/storage/defaults"
import { STORAGE_KEYS } from "~lib/storage/keys"
import { parsers } from "~lib/storage/parsers"
import type { LimitMetric, MeasurementMethod } from "~lib/types/settings"

/** Settings read by the content scripts (monitor / host-overlay). */
export type ContentSettings = {
  alertsEnabled: boolean
  focusOffendersEnabled: boolean
  limitBytes: number
  limitMetric: LimitMetric
  measurementMethod: MeasurementMethod
  requestListEnabled: boolean
  snapshotsEnabled: boolean
  standaloneAmsPreviewBadgeEnabled: boolean
  waterfallEnabled: boolean
}

export const getDefaultContentSettings = (): ContentSettings => ({
  alertsEnabled: DEFAULTS.SHOW_ALERTS,
  focusOffendersEnabled: DEFAULTS.FOCUS_OFFENDERS,
  limitBytes: DEFAULTS.LIMIT_BYTES,
  limitMetric: DEFAULTS.LIMIT_METRIC,
  measurementMethod: DEFAULTS.MEASUREMENT_METHOD,
  requestListEnabled: DEFAULTS.SHOW_REQUEST_LIST,
  snapshotsEnabled: DEFAULTS.ENABLE_SNAPSHOTS,
  standaloneAmsPreviewBadgeEnabled: DEFAULTS.STANDALONE_AMS_PREVIEW_BADGE_ENABLED,
  waterfallEnabled: DEFAULTS.SHOW_WATERFALL
})

const FIELD_KEYS: Record<keyof ContentSettings, string> = {
  alertsEnabled: STORAGE_KEYS.SHOW_ALERTS,
  focusOffendersEnabled: STORAGE_KEYS.FOCUS_OFFENDERS,
  limitBytes: STORAGE_KEYS.LIMIT_BYTES,
  limitMetric: STORAGE_KEYS.LIMIT_METRIC,
  measurementMethod: STORAGE_KEYS.MEASUREMENT_METHOD,
  requestListEnabled: STORAGE_KEYS.SHOW_REQUEST_LIST,
  snapshotsEnabled: STORAGE_KEYS.ENABLE_SNAPSHOTS,
  standaloneAmsPreviewBadgeEnabled: STORAGE_KEYS.STANDALONE_AMS_PREVIEW_BADGE,
  waterfallEnabled: STORAGE_KEYS.SHOW_WATERFALL
}

const FIELD_PARSERS: { [K in keyof ContentSettings]: (v: unknown) => ContentSettings[K] } = {
  alertsEnabled: parsers.showAlerts,
  focusOffendersEnabled: parsers.focusOffenders,
  limitBytes: parsers.limitBytes,
  limitMetric: parsers.limitMetric,
  measurementMethod: parsers.measurementMethod,
  requestListEnabled: parsers.showRequestList,
  snapshotsEnabled: parsers.enableSnapshots,
  standaloneAmsPreviewBadgeEnabled: parsers.standaloneAmsPreviewBadgeEnabled,
  waterfallEnabled: parsers.showWaterfall
}

const FIELDS = Object.keys(FIELD_KEYS) as (keyof ContentSettings)[]

/** Parses raw storage values (full map for load, `newValue`s for changes). */
export const parseContentSettings = (
  raw: Record<string, unknown>,
  base: ContentSettings
): ContentSettings => {
  const next = { ...base } as Record<string, unknown>
  for (const field of FIELDS) {
    const key = FIELD_KEYS[field]
    if (key in raw) {
      next[field] = FIELD_PARSERS[field](raw[key])
    }
  }
  return next as ContentSettings
}

/**
 * Loads settings once, then calls `apply` again for every sync-storage change.
 * `getCurrent` supplies the last applied settings so unchanged keys are kept.
 */
export const watchContentSettings = (
  getCurrent: () => ContentSettings,
  apply: (settings: ContentSettings) => void
) => {
  chrome.storage.sync.get(Object.values(FIELD_KEYS), (result) => {
    const raw: Record<string, unknown> = {}
    for (const key of Object.values(FIELD_KEYS)) {
      raw[key] = result[key]
    }
    apply(parseContentSettings(raw, getDefaultContentSettings()))
  })

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") {
      return
    }

    const raw: Record<string, unknown> = {}
    for (const [key, change] of Object.entries(changes)) {
      raw[key] = change.newValue
    }
    apply(parseContentSettings(raw, getCurrent()))
  })
}

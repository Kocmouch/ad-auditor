import { STORAGE_KEYS, CURRENT_SETTINGS_VERSION } from "./keys"
import { DEFAULTS } from "./defaults"
import { parsers } from "./parsers"

export const getStorageSyncValues = (
  keys: string[]
): Promise<Record<string, unknown>> =>
  new Promise((resolve) => {
    chrome.storage.sync.get(keys, (result) => {
      resolve(result as Record<string, unknown>)
    })
  })

export const setStorageSyncValues = (
  values: Record<string, unknown>
): Promise<void> =>
  new Promise((resolve) => {
    chrome.storage.sync.set(values, () => resolve())
  })

export const getInstallDefaults = (): Record<string, unknown> => ({
  [STORAGE_KEYS.DISPLAY_MODE]: DEFAULTS.DISPLAY_MODE,
  [STORAGE_KEYS.MEASUREMENT_METHOD]: DEFAULTS.MEASUREMENT_METHOD,
  [STORAGE_KEYS.DISABLE_CACHE]: DEFAULTS.DISABLE_CACHE,
  [STORAGE_KEYS.SHOW_CDP_STATUS]: DEFAULTS.SHOW_CDP_STATUS,
  [STORAGE_KEYS.BELOW_IFRAME_FULL_WIDTH]: DEFAULTS.BELOW_IFRAME_FULL_WIDTH,
  [STORAGE_KEYS.ENABLE_SNAPSHOTS]: DEFAULTS.ENABLE_SNAPSHOTS,
  [STORAGE_KEYS.SHOW_WATERFALL]: DEFAULTS.SHOW_WATERFALL,
  [STORAGE_KEYS.FOCUS_OFFENDERS]: DEFAULTS.FOCUS_OFFENDERS,
  [STORAGE_KEYS.SHOW_ALERTS]: DEFAULTS.SHOW_ALERTS,
  [STORAGE_KEYS.SHOW_REQUEST_LIST]: DEFAULTS.SHOW_REQUEST_LIST,
  [STORAGE_KEYS.SETTINGS_VERSION]: CURRENT_SETTINGS_VERSION
})

export const runSettingsMigration = async (): Promise<boolean> => {
  const current = await getStorageSyncValues([
    STORAGE_KEYS.BELOW_IFRAME_FULL_WIDTH,
    STORAGE_KEYS.DISPLAY_MODE,
    STORAGE_KEYS.MEASUREMENT_METHOD,
    STORAGE_KEYS.DISABLE_CACHE,
    STORAGE_KEYS.ENABLE_SNAPSHOTS,
    STORAGE_KEYS.FOCUS_OFFENDERS,
    STORAGE_KEYS.SHOW_ALERTS,
    STORAGE_KEYS.SHOW_CDP_STATUS,
    STORAGE_KEYS.SHOW_WATERFALL,
    STORAGE_KEYS.SHOW_REQUEST_LIST,
    STORAGE_KEYS.SETTINGS_VERSION
  ])
  const updates: Record<string, unknown> = {}
  const storedVersion = parsers.settingsVersion(current[STORAGE_KEYS.SETTINGS_VERSION])

  if (storedVersion < CURRENT_SETTINGS_VERSION) {
    if (typeof current[STORAGE_KEYS.DISPLAY_MODE] === "undefined") {
      updates[STORAGE_KEYS.DISPLAY_MODE] = DEFAULTS.DISPLAY_MODE
    }

    if (typeof current[STORAGE_KEYS.MEASUREMENT_METHOD] === "undefined") {
      updates[STORAGE_KEYS.MEASUREMENT_METHOD] = DEFAULTS.MEASUREMENT_METHOD
    }

    if (typeof current[STORAGE_KEYS.DISABLE_CACHE] === "undefined") {
      updates[STORAGE_KEYS.DISABLE_CACHE] = DEFAULTS.DISABLE_CACHE
    }

    if (typeof current[STORAGE_KEYS.SHOW_CDP_STATUS] === "undefined") {
      updates[STORAGE_KEYS.SHOW_CDP_STATUS] = DEFAULTS.SHOW_CDP_STATUS
    }

    if (typeof current[STORAGE_KEYS.BELOW_IFRAME_FULL_WIDTH] === "undefined") {
      updates[STORAGE_KEYS.BELOW_IFRAME_FULL_WIDTH] = DEFAULTS.BELOW_IFRAME_FULL_WIDTH
    }

    if (typeof current[STORAGE_KEYS.ENABLE_SNAPSHOTS] === "undefined") {
      updates[STORAGE_KEYS.ENABLE_SNAPSHOTS] = DEFAULTS.ENABLE_SNAPSHOTS
    }

    if (typeof current[STORAGE_KEYS.SHOW_WATERFALL] === "undefined") {
      updates[STORAGE_KEYS.SHOW_WATERFALL] = DEFAULTS.SHOW_WATERFALL
    }

    if (typeof current[STORAGE_KEYS.FOCUS_OFFENDERS] === "undefined") {
      updates[STORAGE_KEYS.FOCUS_OFFENDERS] = DEFAULTS.FOCUS_OFFENDERS
    }

    if (typeof current[STORAGE_KEYS.SHOW_ALERTS] === "undefined") {
      updates[STORAGE_KEYS.SHOW_ALERTS] = DEFAULTS.SHOW_ALERTS
    }

    if (typeof current[STORAGE_KEYS.SHOW_REQUEST_LIST] === "undefined") {
      updates[STORAGE_KEYS.SHOW_REQUEST_LIST] = DEFAULTS.SHOW_REQUEST_LIST
    }

    updates[STORAGE_KEYS.SETTINGS_VERSION] = CURRENT_SETTINGS_VERSION
  }

  if (Object.keys(updates).length > 0) {
    await setStorageSyncValues(updates)
    return true
  }

  return false
}

export const getDisableCacheValue = async (): Promise<boolean> => {
  const result = await getStorageSyncValues([STORAGE_KEYS.DISABLE_CACHE])
  return parsers.disableCache(result[STORAGE_KEYS.DISABLE_CACHE])
}

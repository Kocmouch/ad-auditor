import { describe, expect, test } from "bun:test"

import { DEFAULTS } from "./defaults"
import { CURRENT_SETTINGS_VERSION, STORAGE_KEYS } from "./keys"
import { parsers } from "./parsers"
import { getInstallDefaults, runSettingsMigration } from "./settings"

describe("settings defaults", () => {
  test("uses defaults for unknown values", () => {
    expect(parsers.measurementMethod(undefined)).toBe(DEFAULTS.MEASUREMENT_METHOD)
    expect(parsers.disableCache(undefined)).toBe(DEFAULTS.DISABLE_CACHE)
    expect(parsers.showCdpStatus(undefined)).toBe(DEFAULTS.SHOW_CDP_STATUS)
    expect(parsers.enableSnapshots(undefined)).toBe(DEFAULTS.ENABLE_SNAPSHOTS)
    expect(parsers.showWaterfall(undefined)).toBe(DEFAULTS.SHOW_WATERFALL)
    expect(parsers.focusOffenders(undefined)).toBe(DEFAULTS.FOCUS_OFFENDERS)
    expect(parsers.showAlerts(undefined)).toBe(DEFAULTS.SHOW_ALERTS)
    expect(parsers.enableContentCheck(undefined)).toBe(
      DEFAULTS.ENABLE_CONTENT_CHECK
    )
    expect(parsers.enableAuditAll("yes")).toBe(DEFAULTS.ENABLE_AUDIT_ALL)
  })

  test("content check and audit all default to on", () => {
    expect(DEFAULTS.ENABLE_CONTENT_CHECK).toBe(true)
    expect(DEFAULTS.ENABLE_AUDIT_ALL).toBe(true)
  })

  test("content check and audit all parsers accept booleans", () => {
    expect(parsers.enableContentCheck(false)).toBe(false)
    expect(parsers.enableContentCheck(true)).toBe(true)
    expect(parsers.enableAuditAll(false)).toBe(false)
  })

  test("install defaults and migration cover the new keys", () => {
    const defaults = getInstallDefaults()
    expect(defaults[STORAGE_KEYS.ENABLE_CONTENT_CHECK]).toBe(true)
    expect(defaults[STORAGE_KEYS.ENABLE_AUDIT_ALL]).toBe(true)
    expect(defaults[STORAGE_KEYS.SETTINGS_VERSION]).toBe(
      CURRENT_SETTINGS_VERSION
    )
  })

  test("migration backfills missing keys from an older version", async () => {
    const store: Record<string, unknown> = {
      [STORAGE_KEYS.SETTINGS_VERSION]: 4,
      [STORAGE_KEYS.ENABLE_AUDIT_ALL]: false
    }
    const globals = globalThis as unknown as { chrome?: unknown }
    const previous = globals.chrome
    globals.chrome = {
      storage: {
        sync: {
          get: (keys: string[], cb: (r: Record<string, unknown>) => void) =>
            cb(Object.fromEntries(keys.map((key) => [key, store[key]]))),
          set: (values: Record<string, unknown>, cb: () => void) => {
            Object.assign(store, values)
            cb()
          }
        }
      }
    }
    try {
      await runSettingsMigration()
    } finally {
      globals.chrome = previous
    }
    expect(store[STORAGE_KEYS.ENABLE_CONTENT_CHECK]).toBe(true)
    // An explicit user choice is never overwritten.
    expect(store[STORAGE_KEYS.ENABLE_AUDIT_ALL]).toBe(false)
    expect(store[STORAGE_KEYS.SETTINGS_VERSION]).toBe(CURRENT_SETTINGS_VERSION)
  })

  test("parses settings version safely", () => {
    expect(parsers.settingsVersion(undefined)).toBe(0)
    expect(parsers.settingsVersion("1")).toBe(0)
    expect(parsers.settingsVersion(-1)).toBe(0)
    expect(parsers.settingsVersion(2.8)).toBe(2)
  })
})

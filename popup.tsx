import { useEffect, useMemo, useState } from "react"

import {
  BELOW_IFRAME_FULL_WIDTH_KEY,
  DEFAULT_BELOW_IFRAME_FULL_WIDTH,
  DEFAULT_ENABLE_SNAPSHOTS,
  DEFAULT_FOCUS_OFFENDERS,
  DEFAULT_SHOW_ALERTS,
  DEFAULT_SHOW_CDP_STATUS,
  DEFAULT_DISABLE_CACHE,
  DEFAULT_LIMIT_BYTES,
  DEFAULT_LIMIT_METRIC,
  DEFAULT_MEASUREMENT_METHOD,
  DEFAULT_SHOW_WATERFALL,
  DEFAULT_STANDALONE_AMS_PREVIEW_BADGE_ENABLED,
  DEFAULT_DISPLAY_MODE,
  DISABLE_CACHE_KEY,
  DISPLAY_MODE_KEY,
  ENABLE_SNAPSHOTS_KEY,
  FOCUS_OFFENDERS_KEY,
  LIMIT_BYTES_KEY,
  LIMIT_METRIC_KEY,
  MEASUREMENT_METHOD_KEY,
  SHOW_ALERTS_KEY,
  SHOW_CDP_STATUS_KEY,
  SHOW_WATERFALL_KEY,
  STANDALONE_AMS_PREVIEW_BADGE_KEY,
  type DisplayMode,
  type LimitMetric,
  type MeasurementMethod,
  parseDisplayMode,
  parseDisableCache,
  parseLimitBytes,
  parseLimitMetric,
  parseMeasurementMethod,
  parseBelowIframeFullWidth,
  parseEnableSnapshots,
  parseFocusOffenders,
  parseShowAlerts,
  parseShowCdpStatus,
  parseShowWaterfall,
  parseStandaloneAmsPreviewBadgeEnabled
} from "~lib/display-mode"

const DISPLAY_OPTIONS: Array<{
  value: DisplayMode
  label: string
  description: string
  badge: string
}> = [
  {
    value: "inside_always",
    label: "Inside iframe (always visible)",
    description: "Overlay stays visible at the bottom of each ad iframe.",
    badge: "01"
  },
  {
    value: "inside_hover",
    label: "Inside iframe (show on hover)",
    description: "Overlay appears only when the cursor is over the iframe.",
    badge: "02"
  },
  {
    value: "below_iframe",
    label: "Below iframe",
    description: "Overlay is rendered under the iframe on the host page.",
    badge: "03"
  }
]

const MEASUREMENT_OPTIONS: Array<{
  value: MeasurementMethod
  label: string
  description: string
  badge: string
}> = [
  {
    value: "enhanced_cdp",
    label: "Enhanced (CDP)",
    description: "Closest to DevTools; uses Chrome debugger network events.",
    badge: "A"
  },
  {
    value: "legacy_performance",
    label: "Legacy (Performance API)",
    description: "Uses performance resource timing in the current frame.",
    badge: "L"
  }
]

const LIMIT_METRIC_OPTIONS: Array<{
  value: LimitMetric
  label: string
  description: string
  badge: string
}> = [
  {
    value: "resources",
    label: "Resources (default)",
    description: "Color follows raw resource size usage.",
    badge: "R"
  },
  {
    value: "transferred",
    label: "Transferred",
    description: "Color follows transferred network bytes.",
    badge: "T"
  }
]

const formatLimitMb = (bytes: number): string =>
  (bytes / (1024 * 1024)).toFixed(2).replace(/\.?0+$/, "")

type CdpStatus = "idle" | "loading" | "attached" | "fallback" | "error"
type LimitPreset = {
  bytes: number
  key: "light" | "standard" | "strict"
  label: string
  valueLabel: string
}

const LIMIT_PRESETS: LimitPreset[] = [
  {
    bytes: Math.round(1.5 * 1024 * 1024),
    key: "light",
    label: "Light",
    valueLabel: "1.5 MB"
  },
  {
    bytes: Math.round(2.5 * 1024 * 1024),
    key: "standard",
    label: "Standard",
    valueLabel: "2.5 MB"
  },
  {
    bytes: Math.round(5 * 1024 * 1024),
    key: "strict",
    label: "Strict",
    valueLabel: "5 MB"
  }
]

function IndexPopup() {
  const [mode, setMode] = useState<DisplayMode>(DEFAULT_DISPLAY_MODE)
  const [isDarkTheme, setIsDarkTheme] = useState(false)
  const [measurementMethod, setMeasurementMethod] = useState<MeasurementMethod>(
    DEFAULT_MEASUREMENT_METHOD
  )
  const [standaloneAmsPreviewBadgeEnabled, setStandaloneAmsPreviewBadgeEnabled] =
    useState<boolean>(DEFAULT_STANDALONE_AMS_PREVIEW_BADGE_ENABLED)
  const [disableCache, setDisableCache] = useState<boolean>(DEFAULT_DISABLE_CACHE)
  const [showCdpStatus, setShowCdpStatus] = useState<boolean>(
    DEFAULT_SHOW_CDP_STATUS
  )
  const [snapshotsEnabled, setSnapshotsEnabled] = useState<boolean>(
    DEFAULT_ENABLE_SNAPSHOTS
  )
  const [waterfallEnabled, setWaterfallEnabled] = useState<boolean>(
    DEFAULT_SHOW_WATERFALL
  )
  const [focusOffendersEnabled, setFocusOffendersEnabled] = useState<boolean>(
    DEFAULT_FOCUS_OFFENDERS
  )
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(DEFAULT_SHOW_ALERTS)
  const [cdpStatus, setCdpStatus] = useState<CdpStatus>("idle")
  const [cdpStatusReason, setCdpStatusReason] = useState("")
  const [belowIframeFullWidth, setBelowIframeFullWidth] = useState<boolean>(
    DEFAULT_BELOW_IFRAME_FULL_WIDTH
  )
  const [limitMetric, setLimitMetric] = useState<LimitMetric>(DEFAULT_LIMIT_METRIC)
  const [limitBytes, setLimitBytes] = useState<number>(DEFAULT_LIMIT_BYTES)
  const [limitMbInput, setLimitMbInput] = useState<string>(
    formatLimitMb(DEFAULT_LIMIT_BYTES)
  )

  useEffect(() => {
    chrome.storage.sync.get(
      [
        DISPLAY_MODE_KEY,
        MEASUREMENT_METHOD_KEY,
        STANDALONE_AMS_PREVIEW_BADGE_KEY,
        DISABLE_CACHE_KEY,
        SHOW_CDP_STATUS_KEY,
        BELOW_IFRAME_FULL_WIDTH_KEY,
        ENABLE_SNAPSHOTS_KEY,
        SHOW_WATERFALL_KEY,
        FOCUS_OFFENDERS_KEY,
        SHOW_ALERTS_KEY,
        LIMIT_METRIC_KEY,
        LIMIT_BYTES_KEY
      ],
      (result) => {
        setMode(parseDisplayMode(result[DISPLAY_MODE_KEY]))
        setMeasurementMethod(parseMeasurementMethod(result[MEASUREMENT_METHOD_KEY]))
        setStandaloneAmsPreviewBadgeEnabled(
          parseStandaloneAmsPreviewBadgeEnabled(
            result[STANDALONE_AMS_PREVIEW_BADGE_KEY]
          )
        )
        setDisableCache(parseDisableCache(result[DISABLE_CACHE_KEY]))
        setShowCdpStatus(parseShowCdpStatus(result[SHOW_CDP_STATUS_KEY]))
        setBelowIframeFullWidth(
          parseBelowIframeFullWidth(result[BELOW_IFRAME_FULL_WIDTH_KEY])
        )
        setSnapshotsEnabled(parseEnableSnapshots(result[ENABLE_SNAPSHOTS_KEY]))
        setWaterfallEnabled(parseShowWaterfall(result[SHOW_WATERFALL_KEY]))
        setFocusOffendersEnabled(parseFocusOffenders(result[FOCUS_OFFENDERS_KEY]))
        setAlertsEnabled(parseShowAlerts(result[SHOW_ALERTS_KEY]))

        const parsedLimitMetric = parseLimitMetric(result[LIMIT_METRIC_KEY])
        const parsedLimitBytes = parseLimitBytes(result[LIMIT_BYTES_KEY])
        setLimitMetric(parsedLimitMetric)
        setLimitBytes(parsedLimitBytes)
        setLimitMbInput(formatLimitMb(parsedLimitBytes))
      }
    )
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const applyTheme = () => setIsDarkTheme(mediaQuery.matches)
    applyTheme()

    const onChange = (event: MediaQueryListEvent) => {
      setIsDarkTheme(event.matches)
    }

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", onChange)
      return () => mediaQuery.removeEventListener("change", onChange)
    }

    mediaQuery.addListener(onChange)
    return () => mediaQuery.removeListener(onChange)
  }, [])

  const onSelectDisplayMode = (nextMode: DisplayMode) => {
    setMode(nextMode)
    chrome.storage.sync.set({ [DISPLAY_MODE_KEY]: nextMode })
  }

  const onSelectMeasurementMethod = (nextMethod: MeasurementMethod) => {
    setMeasurementMethod(nextMethod)
    chrome.storage.sync.set({ [MEASUREMENT_METHOD_KEY]: nextMethod })
  }

  const onSelectLimitMetric = (nextLimitMetric: LimitMetric) => {
    setLimitMetric(nextLimitMetric)
    chrome.storage.sync.set({ [LIMIT_METRIC_KEY]: nextLimitMetric })
  }

  const onSelectLimitPreset = (presetBytes: number) => {
    setLimitBytes(presetBytes)
    setLimitMbInput(formatLimitMb(presetBytes))
    chrome.storage.sync.set({ [LIMIT_BYTES_KEY]: presetBytes })
  }

  const persistLimitMb = () => {
    const parsedMb = Number.parseFloat(limitMbInput.replace(",", "."))
    if (!Number.isFinite(parsedMb) || parsedMb <= 0) {
      setLimitMbInput(formatLimitMb(limitBytes))
      return
    }

    const nextLimitBytes = Math.max(1, Math.round(parsedMb * 1024 * 1024))
    setLimitBytes(nextLimitBytes)
    setLimitMbInput(formatLimitMb(nextLimitBytes))
    chrome.storage.sync.set({ [LIMIT_BYTES_KEY]: nextLimitBytes })
  }

  const onToggleStandaloneAmsPreviewBadge = () => {
    const nextValue = !standaloneAmsPreviewBadgeEnabled
    setStandaloneAmsPreviewBadgeEnabled(nextValue)
    chrome.storage.sync.set({ [STANDALONE_AMS_PREVIEW_BADGE_KEY]: nextValue })
  }

  const onToggleDisableCache = () => {
    const nextValue = !disableCache
    setDisableCache(nextValue)
    chrome.storage.sync.set({ [DISABLE_CACHE_KEY]: nextValue })
  }

  const onToggleShowCdpStatus = () => {
    const nextValue = !showCdpStatus
    setShowCdpStatus(nextValue)
    chrome.storage.sync.set({ [SHOW_CDP_STATUS_KEY]: nextValue })
  }

  const onToggleBelowIframeFullWidth = () => {
    const nextValue = !belowIframeFullWidth
    setBelowIframeFullWidth(nextValue)
    chrome.storage.sync.set({ [BELOW_IFRAME_FULL_WIDTH_KEY]: nextValue })
  }

  const onToggleSnapshotsEnabled = () => {
    const nextValue = !snapshotsEnabled
    setSnapshotsEnabled(nextValue)
    chrome.storage.sync.set({ [ENABLE_SNAPSHOTS_KEY]: nextValue })
  }

  const onToggleWaterfallEnabled = () => {
    const nextValue = !waterfallEnabled
    setWaterfallEnabled(nextValue)
    chrome.storage.sync.set({ [SHOW_WATERFALL_KEY]: nextValue })
  }

  const onToggleFocusOffendersEnabled = () => {
    const nextValue = !focusOffendersEnabled
    setFocusOffendersEnabled(nextValue)
    chrome.storage.sync.set({ [FOCUS_OFFENDERS_KEY]: nextValue })
  }

  const onToggleAlertsEnabled = () => {
    const nextValue = !alertsEnabled
    setAlertsEnabled(nextValue)
    chrome.storage.sync.set({ [SHOW_ALERTS_KEY]: nextValue })
  }

  const openSetupGuide = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("tabs/welcome.html") })
  }

  useEffect(() => {
    if (!showCdpStatus) {
      setCdpStatus("idle")
      setCdpStatusReason("")
      return
    }

    let disposed = false
    const applyStatus = (status: CdpStatus, reason = "") => {
      if (disposed) {
        return
      }

      setCdpStatus(status)
      setCdpStatusReason(reason)
    }

    const refresh = () => {
      if (measurementMethod !== "enhanced_cdp") {
        applyStatus(
          "fallback",
          "Legacy measurement mode is selected in popup settings."
        )
        return
      }

      setCdpStatus("loading")
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id
        if (typeof tabId !== "number") {
          applyStatus("fallback", "No active tab selected.")
          return
        }

        chrome.runtime.sendMessage(
          {
            tabId,
            type: "ad-auditor/get-cdp-status"
          },
          (response) => {
            if (chrome.runtime.lastError) {
              applyStatus(
                "error",
                chrome.runtime.lastError.message || "Unable to read CDP status."
              )
              return
            }

            const nextStatus = response?.status as CdpStatus | undefined
            if (
              nextStatus !== "attached" &&
              nextStatus !== "fallback" &&
              nextStatus !== "error"
            ) {
              applyStatus("error", "Unexpected CDP status response.")
              return
            }

            applyStatus(nextStatus, typeof response?.reason === "string" ? response.reason : "")
          }
        )
      })
    }

    refresh()
    const refreshTimerId = window.setInterval(refresh, 2000)

    return () => {
      disposed = true
      window.clearInterval(refreshTimerId)
    }
  }, [showCdpStatus, measurementMethod])

  const theme = useMemo(
    () =>
      isDarkTheme
        ? {
            background: "#2a2f3a",
            surface: "#313745",
            text: "#f3f5f9",
            textMuted: "#b5bdcd",
            shadowLight: "rgba(255, 255, 255, 0.05)",
            shadowDark: "rgba(15, 18, 24, 0.6)",
            accent: "#7dff6a"
          }
        : {
            background: "#e8edf7",
            surface: "#e8edf7",
            text: "#1f2937",
            textMuted: "#4b5563",
            shadowLight: "rgba(255, 255, 255, 0.95)",
            shadowDark: "rgba(154, 170, 207, 0.6)",
            accent: "#0f7f5f"
          },
    [isDarkTheme]
  )

  const cdpStatusUi = useMemo(() => {
    if (cdpStatus === "attached") {
      return {
        color: "#34d399",
        label: "Attached"
      }
    }

    if (cdpStatus === "fallback") {
      return {
        color: "#f59e0b",
        label: "Fallback"
      }
    }

    if (cdpStatus === "error") {
      return {
        color: "#ef4444",
        label: "Error"
      }
    }

    if (cdpStatus === "loading") {
      return {
        color: theme.textMuted,
        label: "Checking..."
      }
    }

    return {
      color: theme.textMuted,
      label: "Disabled"
    }
  }, [cdpStatus, theme.textMuted])

  const activeLimitPreset = useMemo(
    () => LIMIT_PRESETS.find((preset) => preset.bytes === limitBytes)?.key ?? null,
    [limitBytes]
  )

  useEffect(() => {
    document.body.style.margin = "0"
    document.body.style.background = theme.background
  }, [theme.background])

  const cardBaseStyle = {
    display: "flex",
    gap: 10,
    width: "100%",
    padding: 10,
    borderRadius: 12,
    background: theme.surface,
    color: theme.text,
    alignItems: "flex-start",
    cursor: "pointer",
    textAlign: "left" as const
  }
  const sectionCardStyle = {
    borderRadius: 14,
    padding: 12,
    background: theme.surface,
    boxShadow: `inset 4px 4px 10px ${theme.shadowDark}, inset -4px -4px 10px ${theme.shadowLight}`
  }
  const sectionTitleStyle = {
    margin: "0 0 8px",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.2,
    color: theme.textMuted
  }

  const renderToggleCard = (
    value: boolean,
    onToggle: () => void,
    title: string,
    description: string
  ) => (
    <button
      aria-pressed={value}
      onClick={onToggle}
      style={{
        display: "flex",
        width: "100%",
        marginTop: 10,
        border: `1px solid ${value ? theme.accent : "transparent"}`,
        borderRadius: 12,
        padding: "10px 12px",
        background: theme.surface,
        color: theme.text,
        cursor: "pointer",
        textAlign: "left",
        boxShadow: value
          ? `inset 6px 6px 12px ${theme.shadowDark}, inset -6px -6px 12px ${theme.shadowLight}`
          : `6px 6px 12px ${theme.shadowDark}, -6px -6px 12px ${theme.shadowLight}`
      }}
      type="button">
      <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
        <span style={{ fontSize: 12, color: theme.textMuted }}>{description}</span>
      </span>
      <span
        style={{
          marginLeft: "auto",
          width: 44,
          height: 24,
          borderRadius: 999,
          background: value ? theme.accent : theme.background,
          boxShadow: `inset 2px 2px 4px ${theme.shadowDark}, inset -2px -2px 4px ${theme.shadowLight}`,
          position: "relative",
          flexShrink: 0
        }}>
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: theme.surface,
            boxShadow: `2px 2px 4px ${theme.shadowDark}, -2px -2px 4px ${theme.shadowLight}`,
            position: "absolute",
            top: 3,
            left: value ? 23 : 3,
            transition: "left 120ms ease-out"
          }}
        />
      </span>
    </button>
  )

  const renderOptionCards = <T extends string>(
    options: Array<{
      value: T
      label: string
      description: string
      badge: string
    }>,
    selectedValue: T,
    onSelect: (value: T) => void,
    ariaLabel: string
  ) => (
    <div
      aria-label={ariaLabel}
      role="radiogroup"
      style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {options.map((option) => {
        const selected = selectedValue === option.value

        return (
          <button
            aria-checked={selected}
            aria-label={option.label}
            key={option.value}
            onClick={() => onSelect(option.value)}
            role="radio"
            type="button"
            style={{
              ...cardBaseStyle,
              border: selected ? `1px solid ${theme.accent}` : "1px solid transparent",
              boxShadow: selected
                ? `inset 6px 6px 12px ${theme.shadowDark}, inset -6px -6px 12px ${theme.shadowLight}`
                : `6px 6px 12px ${theme.shadowDark}, -6px -6px 12px ${theme.shadowLight}`
            }}>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                flexShrink: 0,
                fontSize: 11,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: selected ? theme.surface : theme.textMuted,
                background: selected ? theme.accent : theme.background,
                boxShadow: selected
                  ? `inset 2px 2px 4px ${theme.shadowDark}, inset -2px -2px 4px ${theme.shadowLight}`
                  : `2px 2px 5px ${theme.shadowDark}, -2px -2px 5px ${theme.shadowLight}`
              }}>
              {option.badge}
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{option.label}</span>
              <span style={{ fontSize: 12, color: theme.textMuted }}>
                {option.description}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )

  return (
    <main
      style={{
        width: 380,
        padding: 16,
        fontFamily: "Segoe UI, Tahoma, sans-serif",
        color: theme.text,
        background: theme.background
      }}>
      <section
        style={{
          borderRadius: 18,
          padding: 14,
          background: theme.surface,
          boxShadow: `8px 8px 18px ${theme.shadowDark}, -8px -8px 18px ${theme.shadowLight}`
        }}>
        <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Ad Auditor</h1>
        <p style={{ margin: "8px 0 12px", fontSize: 12, color: theme.textMuted }}>
          Your assistant for auditing requests and creative resources. 🔎
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <section style={sectionCardStyle}>
            <p style={sectionTitleStyle}>Placement & Layout</p>
            {renderOptionCards(
              DISPLAY_OPTIONS,
              mode,
              onSelectDisplayMode,
              "Display mode"
            )}
            {renderToggleCard(
              belowIframeFullWidth,
              onToggleBelowIframeFullWidth,
              "Below iframe bar: full page width",
              "If enabled, status bar uses `width: 100%` instead of iframe width."
            )}
            {renderToggleCard(
              standaloneAmsPreviewBadgeEnabled,
              onToggleStandaloneAmsPreviewBadge,
              "Show stats on standalone AMS preview tab",
              "URL: `ams.creativecdn.com/ad/creatives?preview=true...`"
            )}
          </section>

          <section style={sectionCardStyle}>
            <p style={sectionTitleStyle}>Measurement & Diagnostics</p>
            {renderOptionCards(
              MEASUREMENT_OPTIONS,
              measurementMethod,
              onSelectMeasurementMethod,
              "Measurement engine"
            )}
            {renderToggleCard(
              disableCache,
              onToggleDisableCache,
              "Disable cache on preview domains",
              "Applies to `creatives-preview.rtbhouse.com` and `ams.creativecdn.com`."
            )}
            {renderToggleCard(
              showCdpStatus,
              onToggleShowCdpStatus,
              "Show CDP status",
              "Adds a live CDP attached/fallback/error status panel."
            )}
            {renderToggleCard(
              snapshotsEnabled,
              onToggleSnapshotsEnabled,
              "Enable snapshots & compare",
              "Adds Save/Compare controls in request details."
            )}
            {renderToggleCard(
              waterfallEnabled,
              onToggleWaterfallEnabled,
              "Show waterfall lite",
              "Shows top request bars by transferred size."
            )}
            {renderToggleCard(
              focusOffendersEnabled,
              onToggleFocusOffendersEnabled,
              "Focus offenders first",
              "Highlights heavy or pending requests in the list."
            )}
            {renderToggleCard(
              alertsEnabled,
              onToggleAlertsEnabled,
              "Show alerts",
              "Adds actionable audit warnings below the status bar."
            )}

            {showCdpStatus ? (
              <div
                style={{
                  marginTop: 10,
                  borderRadius: 12,
                  padding: "10px 12px",
                  border: `1px solid ${theme.accent}`,
                  background: theme.surface,
                  boxShadow: `inset 4px 4px 8px ${theme.shadowDark}, inset -4px -4px 8px ${theme.shadowLight}`
                }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
                  CDP status:{" "}
                  <span style={{ color: cdpStatusUi.color }}>{cdpStatusUi.label}</span>
                </p>
                {cdpStatusReason ? (
                  <p
                    style={{ margin: "6px 0 0", fontSize: 12, color: theme.textMuted }}>
                    {cdpStatusReason}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          <section style={sectionCardStyle}>
            <p style={sectionTitleStyle}>Thresholds</p>
            {renderOptionCards(
              LIMIT_METRIC_OPTIONS,
              limitMetric,
              onSelectLimitMetric,
              "Limit metric"
            )}

            <p style={{ margin: "12px 0 8px", fontSize: 12, color: theme.textMuted }}>
              Limit presets
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {LIMIT_PRESETS.map((preset) => {
                const selected = activeLimitPreset === preset.key

                return (
                  <button
                    key={preset.key}
                    onClick={() => onSelectLimitPreset(preset.bytes)}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 2,
                      border: selected
                        ? `1px solid ${theme.accent}`
                        : "1px solid transparent",
                      borderRadius: 10,
                      padding: "8px 6px",
                      background: theme.surface,
                      color: theme.text,
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: selected ? 700 : 600,
                      boxShadow: selected
                        ? `inset 4px 4px 8px ${theme.shadowDark}, inset -4px -4px 8px ${theme.shadowLight}`
                        : `4px 4px 8px ${theme.shadowDark}, -4px -4px 8px ${theme.shadowLight}`
                    }}
                    type="button">
                    <span>{preset.label}</span>
                    <span
                      style={{ fontSize: 10, fontWeight: 500, color: theme.textMuted }}>
                      {preset.valueLabel}
                    </span>
                  </button>
                )
              })}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginTop: 10,
                borderRadius: 12,
                padding: "10px 12px",
                background: theme.surface,
                border: "1px solid transparent",
                boxShadow: `6px 6px 12px ${theme.shadowDark}, -6px -6px 12px ${theme.shadowLight}`
              }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Custom limit (MB)</span>
              <input
                inputMode="decimal"
                onBlur={persistLimitMb}
                onChange={(event) => setLimitMbInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    persistLimitMb()
                    event.currentTarget.blur()
                  }
                }}
                style={{
                  marginLeft: "auto",
                  width: 90,
                  borderRadius: 8,
                  border: `1px solid ${theme.accent}`,
                  background: theme.background,
                  color: theme.text,
                  padding: "6px 8px",
                  fontSize: 12
                }}
                type="text"
                value={limitMbInput}
              />
            </div>
          </section>

          <section style={sectionCardStyle}>
            <p style={sectionTitleStyle}>Help</p>
            <button
              onClick={openSetupGuide}
              style={{
                width: "100%",
                border: `1px solid ${theme.accent}`,
                borderRadius: 12,
                padding: "10px 12px",
                background: theme.background,
                color: theme.text,
                cursor: "pointer",
                textAlign: "center",
                fontSize: 13,
                fontWeight: 600,
                boxShadow: `6px 6px 12px ${theme.shadowDark}, -6px -6px 12px ${theme.shadowLight}`
              }}
              type="button">
              Open setup guide
            </button>
          </section>
        </div>
      </section>
    </main>
  )
}

export default IndexPopup

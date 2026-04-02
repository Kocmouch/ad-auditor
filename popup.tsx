import { useEffect, useMemo, useState } from "react"

import {
  DEFAULT_DISABLE_CACHE,
  DEFAULT_LIMIT_BYTES,
  DEFAULT_LIMIT_METRIC,
  DEFAULT_MEASUREMENT_METHOD,
  DEFAULT_STANDALONE_AMS_PREVIEW_BADGE_ENABLED,
  DEFAULT_DISPLAY_MODE,
  DISABLE_CACHE_KEY,
  DISPLAY_MODE_KEY,
  LIMIT_BYTES_KEY,
  LIMIT_METRIC_KEY,
  MEASUREMENT_METHOD_KEY,
  STANDALONE_AMS_PREVIEW_BADGE_KEY,
  type DisplayMode,
  type LimitMetric,
  type MeasurementMethod,
  parseDisplayMode,
  parseDisableCache,
  parseLimitBytes,
  parseLimitMetric,
  parseMeasurementMethod,
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

function IndexPopup() {
  const [mode, setMode] = useState<DisplayMode>(DEFAULT_DISPLAY_MODE)
  const [isDarkTheme, setIsDarkTheme] = useState(false)
  const [measurementMethod, setMeasurementMethod] = useState<MeasurementMethod>(
    DEFAULT_MEASUREMENT_METHOD
  )
  const [standaloneAmsPreviewBadgeEnabled, setStandaloneAmsPreviewBadgeEnabled] =
    useState<boolean>(DEFAULT_STANDALONE_AMS_PREVIEW_BADGE_ENABLED)
  const [disableCache, setDisableCache] = useState<boolean>(DEFAULT_DISABLE_CACHE)
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
        width: 360,
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
        <p style={{ margin: "8px 0 4px", fontSize: 12, color: theme.textMuted }}>
          Browser theme: {isDarkTheme ? "Dark" : "Light"} (auto)
        </p>

        <p style={{ margin: "10px 0 8px", fontSize: 12, color: theme.textMuted }}>
          Display mode
        </p>
        {renderOptionCards(
          DISPLAY_OPTIONS,
          mode,
          onSelectDisplayMode,
          "Display mode"
        )}

        <p style={{ margin: "14px 0 8px", fontSize: 12, color: theme.textMuted }}>
          Measurement engine
        </p>
        {renderOptionCards(
          MEASUREMENT_OPTIONS,
          measurementMethod,
          onSelectMeasurementMethod,
          "Measurement engine"
        )}

        <p style={{ margin: "14px 0 8px", fontSize: 12, color: theme.textMuted }}>
          Limit coloring
        </p>
        {renderOptionCards(
          LIMIT_METRIC_OPTIONS,
          limitMetric,
          onSelectLimitMetric,
          "Limit metric"
        )}

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
          <span style={{ fontSize: 13, fontWeight: 600 }}>Limit threshold (MB)</span>
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

        <button
          aria-pressed={disableCache}
          onClick={onToggleDisableCache}
          style={{
            display: "flex",
            width: "100%",
            marginTop: 12,
            border: `1px solid ${disableCache ? theme.accent : "transparent"}`,
            borderRadius: 12,
            padding: "10px 12px",
            background: theme.surface,
            color: theme.text,
            cursor: "pointer",
            textAlign: "left",
            boxShadow: disableCache
              ? `inset 6px 6px 12px ${theme.shadowDark}, inset -6px -6px 12px ${theme.shadowLight}`
              : `6px 6px 12px ${theme.shadowDark}, -6px -6px 12px ${theme.shadowLight}`
          }}
          type="button">
          <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              Disable cache on preview domains
            </span>
            <span style={{ fontSize: 12, color: theme.textMuted }}>
              Applies to `creatives-preview.rtbhouse.com` and `ams.creativecdn.com`.
            </span>
          </span>
          <span
            style={{
              marginLeft: "auto",
              width: 44,
              height: 24,
              borderRadius: 999,
              background: disableCache ? theme.accent : theme.background,
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
                left: disableCache ? 23 : 3,
                transition: "left 120ms ease-out"
              }}
            />
          </span>
        </button>

        <button
          aria-pressed={standaloneAmsPreviewBadgeEnabled}
          onClick={onToggleStandaloneAmsPreviewBadge}
          style={{
            display: "flex",
            width: "100%",
            marginTop: 12,
            border: `1px solid ${standaloneAmsPreviewBadgeEnabled ? theme.accent : "transparent"}`,
            borderRadius: 12,
            padding: "10px 12px",
            background: theme.surface,
            color: theme.text,
            cursor: "pointer",
            textAlign: "left",
            boxShadow: standaloneAmsPreviewBadgeEnabled
              ? `inset 6px 6px 12px ${theme.shadowDark}, inset -6px -6px 12px ${theme.shadowLight}`
              : `6px 6px 12px ${theme.shadowDark}, -6px -6px 12px ${theme.shadowLight}`
          }}
          type="button">
          <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              Show stats on standalone AMS preview tab
            </span>
            <span style={{ fontSize: 12, color: theme.textMuted }}>
              URL: `ams.creativecdn.com/ad/creatives?preview=true...`
            </span>
          </span>
          <span
            style={{
              marginLeft: "auto",
              width: 44,
              height: 24,
              borderRadius: 999,
              background: standaloneAmsPreviewBadgeEnabled ? theme.accent : theme.background,
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
                left: standaloneAmsPreviewBadgeEnabled ? 23 : 3,
                transition: "left 120ms ease-out"
              }}
            />
          </span>
        </button>
      </section>
      <p style={{ margin: "10px 2px 0", fontSize: 11, color: theme.textMuted }}>
        Neomorphic UI follows browser light/dark preference automatically.
      </p>
    </main>
  )
}

export default IndexPopup

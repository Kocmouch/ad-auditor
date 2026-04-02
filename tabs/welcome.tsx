import { useEffect, useMemo, useState, type CSSProperties } from "react"
import {
  BELOW_IFRAME_FULL_WIDTH_KEY,
  CURRENT_SETTINGS_VERSION,
  DEFAULT_BELOW_IFRAME_FULL_WIDTH,
  DEFAULT_DISABLE_CACHE,
  DEFAULT_DISPLAY_MODE,
  DEFAULT_ENABLE_SNAPSHOTS,
  DEFAULT_FOCUS_OFFENDERS,
  DEFAULT_MEASUREMENT_METHOD,
  DEFAULT_SHOW_CDP_STATUS,
  DEFAULT_SHOW_WATERFALL,
  DISABLE_CACHE_KEY,
  DISPLAY_MODE_KEY,
  ENABLE_SNAPSHOTS_KEY,
  FOCUS_OFFENDERS_KEY,
  MEASUREMENT_METHOD_KEY,
  SETTINGS_VERSION_KEY,
  SHOW_CDP_STATUS_KEY,
  SHOW_WATERFALL_KEY
} from "~lib/display-mode"

const SUPPORT_EMAIL = "jakub.kaminski@rtbhouse.com"
const SUPPORT_SLACK = "RTB House Slack"

const headingStyle: CSSProperties = {
  margin: "0 0 10px",
  fontSize: 18
}

function WelcomePage() {
  const [isDarkTheme, setIsDarkTheme] = useState(false)
  const [defaultsApplied, setDefaultsApplied] = useState(false)
  const [popupOpened, setPopupOpened] = useState(false)

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

  const theme = useMemo(
    () =>
      isDarkTheme
        ? {
            body: "#121721",
            card: "#1b2432",
            border: "#2a3648",
            text: "#f3f5f9",
            muted: "#b5bdcd"
          }
        : {
            body: "#f4f6fa",
            card: "#ffffff",
            border: "#d7deea",
            text: "#1f2937",
            muted: "#4b5563"
          },
    [isDarkTheme]
  )

  useEffect(() => {
    document.body.style.margin = "0"
    document.body.style.background = theme.body
  }, [theme.body])

  const cardStyle: CSSProperties = {
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
    padding: 16,
    background: theme.card
  }
  const supportLinkStyle: CSSProperties = {
    color: isDarkTheme ? "#ffffff" : "#0f7f5f"
  }
  const actionButtonStyle: CSSProperties = {
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    padding: "8px 10px",
    background: theme.card,
    color: theme.text,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600
  }

  const applyRecommendedDefaults = () => {
    chrome.storage.sync.set({
      [DISPLAY_MODE_KEY]: DEFAULT_DISPLAY_MODE,
      [MEASUREMENT_METHOD_KEY]: DEFAULT_MEASUREMENT_METHOD,
      [DISABLE_CACHE_KEY]: DEFAULT_DISABLE_CACHE,
      [SHOW_CDP_STATUS_KEY]: DEFAULT_SHOW_CDP_STATUS,
      [BELOW_IFRAME_FULL_WIDTH_KEY]: DEFAULT_BELOW_IFRAME_FULL_WIDTH,
      [ENABLE_SNAPSHOTS_KEY]: DEFAULT_ENABLE_SNAPSHOTS,
      [SHOW_WATERFALL_KEY]: DEFAULT_SHOW_WATERFALL,
      [FOCUS_OFFENDERS_KEY]: DEFAULT_FOCUS_OFFENDERS,
      [SETTINGS_VERSION_KEY]: CURRENT_SETTINGS_VERSION
    })
    setDefaultsApplied(true)
  }

  const openPopupPage = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL("popup.html")
    })
    setPopupOpened(true)
  }

  return (
    <main
      style={{
        maxWidth: 860,
        margin: "24px auto",
        padding: 16,
        fontFamily: "Segoe UI, Tahoma, sans-serif",
        color: theme.text,
        lineHeight: 1.45
      }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 30 }}>Welcome to Ad Auditor</h1>
        <p style={{ margin: "8px 0 0", color: theme.muted }}>
          Audit ad iframe network weight directly on preview pages.
        </p>
      </header>

      <section style={cardStyle}>
        <h2 style={headingStyle}>Quick Start</h2>
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          <li>Open a supported preview domain with ad iframes.</li>
          <li>
            Click the extension icon and keep defaults:
            <strong> Enhanced (CDP)</strong> and
            <strong> Disable cache</strong>.
          </li>
          <li>Choose overlay mode and optional usage threshold.</li>
          <li>
            Inspect the badge values:
            <code> Transferred / Resources</code>.
          </li>
          <li>Click the in-frame `Open` button to inspect the iframe URL.</li>
        </ol>
      </section>

      <section style={{ ...cardStyle, marginTop: 12 }}>
        <h2 style={headingStyle}>Use Cases</h2>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>Check if a single creative crosses internal size budgets.</li>
          <li>Compare `legacy` vs `CDP` numbers while debugging differences.</li>
          <li>Track pending vs completed requests per iframe creative.</li>
          <li>Validate AMS standalone preview behavior before handoff.</li>
        </ul>
      </section>

      <section style={{ ...cardStyle, marginTop: 12 }}>
        <h2 style={headingStyle}>Supported Domains</h2>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>
            <code>https://creatives-preview.rtbhouse.com/*</code>
          </li>
          <li>
            <code>https://statics.creativecdn.com/*</code>
          </li>
          <li>
            <code>https://ams.creativecdn.com/*</code>
          </li>
        </ul>
      </section>

      <section style={{ ...cardStyle, marginTop: 12 }}>
        <h2 style={headingStyle}>Interactive Onboarding</h2>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input checked readOnly type="checkbox" />
              Welcome page opened
            </label>
          </li>
          <li>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input checked={defaultsApplied} readOnly type="checkbox" />
              Recommended defaults applied
            </label>
          </li>
          <li>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input checked={popupOpened} readOnly type="checkbox" />
              Popup opened in a tab
            </label>
          </li>
        </ul>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={applyRecommendedDefaults} style={actionButtonStyle} type="button">
            Apply recommended defaults
          </button>
          <button onClick={openPopupPage} style={actionButtonStyle} type="button">
            Open popup page
          </button>
        </div>
      </section>

      <section style={{ ...cardStyle, marginTop: 12 }}>
        <h2 style={headingStyle}>Tips</h2>
        <p style={{ margin: 0 }}>
          CDP mode is the closest to DevTools network accounting. If numbers look
          lower than expected, check if requests came from cache before enabling
          cache disabling in popup settings.
        </p>
      </section>

      <footer style={{ marginTop: 14, color: theme.muted, fontSize: 14 }}>
        Need help? Contact{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} style={supportLinkStyle}>
          {SUPPORT_EMAIL}
        </a>{" "}
        or write on Slack ({SUPPORT_SLACK}).
      </footer>
    </main>
  )
}

export default WelcomePage

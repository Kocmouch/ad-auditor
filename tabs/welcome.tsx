import { useEffect, useMemo, useState, type CSSProperties } from "react"

const SUPPORT_EMAIL = "jakub.kaminski@rtbhouse.com"
const SUPPORT_SLACK = "RTB House Slack"

const headingStyle: CSSProperties = {
  margin: "0 0 10px",
  fontSize: 18
}

function WelcomePage() {
  const [isDarkTheme, setIsDarkTheme] = useState(false)

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

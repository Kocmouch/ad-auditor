import {
  CHECK_LABELS,
  formatAuditReportMarkdown,
  formatOutcome,
  getRowStatusLabel,
  type AuditReportRow
} from "~lib/audit-report"
import { CHECK_NAMES, type CheckSeverity } from "~lib/audit-summary"
import { SEVERITY_COLORS } from "~lib/ui/highlight"
import { Z_INDEX, type Theme } from "~lib/ui/theme"

export type AuditReportPanelOptions = {
  pageUrl?: string
  /** Defaults to navigator.clipboard.writeText. */
  copyText?: (text: string) => Promise<void>
  onClose?: () => void
}

const severityColor = (severity: CheckSeverity | undefined, theme: Theme) => {
  switch (severity) {
    case "error":
      return SEVERITY_COLORS.error.color
    case "warning":
      return SEVERITY_COLORS.warning.color
    case "info":
    case "ok":
      return theme.accent
    default:
      return theme.textMuted
  }
}

const OVERALL_COLORS: Record<string, string> = {
  error: SEVERITY_COLORS.error.color,
  ok: "#7dff6a",
  warning: SEVERITY_COLORS.warning.color
}

const cell = (tag: "td" | "th", text: string, color?: string) => {
  const element = document.createElement(tag)
  element.textContent = text
  element.style.padding = "4px 8px"
  element.style.textAlign = "left"
  element.style.whiteSpace = "nowrap"
  if (color) {
    element.style.color = color
  }
  return element
}

/** Floating "Audit all" trigger, pinned to the bottom-left of the page. */
export const createAuditAllButton = (): HTMLButtonElement => {
  const button = document.createElement("button")
  button.type = "button"
  button.id = "ad-auditor-audit-all"
  button.textContent = "Audit all"
  button.setAttribute(
    "style",
    [
      "position: fixed",
      "left: 12px",
      "bottom: 12px",
      `z-index: ${Z_INDEX.auditAllButton}`,
      "border: 1px solid #7dff6a",
      "background: rgba(0, 0, 0, 0.85)",
      "color: #7dff6a",
      "border-radius: 4px",
      "padding: 6px 12px",
      "font: 600 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      "cursor: pointer"
    ].join(";")
  )
  return button
}

/** Aggregate "Audit all" table with a Copy report (Markdown) button. */
export const createAuditReportPanel = (
  rows: AuditReportRow[],
  theme: Theme,
  options: AuditReportPanelOptions = {}
): HTMLDivElement => {
  // Full-viewport backdrop so nothing on the page shows through or is clickable.
  const backdrop = document.createElement("div")
  backdrop.id = "ad-auditor-audit-report"
  backdrop.setAttribute(
    "style",
    [
      "position: fixed",
      "top: 0",
      "right: 0",
      "bottom: 0",
      "left: 0",
      "display: flex",
      "align-items: center",
      "justify-content: center",
      "background: rgba(0, 0, 0, 0.55)",
      `z-index: ${Z_INDEX.modalBackdrop}`
    ].join(";")
  )
  const panel = document.createElement("div")
  backdrop.appendChild(panel)
  panel.setAttribute(
    "style",
    [
      "position: relative",
      `background: ${theme.background}`,
      "border-radius: 8px",
      `box-shadow: 0 8px 32px ${theme.shadowDark}, inset 0 1px 0 ${theme.shadowLight}`,
      "padding: 16px",
      "max-width: calc(100vw - 40px)",
      "max-height: 80vh",
      "overflow: auto",
      "box-sizing: border-box",
      `z-index: ${Z_INDEX.modal}`,
      `color: ${theme.text}`,
      "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      "font-size: 13px",
      "line-height: 1.5"
    ].join(";")
  )

  const header = document.createElement("div")
  header.setAttribute(
    "style",
    "display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:12px"
  )
  const title = document.createElement("h2")
  title.textContent = `Audit results (${rows.length} creative${rows.length === 1 ? "" : "s"})`
  title.setAttribute("style", "margin:0;font-size:16px;font-weight:600")

  const actions = document.createElement("div")
  actions.style.cssText = "display:flex;gap:8px;align-items:center"
  const copyButton = document.createElement("button")
  copyButton.type = "button"
  copyButton.textContent = "Copy report"
  copyButton.setAttribute(
    "style",
    `border:1px solid ${theme.accent};background:transparent;color:${theme.accent};border-radius:4px;padding:4px 10px;font-size:12px;cursor:pointer`
  )
  copyButton.addEventListener("click", () => {
    const markdown = formatAuditReportMarkdown(rows, {
      generatedAt: new Date(),
      pageUrl: options.pageUrl
    })
    const copy =
      options.copyText ?? ((text) => navigator.clipboard.writeText(text))
    copy(markdown).then(
      () => {
        copyButton.textContent = "Copied"
      },
      () => {
        copyButton.textContent = "Copy failed"
      }
    )
  })

  const closeButton = document.createElement("button")
  closeButton.type = "button"
  closeButton.textContent = "✕"
  closeButton.setAttribute(
    "style",
    `background:transparent;border:none;color:${theme.textMuted};font-size:20px;cursor:pointer;padding:0 4px`
  )
  closeButton.addEventListener("click", () => {
    backdrop.remove()
    options.onClose?.()
  })
  actions.append(copyButton, closeButton)
  header.append(title, actions)
  panel.appendChild(header)

  if (rows.length === 0) {
    const empty = document.createElement("div")
    empty.textContent = "No creatives were audited."
    empty.style.color = theme.textMuted
    panel.appendChild(empty)
    return backdrop
  }

  const table = document.createElement("table")
  table.style.borderCollapse = "collapse"
  table.style.width = "100%"
  const headRow = document.createElement("tr")
  for (const label of [
    "Creative",
    "Size",
    ...CHECK_NAMES.map((name) => CHECK_LABELS[name]),
    "Overall"
  ]) {
    headRow.appendChild(cell("th", label, theme.textMuted))
  }
  const thead = document.createElement("thead")
  thead.appendChild(headRow)
  table.appendChild(thead)

  const tbody = document.createElement("tbody")
  for (const row of rows) {
    const tr = document.createElement("tr")
    tr.style.background = theme.surface
    tr.append(cell("td", row.id), cell("td", row.size))
    for (const name of CHECK_NAMES) {
      const outcome = row.checks[name]
      tr.appendChild(
        cell(
          "td",
          formatOutcome(outcome),
          severityColor(outcome?.severity, theme)
        )
      )
    }
    const overall = getRowStatusLabel(row)
    tr.appendChild(cell("td", overall, OVERALL_COLORS[overall]))
    tbody.appendChild(tr)
  }
  table.appendChild(tbody)
  panel.appendChild(table)

  return backdrop
}

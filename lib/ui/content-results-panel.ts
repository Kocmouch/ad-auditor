import type { WireContentIssue } from "~lib/messaging"
import { SEVERITY_COLORS, type HighlightSeverity } from "~lib/ui/highlight"
import { Z_INDEX, type Theme } from "~lib/ui/theme"

/** Issue shape shared by the content and quality panels (wire format). */
export type PanelIssue = {
  category: string
  severity: HighlightSeverity
  message: string
  /** Rows without an element are listed but not clickable. */
  hasElement?: true
}

export type PanelOptions = {
  id: string
  title: string
  emptyText: string
  /** CSS `right` offset; the quality panel sits left of the content panel. */
  right?: string
  /** Shown at the end of the summary strip, e.g. click coverage. */
  subtitle?: string
}

export type ContentPanelHandlers = {
  /** Called with the index of the clicked issue (position in `issues`). */
  onSelect: (index: number) => void
  /** Called after the user closes the panel. */
  onClose?: () => void
}

const SEVERITY_ORDER: HighlightSeverity[] = ["error", "warning", "info"]

const SEVERITY_TITLES: Record<HighlightSeverity, string> = {
  error: "Errors",
  info: "Info",
  warning: "Warnings"
}

const CATEGORY_LABELS: Record<string, string> = {
  animations: "Animation",
  clicks: "Click",
  images: "Image",
  links: "Link",
  structure: "Structure",
  template: "Template"
}

const createSummaryCount = (
  severity: HighlightSeverity,
  count: number,
  theme: Theme
): HTMLSpanElement => {
  const item = document.createElement("span")
  const label = document.createElement("span")
  label.style.color = theme.textMuted
  label.textContent = `${SEVERITY_TITLES[severity]}:`
  const value = document.createElement("strong")
  value.style.color = count > 0 ? SEVERITY_COLORS[severity].color : theme.accent
  value.textContent = String(count)
  item.append(label, " ", value)
  return item
}

const createIssueRow = (
  issue: PanelIssue,
  index: number,
  theme: Theme,
  onSelect: (index: number) => void
): HTMLElement => {
  const color = SEVERITY_COLORS[issue.severity].color
  const clickable = issue.hasElement === true
  const row = document.createElement(clickable ? "button" : "div")
  if (row instanceof HTMLButtonElement) {
    row.type = "button"
    row.title = "Scroll to element in the creative"
  }
  row.setAttribute("data-issue-index", String(index))
  row.setAttribute(
    "style",
    [
      "display: block",
      "width: 100%",
      "text-align: left",
      "padding: 8px 12px",
      `background: ${theme.surface}`,
      `color: ${theme.text}`,
      "border: none",
      `border-left: 3px solid ${color}`,
      "border-radius: 6px",
      "margin-bottom: 6px",
      "font: inherit",
      "font-size: 12px",
      "box-sizing: border-box",
      clickable ? "cursor: pointer" : "cursor: default"
    ].join(";")
  )

  const tag = document.createElement("span")
  tag.textContent = CATEGORY_LABELS[issue.category] ?? issue.category
  tag.setAttribute(
    "style",
    `color: ${color}; font-weight: 600; margin-right: 8px; font-size: 11px`
  )
  const message = document.createElement("span")
  message.textContent = issue.message
  message.style.wordBreak = "break-word"
  row.append(tag, message)

  if (clickable) {
    row.addEventListener("click", () => onSelect(index))
  }
  return row
}

/**
 * Shared results panel: severity sections of issue rows. Rows with an element
 * are clickable (the owner scrolls to/flashes the element); the rest are
 * informational (coverage, document-level problems).
 */
export const createIssuesPanel = (
  issues: PanelIssue[],
  theme: Theme,
  handlers: ContentPanelHandlers,
  options: PanelOptions
): HTMLDivElement => {
  const panel = document.createElement("div")
  panel.id = options.id
  panel.setAttribute(
    "style",
    [
      "position: fixed",
      // Docked top-right so the creative stays visible when rows are clicked.
      "top: 20px",
      `right: ${options.right ?? "20px"}`,
      `background: ${theme.background}`,
      "border-radius: 8px",
      `box-shadow: 0 8px 32px ${theme.shadowDark}, inset 0 1px 0 ${theme.shadowLight}`,
      "padding: 16px",
      "width: 420px",
      "max-width: calc(100vw - 40px)",
      "max-height: calc(100vh - 40px)",
      "overflow-y: auto",
      "box-sizing: border-box",
      `z-index: ${Z_INDEX.panel}`,
      `color: ${theme.text}`,
      "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      "font-size: 13px",
      "line-height: 1.5"
    ].join(";")
  )

  const header = document.createElement("div")
  header.setAttribute(
    "style",
    [
      "display: flex",
      "justify-content: space-between",
      "align-items: center",
      "margin-bottom: 12px",
      "padding-bottom: 12px",
      `border-bottom: 1px solid ${theme.surface}`
    ].join(";")
  )
  const title = document.createElement("h2")
  title.textContent = options.title
  title.setAttribute("style", "margin: 0; font-size: 16px; font-weight: 600")
  const closeButton = document.createElement("button")
  closeButton.type = "button"
  closeButton.textContent = "✕"
  closeButton.setAttribute(
    "style",
    [
      "background: transparent",
      "border: none",
      `color: ${theme.textMuted}`,
      "font-size: 20px",
      "cursor: pointer",
      "padding: 0",
      "width: 24px",
      "height: 24px"
    ].join(";")
  )
  closeButton.addEventListener("click", () => {
    panel.remove()
    handlers.onClose?.()
  })
  header.append(title, closeButton)
  panel.appendChild(header)

  const summary = document.createElement("div")
  summary.setAttribute(
    "style",
    [
      "margin-bottom: 16px",
      "padding: 12px",
      `background: ${theme.surface}`,
      "border-radius: 6px",
      "display: flex",
      "gap: 24px"
    ].join(";")
  )
  const countOf = (severity: HighlightSeverity) =>
    issues.filter((issue) => issue.severity === severity).length
  for (const severity of SEVERITY_ORDER) {
    summary.appendChild(createSummaryCount(severity, countOf(severity), theme))
  }
  if (options.subtitle) {
    const subtitle = document.createElement("strong")
    subtitle.textContent = options.subtitle
    subtitle.setAttribute("data-panel-subtitle", "true")
    subtitle.style.marginLeft = "auto"
    summary.appendChild(subtitle)
  }
  panel.appendChild(summary)

  if (issues.length === 0) {
    const empty = document.createElement("div")
    empty.textContent = options.emptyText
    empty.setAttribute(
      "style",
      `padding: 24px; text-align: center; color: ${theme.accent}; font-size: 14px`
    )
    panel.appendChild(empty)
    return panel
  }

  for (const severity of SEVERITY_ORDER) {
    const inGroup = issues
      .map((issue, index) => ({ index, issue }))
      .filter(({ issue }) => issue.severity === severity)
    if (inGroup.length === 0) {
      continue
    }

    const section = document.createElement("div")
    section.setAttribute("data-severity", severity)
    section.style.marginBottom = "16px"
    const heading = document.createElement("h3")
    heading.textContent = `${SEVERITY_TITLES[severity]} (${inGroup.length})`
    heading.setAttribute(
      "style",
      `margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: ${SEVERITY_COLORS[severity].color}`
    )
    section.appendChild(heading)
    for (const { index, issue } of inGroup) {
      section.appendChild(
        createIssueRow(issue, index, theme, handlers.onSelect)
      )
    }
    panel.appendChild(section)
  }

  return panel
}

/** Results panel for the image + link + template-leak ("Content") check. */
export const createContentResultsPanel = (
  issues: WireContentIssue[],
  theme: Theme,
  handlers: ContentPanelHandlers
): HTMLDivElement =>
  createIssuesPanel(issues, theme, handlers, {
    emptyText: "✓ No image, link or template issues detected",
    id: "ad-auditor-content-check-results",
    title: "Content Check Results"
  })

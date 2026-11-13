import {
  consoleOutcome,
  getOverallStatus,
  requestOutcome,
  withRequestOutcome,
  type CheckOutcomes,
  type OverallStatus
} from "~lib/audit-summary"
import type { ConsoleProblem } from "~lib/cdp/types"
import { filterConsoleProblems } from "~lib/features/console-problems"
import {
  findRequestProblems,
  type RequestRecord
} from "~lib/features/request-errors"
import type { Totals } from "~lib/features/snapshot"
import type { LimitMetric } from "~lib/types/settings"
import { SEVERITY_COLORS } from "~lib/ui/highlight"
import { createIcon, type IconName } from "~lib/ui/icons"
import { attachDynamicTooltip, attachTooltip } from "~lib/ui/tooltip"
import { getUsageColors } from "~lib/usage-display"

export const BADGE_FONT_FAMILY =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

export type ToolbarButtonOptions = {
  icon: IconName
  /** CSS margin-left value. */
  marginLeft?: string
  /** Adds `position: relative; z-index: 1` (standalone badge only). */
  raised?: boolean
  tooltip: string
}

/** Green outlined square icon button with tooltip. */
export const createToolbarButton = (
  options: ToolbarButtonOptions
): HTMLButtonElement => {
  const button = document.createElement("button")
  button.type = "button"
  button.appendChild(createIcon(options.icon))
  button.setAttribute(
    "style",
    [
      "border: 1px solid #7dff6a",
      "background: transparent",
      "color: #7dff6a",
      "border-radius: 4px",
      "padding: 4px",
      "font-size: 11px",
      "line-height: 0",
      "cursor: pointer",
      options.marginLeft ? `margin-left: ${options.marginLeft}` : "",
      options.raised ? "position: relative" : "",
      options.raised ? "z-index: 1" : "",
      "display: flex",
      "align-items: center",
      "justify-content: center"
    ]
      .filter(Boolean)
      .join(";")
  )
  attachTooltip(button, options.tooltip)
  return button
}

const STATUS_COLORS: Record<Exclude<OverallStatus, "none">, string> = {
  amber: SEVERITY_COLORS.warning.color,
  green: "#7dff6a",
  red: SEVERITY_COLORS.error.color
}

const STATUS_LABELS: Record<Exclude<OverallStatus, "none">, string> = {
  amber: "Audit: warnings found",
  green: "Audit: no errors or warnings",
  red: "Audit: errors found"
}

/** Request-problem indicator and overall audit status dot of a stats bar. */
export type StatusIndicators = {
  /** Red/amber "! N" shown when requests have problems. */
  requestIndicator: HTMLSpanElement
  /** Green/amber/red dot shown after checks have run. */
  statusDot: HTMLSpanElement
}

export const createStatusIndicators = (): StatusIndicators => {
  const requestIndicator = document.createElement("span")
  requestIndicator.setAttribute(
    "style",
    "display:none;font-weight:700;margin-left:6px;cursor:help"
  )
  const statusDot = document.createElement("span")
  statusDot.setAttribute(
    "style",
    [
      "display:none",
      "width:8px",
      "height:8px",
      "border-radius:50%",
      "margin-left:6px",
      "flex-shrink:0",
      "cursor:help"
    ].join(";")
  )
  statusDot.setAttribute("data-audit-status", "none")
  return { requestIndicator, statusDot }
}

/** Adds tooltips; call once after creating the indicators. */
export const attachStatusTooltips = (indicators: StatusIndicators) => {
  attachDynamicTooltip(
    indicators.requestIndicator,
    () => indicators.requestIndicator.getAttribute("data-summary") ?? ""
  )
  attachDynamicTooltip(
    indicators.statusDot,
    () => indicators.statusDot.getAttribute("data-summary") ?? ""
  )
}

/**
 * Recomputes both indicators from request items, console problems and the
 * checks run so far. The "! N" indicator counts request and console problems.
 */
export const updateStatusIndicators = (
  indicators: StatusIndicators,
  items: RequestRecord[],
  checks: CheckOutcomes,
  consoleProblems: ConsoleProblem[] = []
) => {
  const { problems, summary } = findRequestProblems(items)
  const visibleConsole = filterConsoleProblems(consoleProblems)
  const consoleErrors = visibleConsole.filter(
    (problem) => problem.severity === "error"
  ).length
  const { requestIndicator, statusDot } = indicators

  const total = problems.length + visibleConsole.length
  if (total === 0) {
    requestIndicator.style.display = "none"
    requestIndicator.setAttribute("data-summary", "")
  } else {
    requestIndicator.style.display = "inline"
    requestIndicator.style.color =
      summary.errors + consoleErrors > 0
        ? SEVERITY_COLORS.error.color
        : SEVERITY_COLORS.warning.color
    requestIndicator.textContent = `! ${summary.total + visibleConsole.length}`
    requestIndicator.setAttribute(
      "data-summary",
      [
        problems.length > 0
          ? `Request problems: ${summary.errors} error(s), ${summary.warnings} warning(s)`
          : "",
        visibleConsole.length > 0
          ? `Console: ${consoleErrors} error(s), ${visibleConsole.length - consoleErrors} other`
          : ""
      ]
        .filter(Boolean)
        .join("; ")
    )
  }

  const status = getOverallStatus(
    withRequestOutcome(
      checks,
      requestOutcome(summary),
      consoleOutcome(visibleConsole)
    )
  )
  statusDot.setAttribute("data-audit-status", status)
  if (status === "none") {
    statusDot.style.display = "none"
    return
  }
  statusDot.style.display = "inline-block"
  statusDot.style.background = STATUS_COLORS[status]
  statusDot.setAttribute("data-summary", STATUS_LABELS[status])
}

export type StatsValues = {
  prefix: HTMLSpanElement
  requests: HTMLSpanElement
  resources: HTMLSpanElement
  separator: HTMLSpanElement
  transferred: HTMLSpanElement
}

const span = (text: string): HTMLSpanElement => {
  const element = document.createElement("span")
  element.textContent = text
  return element
}

export const createStatsValues = (): StatsValues => ({
  prefix: span("Ad-Auditor "),
  requests: span(" (0 req)"),
  resources: span("0.00 KB"),
  separator: span(" / "),
  transferred: span("0.00 KB")
})

export const applyUsageColors = (
  values: Pick<StatsValues, "resources" | "transferred">,
  metric: LimitMetric,
  totals: Pick<Totals, "resources" | "transferred">,
  limitBytes: number
) => {
  const colors = getUsageColors(metric, totals, limitBytes)
  values.transferred.style.color = colors.transferred
  values.resources.style.color = colors.resources
}

const ALERTS_BASE_STYLE = [
  "display:none",
  "padding:4px 8px",
  "background:rgba(0,0,0,0.88)",
  "border-top:1px solid rgba(125,255,106,0.35)",
  "font-size:10px",
  "line-height:1.35",
  "color:#d8dde7"
]

/** `floating` pins the container under the badge (standalone badge). */
export const createAlertsContainer = (floating: boolean): HTMLDivElement => {
  const container = document.createElement("div")
  container.setAttribute(
    "style",
    (floating
      ? [
          "display:none",
          "position:absolute",
          "left:0",
          "top:100%",
          "width:100%",
          "box-sizing:border-box",
          ...ALERTS_BASE_STYLE.slice(1)
        ]
      : ALERTS_BASE_STYLE
    ).join(";")
  )
  return container
}

/** Shows `lines` as "- line" rows, or hides the container when empty. */
export const renderAlertLines = (container: HTMLElement, lines: string[]) => {
  container.textContent = ""
  if (lines.length === 0) {
    container.style.display = "none"
    return
  }

  container.style.display = "block"
  for (const line of lines) {
    const row = document.createElement("div")
    row.textContent = `- ${line}`
    container.appendChild(row)
  }
}

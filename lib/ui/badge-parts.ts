import type { Totals } from "~lib/features/snapshot"
import type { LimitMetric } from "~lib/types/settings"
import { createIcon, type IconName } from "~lib/ui/icons"
import { attachTooltip } from "~lib/ui/tooltip"
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
export const renderAlertLines = (
  container: HTMLElement,
  lines: string[]
) => {
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

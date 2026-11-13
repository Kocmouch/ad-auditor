import {
  BADGE_FONT_FAMILY,
  createAlertsContainer,
  createStatsValues,
  createToolbarButton,
  type StatsValues
} from "~lib/ui/badge-parts"
import {
  createRequestPanel,
  type RequestPanel,
  type RequestPanelHandlers
} from "~lib/ui/request-panel"

export const STANDALONE_BADGE_ID = "ad-auditor-badge"

/** Fixed bottom bar rendered by monitor on standalone AMS preview pages. */
export type StandaloneBadge = {
  accessibilityButton: HTMLButtonElement
  alerts: HTMLDivElement
  badge: HTMLDivElement
  buttons: HTMLDivElement
  fontsButton: HTMLButtonElement
  openButton: HTMLButtonElement
  panel: RequestPanel
  values: StatsValues
}

export const createStandaloneBadge = (
  panelHandlers: RequestPanelHandlers
): StandaloneBadge => {
  const badge = document.createElement("div")
  badge.id = STANDALONE_BADGE_ID
  badge.setAttribute(
    "style",
    [
      "position: fixed",
      "left: 0",
      "bottom: 0",
      "width: 100%",
      "display: flex",
      "align-items: center",
      "gap: 8px",
      "padding: 4px 8px",
      "box-sizing: border-box",
      "background: rgba(0, 0, 0, 0.8)",
      "color: #7dff6a",
      `font-family: ${BADGE_FONT_FAMILY}`,
      "font-size: 11px",
      "line-height: 1.2",
      "z-index: 2147483647",
      "transition: opacity 120ms linear"
    ].join(";")
  )

  const values = createStatsValues()
  const stats = document.createElement("span")
  stats.style.color = "#ffffff"
  stats.append(
    values.prefix,
    values.transferred,
    values.separator,
    values.resources,
    values.requests
  )

  const panel = createRequestPanel(panelHandlers)

  const openButton = createToolbarButton({
    icon: "open",
    marginLeft: "4px",
    raised: true,
    tooltip: "Open creative in new tab"
  })
  const fontsButton = createToolbarButton({
    icon: "fonts",
    raised: true,
    tooltip: "Check font declarations vs rendered fonts"
  })
  const accessibilityButton = createToolbarButton({
    icon: "accessibility",
    marginLeft: "4px",
    raised: true,
    tooltip: "Check opt-out visibility & banner border"
  })

  const alerts = createAlertsContainer(true)

  const buttons = document.createElement("div")
  buttons.setAttribute(
    "style",
    ["display: flex", "gap: 4px", "margin-left: auto"].join(";")
  )
  buttons.append(fontsButton, accessibilityButton)

  badge.append(stats, buttons, openButton, panel.container, alerts)

  return {
    accessibilityButton,
    alerts,
    badge,
    buttons,
    fontsButton,
    openButton,
    panel,
    values
  }
}

export const applyStandaloneBadgeLayout = (
  parts: Pick<StandaloneBadge, "badge" | "buttons" | "openButton">,
  showOpenButton: boolean,
  showCheckButtons: boolean
) => {
  parts.openButton.style.display = showOpenButton ? "inline-flex" : "none"
  parts.buttons.style.display = showCheckButtons ? "flex" : "none"
  parts.badge.style.justifyContent =
    showOpenButton || showCheckButtons ? "space-between" : "flex-start"
}

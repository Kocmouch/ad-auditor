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
import { attachDynamicTooltip } from "~lib/ui/tooltip"

/** Badge rendered below an ad iframe by host-overlay. */
export type OverlayBadge = {
  accessibilityButton: HTMLButtonElement
  alerts: HTMLDivElement
  badge: HTMLDivElement
  fontsButton: HTMLButtonElement
  openButton: HTMLButtonElement
  panel: RequestPanel
  values: StatsValues
  wrapper: HTMLDivElement
}

export const createOverlayBadge = (
  panelHandlers: RequestPanelHandlers
): OverlayBadge => {
  const wrapper = document.createElement("div")
  wrapper.setAttribute(
    "style",
    [
      "display: flex",
      "flex-direction: column",
      "margin-top: 8px",
      "width: 100%"
    ].join(";")
  )

  const badge = document.createElement("div")
  badge.setAttribute(
    "style",
    [
      "position: relative",
      "display: flex",
      "justify-content: space-between",
      "align-items: center",
      "padding: 4px 8px",
      "box-sizing: border-box",
      "background: rgba(0, 0, 0, 0.8)",
      "color: #7dff6a",
      `font-family: ${BADGE_FONT_FAMILY}`,
      "font-size: 11px",
      "line-height: 1.2",
      "z-index: 2147483647"
    ].join(";")
  )

  const values = createStatsValues()
  const statsContainer = document.createElement("span")
  statsContainer.style.color = "#ffffff"
  statsContainer.style.cursor = "help"
  // Compact view (resources only); the tooltip shows the full breakdown.
  statsContainer.append(values.resources)
  attachDynamicTooltip(statsContainer, () => {
    const transferred = values.transferred.textContent || "0.00 KB"
    const resources = values.resources.textContent || "0.00 KB"
    const requests = values.requests.textContent || "(0 req)"
    return `${transferred} / ${resources} ${requests}`
  })

  const panel = createRequestPanel(panelHandlers)

  const openButton = createToolbarButton({
    icon: "open",
    marginLeft: "auto",
    tooltip: "Open creative in new tab"
  })
  const fontsButton = createToolbarButton({
    icon: "fonts",
    tooltip: "Check font declarations vs rendered fonts"
  })
  const accessibilityButton = createToolbarButton({
    icon: "accessibility",
    tooltip: "Check opt-out visibility & banner border"
  })

  const middleButtons = document.createElement("div")
  middleButtons.setAttribute(
    "style",
    [
      "display: flex",
      "gap: 4px",
      "align-items: center",
      "flex: 1",
      "justify-content: center"
    ].join(";")
  )
  middleButtons.append(fontsButton, accessibilityButton)

  const alerts = createAlertsContainer(false)

  // Child order matters: syncOverlayBadgeLayout positions the open button.
  badge.append(statsContainer, middleButtons, openButton, panel.container)
  wrapper.append(badge, alerts)

  return {
    accessibilityButton,
    alerts,
    badge,
    fontsButton,
    openButton,
    panel,
    values,
    wrapper
  }
}

export const insertBadgeAfterIframe = (
  iframe: HTMLIFrameElement,
  badgeWrapper: HTMLDivElement
) => {
  const parent = iframe.parentElement
  if (!parent) {
    return
  }

  if (badgeWrapper.parentElement !== parent) {
    parent.appendChild(badgeWrapper)
  } else if (badgeWrapper.previousSibling !== iframe) {
    parent.insertBefore(badgeWrapper, iframe.nextSibling)
  }

  if (parent.style.height && parent.style.height !== "auto") {
    parent.style.height = "auto"
  }

  if (!parent.style.width || parent.style.width === "auto") {
    const computedWidth = iframe.getBoundingClientRect().width
    if (computedWidth > 0) {
      parent.style.width = `${computedWidth}px`
    }
  }
}

export const NARROW_FRAME_WIDTH = 250

/** Stacks the badge vertically when the iframe is narrow. */
export const syncOverlayBadgeLayout = (
  iframe: HTMLIFrameElement,
  parts: Pick<OverlayBadge, "badge" | "openButton" | "wrapper">
) => {
  parts.wrapper.style.width = "100%"

  const { badge, openButton } = parts
  const frameWidth = Math.round(iframe.getBoundingClientRect().width)

  if (frameWidth < NARROW_FRAME_WIDTH) {
    badge.style.flexDirection = "column"
    badge.style.alignItems = "center"
    badge.style.justifyContent = "center"
    badge.style.gap = "4px"
    badge.style.textAlign = "center"
    openButton.style.marginLeft = "0"
  } else {
    badge.style.flexDirection = "row"
    badge.style.alignItems = "center"
    badge.style.justifyContent = "space-between"
    badge.style.gap = "0"
    badge.style.textAlign = "left"
    openButton.style.marginLeft = "auto"
  }
}

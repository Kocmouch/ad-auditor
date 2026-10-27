export const createTooltip = (
  text: string,
  centered: boolean = false
): HTMLDivElement => {
  const tooltip = document.createElement("div")
  tooltip.textContent = text
  tooltip.setAttribute(
    "style",
    [
      "position: absolute",
      "bottom: calc(100% + 8px)",
      centered ? "left: 50%" : "left: 0",
      centered ? "transform: translateX(-50%)" : "",
      "background: linear-gradient(145deg, #2a2f3a, #313745)",
      "color: #f3f5f9",
      "padding: 6px 10px",
      "border-radius: 6px",
      "font-size: 11px",
      "white-space: nowrap",
      "pointer-events: none",
      "opacity: 0",
      "transition: opacity 0.2s ease",
      "z-index: 999999",
      "box-shadow: 4px 4px 8px rgba(15, 18, 24, 0.6), -2px -2px 6px rgba(255, 255, 255, 0.05)",
      "border: 1px solid rgba(125, 255, 106, 0.15)"
    ].join(";")
  )

  // Arrow - positioned at left side for left-aligned, center for centered
  const arrow = document.createElement("div")
  arrow.setAttribute(
    "style",
    [
      "position: absolute",
      "top: 100%",
      centered ? "left: 50%" : "left: 12px",
      centered ? "transform: translateX(-50%)" : "",
      "width: 0",
      "height: 0",
      "border-left: 5px solid transparent",
      "border-right: 5px solid transparent",
      "border-top: 5px solid #313745",
      "transition: left 0.2s ease"
    ].join(";")
  )

  tooltip.appendChild(arrow)
  return tooltip
}

const adjustTooltipPosition = (
  tooltip: HTMLDivElement,
  button: HTMLElement
) => {
  const tooltipRect = tooltip.getBoundingClientRect()
  const viewportWidth = window.innerWidth

  // If tooltip goes beyond right edge, it's OK - it extends to the right
  // Only check if it goes beyond left edge
  if (tooltipRect.left < 10) {
    const shift = 10 - tooltipRect.left
    tooltip.style.left = `${shift}px`
  }
}

export const attachTooltip = (
  button: HTMLElement,
  tooltipText: string,
  centered: boolean = true
): void => {
  const tooltip = createTooltip(tooltipText, centered)
  button.style.position = "relative"
  button.appendChild(tooltip)

  button.addEventListener("mouseenter", () => {
    tooltip.style.opacity = "1"
    // Adjust position after tooltip is visible
    requestAnimationFrame(() => adjustTooltipPosition(tooltip, button))
  })

  button.addEventListener("mouseleave", () => {
    tooltip.style.opacity = "0"
  })
}

export const attachDynamicTooltip = (
  element: HTMLElement,
  getTooltipText: () => string,
  centered: boolean = false
): void => {
  const tooltip = createTooltip("", centered)
  element.style.position = "relative"
  element.appendChild(tooltip)

  element.addEventListener("mouseenter", () => {
    // Update text on each hover - get first text node (before arrow)
    const textContent = getTooltipText()
    // Remove old text nodes and re-add
    Array.from(tooltip.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        tooltip.removeChild(node)
      }
    })
    tooltip.insertBefore(document.createTextNode(textContent), tooltip.firstChild)

    tooltip.style.opacity = "1"
    // Adjust position after tooltip is visible
    requestAnimationFrame(() => adjustTooltipPosition(tooltip, element))
  })

  element.addEventListener("mouseleave", () => {
    tooltip.style.opacity = "0"
  })
}

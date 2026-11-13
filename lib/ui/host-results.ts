import type { BorderIssue } from "~lib/features/border-checker"
import type { OptOutIssue } from "~lib/features/optout-checker"
import {
  postToFrame,
  WINDOW_MESSAGE,
  type WireContentIssue,
  type WireFontMismatch,
  type WireQualityIssue
} from "~lib/messaging"
import { createAccessibilityResultsPanel } from "~lib/ui/accessibility-results-panel"
import { createContentResultsPanel } from "~lib/ui/content-results-panel"
import { createQualityResultsPanel } from "~lib/ui/quality-results-panel"
import { getDarkTheme, Z_INDEX } from "~lib/ui/theme"

const NEUMORPHIC_BUTTON_SHADOW =
  "4px 4px 8px rgba(15, 18, 24, 0.6), -4px -4px 8px rgba(255, 255, 255, 0.05)"
const NEUMORPHIC_BUTTON_SHADOW_PRESSED =
  "inset 4px 4px 8px rgba(15, 18, 24, 0.6), inset -4px -4px 8px rgba(255, 255, 255, 0.05)"

export const shortenIframeLabel = (iframeUrl: string): string =>
  iframeUrl.length > 40 ? iframeUrl.substring(0, 40) + "..." : iframeUrl

const createControlButton = (
  label: string,
  color: string,
  fontSize: string
): HTMLButtonElement => {
  const button = document.createElement("button")
  button.textContent = label
  button.type = "button"
  button.style.cssText = [
    "width:24px",
    "height:24px",
    "border-radius:8px",
    "border:none",
    "background:linear-gradient(145deg, #2a2f3a, #313745)",
    `box-shadow:${NEUMORPHIC_BUTTON_SHADOW}`,
    `color:${color}`,
    `font-size:${fontSize}`,
    "cursor:pointer",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "transition:all 0.2s"
  ].join(";")

  button.addEventListener("mouseenter", () => {
    button.style.boxShadow = NEUMORPHIC_BUTTON_SHADOW_PRESSED
  })
  button.addEventListener("mouseleave", () => {
    button.style.boxShadow = NEUMORPHIC_BUTTON_SHADOW
  })
  return button
}

const createFontRow = (mismatch: WireFontMismatch): HTMLDivElement => {
  const row = document.createElement("div")
  row.style.cssText = [
    "padding:8px 12px",
    "margin-bottom:6px",
    "border-radius:10px",
    "background:linear-gradient(145deg, #313745, #2a2f3a)",
    "box-shadow:inset 3px 3px 6px rgba(15, 18, 24, 0.4), inset -3px -3px 6px rgba(255, 255, 255, 0.03)",
    "font-size:10px",
    "line-height:1.5",
    "color:#d8dde7"
  ].join(";")

  const elementLabel = document.createElement("div")
  elementLabel.textContent = mismatch.element
  elementLabel.style.cssText =
    "color:#7dff6a;font-weight:600;margin-bottom:4px;font-size:10px"

  const fontInfo = document.createElement("div")
  fontInfo.style.cssText = "display:flex;gap:8px;align-items:center"

  const declared = document.createElement("span")
  declared.textContent = mismatch.declared
  declared.style.cssText = "color:#9db7d2"

  const arrow = document.createElement("span")
  arrow.textContent = "→"
  arrow.style.cssText = "color:#f59e0b"

  const rendered = document.createElement("span")
  rendered.textContent = `fallback: ${mismatch.rendered}`
  rendered.style.cssText = "color:#ef4444;font-weight:600"

  fontInfo.append(declared, arrow, rendered)
  row.append(elementLabel, fontInfo)
  return row
}

/**
 * Owns the page-level results panels shown by creatives-host: the draggable
 * font panel, the accessibility panel, and the highlight outline on the
 * iframe that was audited.
 */
export const createHostResults = () => {
  let fontContainer: HTMLDivElement | null = null
  let accessibilityContainer: HTMLDivElement | null = null
  let contentContainer: HTMLDivElement | null = null
  let qualityContainer: HTMLDivElement | null = null
  let highlightedIframe: HTMLIFrameElement | null = null
  let panelX = 0
  let panelY = 0
  let isDragging = false
  let dragOffsetX = 0
  let dragOffsetY = 0

  document.addEventListener("mousemove", (event) => {
    if (!isDragging || !fontContainer) {
      return
    }

    event.preventDefault()
    panelX = event.clientX - dragOffsetX
    panelY = event.clientY - dragOffsetY
    fontContainer.style.transform = `translate(${panelX}px, ${panelY}px)`
  })
  document.addEventListener("mouseup", () => {
    isDragging = false
  })

  const highlightIframe = (iframe: HTMLIFrameElement) => {
    if (highlightedIframe && highlightedIframe !== iframe) {
      highlightedIframe.style.outline = ""
    }

    iframe.style.outline = "3px solid #7dff6a"
    iframe.style.outlineOffset = "2px"
    highlightedIframe = iframe
  }

  const removeIframeHighlight = () => {
    if (highlightedIframe) {
      highlightedIframe.style.outline = ""
      highlightedIframe = null
    }
  }

  const ensureFontContainer = (): HTMLDivElement => {
    if (fontContainer && document.body.contains(fontContainer)) {
      return fontContainer
    }

    fontContainer = document.createElement("div")
    fontContainer.id = "ad-auditor-font-check-results-global"
    fontContainer.style.cssText = [
      "position:fixed",
      "right:20px",
      "bottom:80px",
      "width:420px",
      "max-width:calc(100vw - 40px)",
      "background:linear-gradient(145deg, #2a2f3a, #313745)",
      "border-radius:16px",
      "box-shadow:12px 12px 24px rgba(15, 18, 24, 0.8), -12px -12px 24px rgba(255, 255, 255, 0.05)",
      `z-index:${Z_INDEX.panel}`,
      "font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      "color:#d8dde7",
      "backdrop-filter:blur(10px)",
      "border:1px solid rgba(125, 255, 106, 0.1)",
      "display:none"
    ].join(";")

    document.body.appendChild(fontContainer)
    return fontContainer
  }

  const renderFontResults = (
    fontMismatches: WireFontMismatch[],
    iframeUrl: string,
    iframe: HTMLIFrameElement
  ) => {
    const container = ensureFontContainer()

    if (fontMismatches.length === 0) {
      container.style.display = "none"
      container.textContent = ""
      removeIframeHighlight()
      postToFrame(iframe, { type: WINDOW_MESSAGE.CLEAR_FONT_HIGHLIGHTS })
      return
    }

    container.textContent = ""
    container.style.display = "block"
    highlightIframe(iframe)

    if (panelX !== 0 || panelY !== 0) {
      container.style.transform = `translate(${panelX}px, ${panelY}px)`
    }

    const header = document.createElement("div")
    header.style.cssText = [
      "display:flex",
      "justify-content:space-between",
      "align-items:center",
      "padding:12px 16px",
      "cursor:move",
      "user-select:none",
      "border-bottom:1px solid rgba(125,255,106,0.15)",
      "background:linear-gradient(145deg, #313745, #2a2f3a)",
      "border-radius:16px 16px 0 0"
    ].join(";")

    const titleContainer = document.createElement("div")
    titleContainer.style.cssText = "display:flex;flex-direction:column;gap:2px"

    const title = document.createElement("div")
    title.textContent = `Font Issues (${fontMismatches.length})`
    title.style.cssText = [
      "font-weight:700",
      "font-size:12px",
      "color:#7dff6a",
      "letter-spacing:0.5px"
    ].join(";")

    const iframeLabel = document.createElement("div")
    iframeLabel.textContent = `iframe: ${shortenIframeLabel(iframeUrl)}`
    iframeLabel.style.cssText = [
      "font-size:9px",
      "color:#9db7d2",
      "font-weight:400"
    ].join(";")
    titleContainer.append(title, iframeLabel)

    const controls = document.createElement("div")
    controls.style.cssText = "display:flex;gap:8px;align-items:center"
    const minimizeButton = createControlButton("−", "#b5bdcd", "16px")
    const closeButton = createControlButton("✕", "#ef4444", "14px")

    const content = document.createElement("div")
    content.style.cssText = [
      "padding:12px 16px",
      "max-height:400px",
      "overflow-y:auto",
      "scrollbar-width:thin",
      "scrollbar-color:#313745 #2a2f3a"
    ].join(";")

    let isMinimized = false
    minimizeButton.addEventListener("click", () => {
      isMinimized = !isMinimized
      content.style.display = isMinimized ? "none" : "block"
      minimizeButton.textContent = isMinimized ? "□" : "−"
      container.style.maxHeight = isMinimized ? "auto" : "500px"
    })

    closeButton.addEventListener("click", () => {
      container.style.display = "none"
      removeIframeHighlight()
      postToFrame(iframe, { type: WINDOW_MESSAGE.CLEAR_FONT_HIGHLIGHTS })
    })

    header.addEventListener("mousedown", (event) => {
      isDragging = true
      dragOffsetX = event.clientX - panelX
      dragOffsetY = event.clientY - panelY
    })

    for (const mismatch of fontMismatches) {
      content.appendChild(createFontRow(mismatch))
    }

    controls.append(minimizeButton, closeButton)
    header.append(titleContainer, controls)
    container.append(header, content)
  }

  const renderAccessibilityResults = (
    optOutIssues: Omit<OptOutIssue, "htmlElement">[],
    borderIssues: Omit<BorderIssue, "htmlElement">[],
    iframe: HTMLIFrameElement
  ) => {
    if (
      accessibilityContainer &&
      document.body.contains(accessibilityContainer)
    ) {
      accessibilityContainer.remove()
    }

    highlightIframe(iframe)

    const panel = createAccessibilityResultsPanel(
      optOutIssues,
      borderIssues,
      getDarkTheme()
    )
    accessibilityContainer = panel

    const closeButton = panel.querySelector("button")
    closeButton?.addEventListener("click", () => {
      panel.remove()
      removeIframeHighlight()
      postToFrame(iframe, {
        type: WINDOW_MESSAGE.CLEAR_ACCESSIBILITY_HIGHLIGHTS
      })
    })

    document.body.appendChild(panel)
  }

  /** Rows ask the iframe (which owns the elements) to focus issue `index`. */
  const renderContentResults = (
    issues: WireContentIssue[],
    iframe: HTMLIFrameElement
  ) => {
    contentContainer?.remove()
    highlightIframe(iframe)

    const panel = createContentResultsPanel(issues, getDarkTheme(), {
      onClose: () => {
        removeIframeHighlight()
        postToFrame(iframe, { type: WINDOW_MESSAGE.CLEAR_CONTENT_HIGHLIGHTS })
      },
      onSelect: (index) =>
        postToFrame(iframe, {
          index,
          type: WINDOW_MESSAGE.FOCUS_CONTENT_ISSUE
        })
    })
    contentContainer = panel
    document.body.appendChild(panel)
  }

  const renderQualityResults = (
    issues: WireQualityIssue[],
    coveragePercent: number | null,
    iframe: HTMLIFrameElement
  ) => {
    qualityContainer?.remove()
    highlightIframe(iframe)

    const panel = createQualityResultsPanel(
      issues,
      coveragePercent,
      getDarkTheme(),
      {
        onClose: () => {
          removeIframeHighlight()
          postToFrame(iframe, {
            type: WINDOW_MESSAGE.CLEAR_QUALITY_HIGHLIGHTS
          })
        },
        onSelect: (index) =>
          postToFrame(iframe, {
            index,
            type: WINDOW_MESSAGE.FOCUS_QUALITY_ISSUE
          })
      }
    )
    qualityContainer = panel
    document.body.appendChild(panel)
  }

  return {
    renderAccessibilityResults,
    renderContentResults,
    renderFontResults,
    renderQualityResults
  }
}

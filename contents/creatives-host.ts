import type { PlasmoCSConfig } from "plasmo"

import {
  clearBorderHighlights,
  type BorderIssue
} from "~lib/features/border-checker"
import { clearFontHighlights } from "~lib/features/font-checker"
import {
  clearOptOutHighlights,
  type OptOutIssue
} from "~lib/features/optout-checker"
import { createAccessibilityResultsPanel } from "~lib/ui/accessibility-results-panel"

export const config: PlasmoCSConfig = {
  matches: [
    "https://creatives-preview.rtbhouse.com/*",
    "https://techtools.rtbhouse.biz/*"
  ],
  all_frames: false // IMPORTANT: Only run on main frame, not iframes
}

type FontMismatch = {
  element: string
  declared: string
  rendered: string
}

let globalFontCheckResultsContainer: HTMLDivElement | null = null
let globalAccessibilityResultsContainer: HTMLDivElement | null = null
let currentHighlightedIframe: HTMLIFrameElement | null = null

let savedPanelX = 0
let savedPanelY = 0

const ensureGlobalFontCheckContainer = (): HTMLDivElement => {
  if (
    globalFontCheckResultsContainer &&
    document.body.contains(globalFontCheckResultsContainer)
  ) {
    return globalFontCheckResultsContainer
  }

  globalFontCheckResultsContainer = document.createElement("div")
  globalFontCheckResultsContainer.id = "ad-auditor-font-check-results-global"
  globalFontCheckResultsContainer.style.cssText = [
    "position:fixed",
    "right:20px",
    "bottom:80px",
    "width:420px",
    "max-width:calc(100vw - 40px)",
    "background:linear-gradient(145deg, #2a2f3a, #313745)",
    "border-radius:16px",
    "box-shadow:12px 12px 24px rgba(15, 18, 24, 0.8), -12px -12px 24px rgba(255, 255, 255, 0.05)",
    "z-index:2147483647",
    "font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    "color:#d8dde7",
    "backdrop-filter:blur(10px)",
    "border:1px solid rgba(125, 255, 106, 0.1)",
    "display:none"
  ].join(";")

  document.body.appendChild(globalFontCheckResultsContainer)
  return globalFontCheckResultsContainer
}

const highlightIframe = (iframe: HTMLIFrameElement) => {
  if (currentHighlightedIframe && currentHighlightedIframe !== iframe) {
    currentHighlightedIframe.style.outline = ""
  }

  iframe.style.outline = "3px solid #7dff6a"
  iframe.style.outlineOffset = "2px"
  currentHighlightedIframe = iframe
}

const removeIframeHighlight = () => {
  if (currentHighlightedIframe) {
    currentHighlightedIframe.style.outline = ""
    currentHighlightedIframe = null
  }
}

const renderFontCheckResults = (
  fontMismatches: FontMismatch[],
  iframeUrl: string,
  iframe: HTMLIFrameElement
) => {
  const container = ensureGlobalFontCheckContainer()

  if (fontMismatches.length === 0) {
    container.style.display = "none"
    container.textContent = ""
    removeIframeHighlight()

    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage(
        { type: "ad-auditor-clear-font-highlights" },
        "*"
      )
    }
    return
  }

  container.textContent = ""
  container.style.display = "block"
  highlightIframe(iframe)

  if (savedPanelX !== 0 || savedPanelY !== 0) {
    container.style.transform = `translate(${savedPanelX}px, ${savedPanelY}px)`
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
  const iframeShortSrc =
    iframeUrl.length > 40 ? iframeUrl.substring(0, 40) + "..." : iframeUrl
  iframeLabel.textContent = `iframe: ${iframeShortSrc}`
  iframeLabel.style.cssText = [
    "font-size:9px",
    "color:#9db7d2",
    "font-weight:400"
  ].join(";")

  titleContainer.append(title, iframeLabel)

  const controls = document.createElement("div")
  controls.style.cssText = "display:flex;gap:8px;align-items:center"

  const minimizeButton = document.createElement("button")
  minimizeButton.textContent = "−"
  minimizeButton.type = "button"
  minimizeButton.style.cssText = [
    "width:24px",
    "height:24px",
    "border-radius:8px",
    "border:none",
    "background:linear-gradient(145deg, #2a2f3a, #313745)",
    "box-shadow:4px 4px 8px rgba(15, 18, 24, 0.6), -4px -4px 8px rgba(255, 255, 255, 0.05)",
    "color:#b5bdcd",
    "font-size:16px",
    "cursor:pointer",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "transition:all 0.2s"
  ].join(";")

  const closeButton = document.createElement("button")
  closeButton.textContent = "✕"
  closeButton.type = "button"
  closeButton.style.cssText = [
    "width:24px",
    "height:24px",
    "border-radius:8px",
    "border:none",
    "background:linear-gradient(145deg, #2a2f3a, #313745)",
    "box-shadow:4px 4px 8px rgba(15, 18, 24, 0.6), -4px -4px 8px rgba(255, 255, 255, 0.05)",
    "color:#ef4444",
    "font-size:14px",
    "cursor:pointer",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "transition:all 0.2s"
  ].join(";")

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
    if (isMinimized) {
      content.style.display = "none"
      minimizeButton.textContent = "□"
      container.style.maxHeight = "auto"
    } else {
      content.style.display = "block"
      minimizeButton.textContent = "−"
      container.style.maxHeight = "500px"
    }
  })

  closeButton.addEventListener("click", () => {
    container.style.display = "none"
    removeIframeHighlight()

    if (currentHighlightedIframe && currentHighlightedIframe.contentWindow) {
      currentHighlightedIframe.contentWindow.postMessage(
        { type: "ad-auditor-clear-font-highlights" },
        "*"
      )
    }
  })

  minimizeButton.addEventListener("mouseenter", () => {
    minimizeButton.style.boxShadow =
      "inset 4px 4px 8px rgba(15, 18, 24, 0.6), inset -4px -4px 8px rgba(255, 255, 255, 0.05)"
  })
  minimizeButton.addEventListener("mouseleave", () => {
    minimizeButton.style.boxShadow =
      "4px 4px 8px rgba(15, 18, 24, 0.6), -4px -4px 8px rgba(255, 255, 255, 0.05)"
  })

  closeButton.addEventListener("mouseenter", () => {
    closeButton.style.boxShadow =
      "inset 4px 4px 8px rgba(15, 18, 24, 0.6), inset -4px -4px 8px rgba(255, 255, 255, 0.05)"
  })
  closeButton.addEventListener("mouseleave", () => {
    closeButton.style.boxShadow =
      "4px 4px 8px rgba(15, 18, 24, 0.6), -4px -4px 8px rgba(255, 255, 255, 0.05)"
  })

  // Make draggable
  let isDragging = false
  let currentX = savedPanelX
  let currentY = savedPanelY
  let initialX = 0
  let initialY = 0

  header.addEventListener("mousedown", (e) => {
    isDragging = true
    initialX = e.clientX - currentX
    initialY = e.clientY - currentY
  })

  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      e.preventDefault()
      currentX = e.clientX - initialX
      currentY = e.clientY - initialY
      container.style.transform = `translate(${currentX}px, ${currentY}px)`

      savedPanelX = currentX
      savedPanelY = currentY
    }
  })

  document.addEventListener("mouseup", () => {
    isDragging = false
  })

  for (const mismatch of fontMismatches) {
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
    content.appendChild(row)
  }

  controls.append(minimizeButton, closeButton)
  header.append(titleContainer, controls)
  container.append(header, content)
}

const renderAccessibilityCheckResults = (
  optOutIssues: OptOutIssue[],
  borderIssues: BorderIssue[],
  iframeUrl: string,
  iframe: HTMLIFrameElement
) => {
  // Remove old panel if exists
  if (
    globalAccessibilityResultsContainer &&
    document.body.contains(globalAccessibilityResultsContainer)
  ) {
    globalAccessibilityResultsContainer.remove()
  }

  highlightIframe(iframe)

  const theme = {
    background: "#2a2f3a",
    surface: "#313745",
    text: "#f3f5f9",
    textMuted: "#b5bdcd",
    shadowLight: "rgba(255, 255, 255, 0.05)",
    shadowDark: "rgba(15, 18, 24, 0.6)",
    accent: "#7dff6a"
  }

  globalAccessibilityResultsContainer = createAccessibilityResultsPanel(
    optOutIssues,
    borderIssues,
    theme
  )

  // Add close button handler
  const closeButton = globalAccessibilityResultsContainer.querySelector(
    "button"
  ) as HTMLButtonElement
  if (closeButton) {
    closeButton.addEventListener("click", () => {
      if (globalAccessibilityResultsContainer) {
        globalAccessibilityResultsContainer.remove()
      }
      removeIframeHighlight()

      // Clear highlights in iframe
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage(
          { type: "ad-auditor-clear-accessibility-highlights" },
          "*"
        )
      }
    })
  }

  document.body.appendChild(globalAccessibilityResultsContainer)
}

const findIframeBySourceWindow = (
  sourceWindow: MessageEventSource | null
): HTMLIFrameElement | null => {
  if (!sourceWindow || typeof sourceWindow === "string") {
    return null
  }

  const frames = document.querySelectorAll("iframe")

  for (const frame of frames) {
    if (frame.contentWindow === sourceWindow) {
      return frame
    }
  }

  return null
}

// Listen for messages from host-overlay.ts and monitor.ts
window.addEventListener("message", (event) => {
  // From host-overlay.ts (below iframe mode)
  if (event.data?.type === "ad-auditor-font-check-results") {
    const { fontMismatches, iframeUrl, iframeIndex } = event.data

    // Find the iframe by index
    const iframes = Array.from(
      document.querySelectorAll<HTMLIFrameElement>("iframe")
    )
    const iframe = iframes[iframeIndex]

    if (iframe && fontMismatches) {
      renderFontCheckResults(fontMismatches, iframeUrl, iframe)
    }
  }

  // From monitor.ts (inside iframe mode)
  if (
    event.data?.source === "ad-auditor" &&
    event.data?.type === "font-check-results"
  ) {
    const { fontMismatches, iframeUrl } = event.data

    // Find the iframe by its content window
    const iframe = findIframeBySourceWindow(event.source)

    if (iframe && fontMismatches) {
      renderFontCheckResults(fontMismatches, iframeUrl, iframe)
    }
  }

  // Accessibility check results from host-overlay.ts (below iframe mode)
  if (event.data?.type === "ad-auditor-check-accessibility-response") {
    const { optOutIssues, borderIssues, iframeUrl } = event.data

    // Find the iframe by its content window
    const iframe = findIframeBySourceWindow(event.source)

    if (iframe) {
      renderAccessibilityCheckResults(
        optOutIssues,
        borderIssues,
        iframeUrl,
        iframe
      )
    }
  }

  // Accessibility check results from monitor.ts (inside iframe mode)
  if (
    event.data?.source === "ad-auditor" &&
    event.data?.type === "accessibility-check-results"
  ) {
    const { optOutIssues, borderIssues, iframeUrl } = event.data

    // Find the iframe by its content window
    const iframe = findIframeBySourceWindow(event.source)

    if (iframe) {
      renderAccessibilityCheckResults(
        optOutIssues,
        borderIssues,
        iframeUrl,
        iframe
      )
    }
  }
})

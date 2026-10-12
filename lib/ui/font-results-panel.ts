import type { FontMismatch } from "../features/font-checker"

type Theme = {
  background: string
  surface: string
  text: string
  textMuted: string
  shadowLight: string
  shadowDark: string
  accent: string
}

// Store panel position globally so it persists across re-renders
let savedPanelX = 0
let savedPanelY = 0

export const createFontCheckResultsPanel = (
  fontMismatches: FontMismatch[],
  theme: Theme
): HTMLDivElement => {
  const container = document.createElement("div")
  container.id = "ad-auditor-font-check-results"
  container.style.cssText = [
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
    "border:1px solid rgba(125, 255, 106, 0.1)"
  ].join(";")

  // Apply saved position immediately
  if (savedPanelX !== 0 || savedPanelY !== 0) {
    container.style.transform = `translate(${savedPanelX}px, ${savedPanelY}px)`
    console.log(
      "[Ad Auditor] Restoring panel position:",
      savedPanelX,
      savedPanelY
    )
  }

  if (fontMismatches.length === 0) {
    container.style.display = "none"
    return container
  }

  const header = createHeader()
  const { content, minimizeButton, closeButton } = createControls(container)

  header.append(
    createTitle(fontMismatches.length),
    createControlButtons(minimizeButton, closeButton)
  )

  makeDraggable(container, header)
  populateContent(content, fontMismatches)

  container.append(header, content)
  return container
}

const createHeader = (): HTMLDivElement => {
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
  return header
}

const createTitle = (count: number): HTMLDivElement => {
  const title = document.createElement("div")
  title.textContent = `Font Issues (${count})`
  title.style.cssText = [
    "font-weight:700",
    "font-size:12px",
    "color:#7dff6a",
    "letter-spacing:0.5px"
  ].join(";")
  return title
}

const createControlButtons = (
  minimizeButton: HTMLButtonElement,
  closeButton: HTMLButtonElement
): HTMLDivElement => {
  const controls = document.createElement("div")
  controls.style.cssText = "display:flex;gap:8px;align-items:center"
  controls.append(minimizeButton, closeButton)
  return controls
}

const createControls = (
  container: HTMLDivElement
): {
  content: HTMLDivElement
  minimizeButton: HTMLButtonElement
  closeButton: HTMLButtonElement
} => {
  const content = document.createElement("div")
  content.style.cssText = [
    "padding:12px 16px",
    "max-height:400px",
    "overflow-y:auto",
    "scrollbar-width:thin",
    "scrollbar-color:#313745 #2a2f3a"
  ].join(";")

  const minimizeButton = createButton("−", "#b5bdcd")
  const closeButton = createButton("✕", "#ef4444")

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
  })

  addHoverEffect(minimizeButton)
  addHoverEffect(closeButton)

  return { content, minimizeButton, closeButton }
}

const createButton = (text: string, color: string): HTMLButtonElement => {
  const button = document.createElement("button")
  button.textContent = text
  button.type = "button"
  button.style.cssText = [
    "width:24px",
    "height:24px",
    "border-radius:8px",
    "border:none",
    "background:linear-gradient(145deg, #2a2f3a, #313745)",
    "box-shadow:4px 4px 8px rgba(15, 18, 24, 0.6), -4px -4px 8px rgba(255, 255, 255, 0.05)",
    `color:${color}`,
    "font-size:14px",
    "cursor:pointer",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "transition:all 0.2s"
  ].join(";")
  return button
}

const addHoverEffect = (button: HTMLButtonElement) => {
  button.addEventListener("mouseenter", () => {
    button.style.boxShadow =
      "inset 4px 4px 8px rgba(15, 18, 24, 0.6), inset -4px -4px 8px rgba(255, 255, 255, 0.05)"
  })
  button.addEventListener("mouseleave", () => {
    button.style.boxShadow =
      "4px 4px 8px rgba(15, 18, 24, 0.6), -4px -4px 8px rgba(255, 255, 255, 0.05)"
  })
}

const makeDraggable = (container: HTMLDivElement, header: HTMLDivElement) => {
  let isDragging = false
  let currentX = savedPanelX
  let currentY = savedPanelY
  let initialX = 0
  let initialY = 0

  header.addEventListener("mousedown", (e) => {
    isDragging = true
    initialX = e.clientX - currentX
    initialY = e.clientY - currentY
    console.log(
      "[Ad Auditor] Start drag - currentX:",
      currentX,
      "currentY:",
      currentY
    )
  })

  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      e.preventDefault()
      currentX = e.clientX - initialX
      currentY = e.clientY - initialY
      container.style.transform = `translate(${currentX}px, ${currentY}px)`

      // Save position globally
      savedPanelX = currentX
      savedPanelY = currentY
    }
  })

  document.addEventListener("mouseup", () => {
    isDragging = false
  })
}

const populateContent = (
  content: HTMLDivElement,
  fontMismatches: FontMismatch[]
) => {
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
}

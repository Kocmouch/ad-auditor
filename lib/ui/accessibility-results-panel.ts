import type { BorderIssue } from "~lib/features/border-checker"
import type { OptOutIssue } from "~lib/features/optout-checker"

type Theme = {
  background: string
  surface: string
  text: string
  textMuted: string
  shadowLight: string
  shadowDark: string
  accent: string
}

export const createAccessibilityResultsPanel = (
  optOutIssues: OptOutIssue[],
  borderIssues: BorderIssue[],
  theme: Theme
): HTMLDivElement => {
  const panel = document.createElement("div")
  panel.setAttribute(
    "style",
    [
      "position: fixed",
      "top: 50%",
      "left: 50%",
      "transform: translate(-50%, -50%)",
      `background: ${theme.background}`,
      "border-radius: 8px",
      `box-shadow: 0 8px 32px ${theme.shadowDark}, inset 0 1px 0 ${theme.shadowLight}`,
      "padding: 16px",
      "max-width: 600px",
      "max-height: 80vh",
      "overflow-y: auto",
      "z-index: 999999",
      `color: ${theme.text}`,
      "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      "font-size: 13px",
      "line-height: 1.5"
    ].join(";")
  )

  // Header
  const header = document.createElement("div")
  header.setAttribute(
    "style",
    [
      "display: flex",
      "justify-content: space-between",
      "align-items: center",
      "margin-bottom: 16px",
      "padding-bottom: 12px",
      `border-bottom: 1px solid ${theme.surface}`
    ].join(";")
  )

  const title = document.createElement("h2")
  title.textContent = "Accessibility Check Results"
  title.setAttribute(
    "style",
    ["margin: 0", "font-size: 16px", "font-weight: 600"].join(";")
  )

  const closeButton = document.createElement("button")
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
      "height: 24px",
      "display: flex",
      "align-items: center",
      "justify-content: center",
      "border-radius: 4px"
    ].join(";")
  )
  closeButton.addEventListener("click", () => {
    panel.remove()
  })
  closeButton.addEventListener("mouseenter", () => {
    closeButton.style.background = theme.surface
  })
  closeButton.addEventListener("mouseleave", () => {
    closeButton.style.background = "transparent"
  })

  header.appendChild(title)
  header.appendChild(closeButton)
  panel.appendChild(header)

  // Summary
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

  const optOutCount = document.createElement("div")
  optOutCount.innerHTML = `<span style="color: ${theme.textMuted}">Opt-out issues:</span> <strong style="color: ${optOutIssues.length > 0 ? "#ff6b6b" : theme.accent}">${optOutIssues.length}</strong>`

  const borderCount = document.createElement("div")
  borderCount.innerHTML = `<span style="color: ${theme.textMuted}">Border issues:</span> <strong style="color: ${borderIssues.length > 0 ? "#ff6b6b" : theme.accent}">${borderIssues.length}</strong>`

  summary.appendChild(optOutCount)
  summary.appendChild(borderCount)
  panel.appendChild(summary)

  // Opt-out issues section
  if (optOutIssues.length > 0) {
    const optOutSection = document.createElement("div")
    optOutSection.setAttribute("style", "margin-bottom: 20px")

    const optOutTitle = document.createElement("h3")
    optOutTitle.textContent = "Opt-out Issues"
    optOutTitle.setAttribute(
      "style",
      [
        "margin: 0 0 12px 0",
        "font-size: 14px",
        "font-weight: 600",
        `color: ${theme.accent}`
      ].join(";")
    )
    optOutSection.appendChild(optOutTitle)

    for (const issue of optOutIssues) {
      const issueCard = createIssueCard(issue, theme)
      optOutSection.appendChild(issueCard)
    }

    panel.appendChild(optOutSection)
  }

  // Border issues section
  if (borderIssues.length > 0) {
    const borderSection = document.createElement("div")
    borderSection.setAttribute("style", "margin-bottom: 20px")

    const borderTitle = document.createElement("h3")
    borderTitle.textContent = "Border Issues"
    borderTitle.setAttribute(
      "style",
      [
        "margin: 0 0 12px 0",
        "font-size: 14px",
        "font-weight: 600",
        `color: ${theme.accent}`
      ].join(";")
    )
    borderSection.appendChild(borderTitle)

    for (const issue of borderIssues) {
      const issueCard = createBorderIssueCard(issue, theme)
      borderSection.appendChild(issueCard)
    }

    panel.appendChild(borderSection)
  }

  // No issues message
  if (optOutIssues.length === 0 && borderIssues.length === 0) {
    const noIssues = document.createElement("div")
    noIssues.textContent = "✓ No accessibility issues detected"
    noIssues.setAttribute(
      "style",
      [
        "padding: 24px",
        "text-align: center",
        `color: ${theme.accent}`,
        "font-size: 14px"
      ].join(";")
    )
    panel.appendChild(noIssues)
  }

  return panel
}

const createIssueCard = (issue: OptOutIssue, theme: Theme): HTMLDivElement => {
  const card = document.createElement("div")
  card.setAttribute(
    "style",
    [
      "padding: 12px",
      `background: ${theme.surface}`,
      "border-radius: 6px",
      "margin-bottom: 8px",
      `border-left: 3px solid ${getIssueColor(issue.issueType)}`
    ].join(";")
  )

  const elementLabel = document.createElement("div")
  elementLabel.innerHTML = `<code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 3px; font-size: 12px; color: ${theme.accent}">${issue.element}</code>`
  card.appendChild(elementLabel)

  const issueType = document.createElement("div")
  issueType.textContent = getIssueTypeLabel(issue.issueType)
  issueType.setAttribute(
    "style",
    [
      "margin-top: 6px",
      "font-size: 12px",
      "font-weight: 600",
      `color: ${getIssueColor(issue.issueType)}`
    ].join(";")
  )
  card.appendChild(issueType)

  const details = document.createElement("div")
  details.textContent = issue.details
  details.setAttribute(
    "style",
    ["margin-top: 4px", "font-size: 12px", `color: ${theme.textMuted}`].join(
      ";"
    )
  )
  card.appendChild(details)

  if (issue.contrastRatio !== undefined) {
    const ratio = document.createElement("div")
    ratio.innerHTML = `Contrast ratio: <strong>${issue.contrastRatio}:1</strong> (minimum: 4.5:1)`
    ratio.setAttribute(
      "style",
      ["margin-top: 4px", "font-size: 12px", `color: ${theme.text}`].join(";")
    )
    card.appendChild(ratio)
  }

  return card
}

const createBorderIssueCard = (
  issue: BorderIssue,
  theme: Theme
): HTMLDivElement => {
  const card = document.createElement("div")
  card.setAttribute(
    "style",
    [
      "padding: 12px",
      `background: ${theme.surface}`,
      "border-radius: 6px",
      "margin-bottom: 8px",
      `border-left: 3px solid ${getBorderIssueColor(issue.issueType)}`
    ].join(";")
  )

  const elementLabel = document.createElement("div")
  elementLabel.innerHTML = `<code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 3px; font-size: 12px; color: ${theme.accent}">${issue.element}</code>`
  card.appendChild(elementLabel)

  const issueType = document.createElement("div")
  issueType.textContent = getBorderIssueTypeLabel(issue.issueType)
  issueType.setAttribute(
    "style",
    [
      "margin-top: 6px",
      "font-size: 12px",
      "font-weight: 600",
      `color: ${getBorderIssueColor(issue.issueType)}`
    ].join(";")
  )
  card.appendChild(issueType)

  const details = document.createElement("div")
  details.textContent = issue.details
  details.setAttribute(
    "style",
    ["margin-top: 4px", "font-size: 12px", `color: ${theme.textMuted}`].join(
      ";"
    )
  )
  card.appendChild(details)

  return card
}

const getIssueTypeLabel = (type: OptOutIssue["issueType"]): string => {
  switch (type) {
    case "missing":
      return "⚠ Missing opt-out"
    case "low-contrast":
      return "⚠ Low contrast"
    case "hidden":
      return "⚠ Hidden element"
  }
}

const getBorderIssueTypeLabel = (type: BorderIssue["issueType"]): string => {
  switch (type) {
    case "missing":
      return "⚠ Missing border"
    case "invisible":
      return "⚠ Invisible border"
  }
}

const getIssueColor = (type: OptOutIssue["issueType"]): string => {
  switch (type) {
    case "missing":
      return "#ff6b6b"
    case "low-contrast":
      return "#f9ca24"
    case "hidden":
      return "#ff6b6b"
  }
}

const getBorderIssueColor = (type: BorderIssue["issueType"]): string => {
  switch (type) {
    case "missing":
      return "#ff6b6b"
    case "invisible":
      return "#f9ca24"
  }
}

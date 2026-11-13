import {
  getTextContrast,
  parseColor,
  resolveBackground
} from "~lib/utils/color"

export type OptOutIssue = {
  element: string
  issueType: "missing" | "low-contrast" | "hidden" | "contrast-unverifiable"
  contrastRatio?: number
  details: string
  htmlElement?: HTMLElement
}

const MIN_CONTRAST_RATIO = 4.5

export const checkOptOutElements = (): OptOutIssue[] => {
  const issues: OptOutIssue[] = []

  // Clear previous highlights
  const previouslyHighlighted = document.querySelectorAll(
    "[data-ad-auditor-optout-highlight]"
  )
  previouslyHighlighted.forEach((el) => {
    const htmlEl = el as HTMLElement
    htmlEl.style.outline = ""
    htmlEl.removeAttribute("data-ad-auditor-optout-highlight")
  })

  // Find opt-out elements by class or id
  const optOutSelectors = [
    ".optout",
    ".opt-out",
    ".optOut",
    "#optout",
    "#opt-out",
    "#optOut",
    '[class*="optout" i]',
    '[id*="optout" i]'
  ]

  const foundElements = new Set<HTMLElement>()

  for (const selector of optOutSelectors) {
    try {
      const elements = document.querySelectorAll(selector)
      elements.forEach((el) => {
        if (el instanceof HTMLElement) {
          foundElements.add(el)
        }
      })
    } catch {
      continue
    }
  }

  if (foundElements.size === 0) {
    issues.push({
      element: "document",
      issueType: "missing",
      details: "No opt-out element found in iframe",
      htmlElement: undefined
    })
    return issues
  }

  for (const element of foundElements) {
    const computed = window.getComputedStyle(element)
    const elementDesc =
      element.tagName.toLowerCase() +
      (element.id ? `#${element.id}` : "") +
      (element.className && typeof element.className === "string"
        ? `.${element.className.split(" ")[0]}`
        : "")

    // Check if element is hidden
    if (
      computed.display === "none" ||
      computed.visibility === "hidden" ||
      computed.opacity === "0"
    ) {
      element.style.outline = "2px solid #ff6b6b"
      element.setAttribute("data-ad-auditor-optout-highlight", "true")

      issues.push({
        element: elementDesc.substring(0, 50),
        issueType: "hidden",
        details: "Opt-out element is hidden (display/visibility/opacity)",
        htmlElement: element
      })
      continue
    }

    // Check contrast ratio
    const textColor = parseColor(computed.color)
    if (!textColor) continue
    const bg = resolveBackground(element)

    if (bg.kind === "unverifiable") {
      element.style.outline = "2px solid #74b9ff"
      element.setAttribute("data-ad-auditor-optout-highlight", "true")
      issues.push({
        element: elementDesc.substring(0, 50),
        issueType: "contrast-unverifiable",
        details: `Contrast could not be verified automatically (${bg.reason}); check manually`,
        htmlElement: element
      })
      continue
    }

    const contrastRatio = getTextContrast(textColor, bg.color)
    if (contrastRatio < MIN_CONTRAST_RATIO) {
      element.style.outline = "2px solid #f9ca24"
      element.setAttribute("data-ad-auditor-optout-highlight", "true")

      issues.push({
        element: elementDesc.substring(0, 50),
        issueType: "low-contrast",
        contrastRatio: Math.round(contrastRatio * 100) / 100,
        details: `Contrast ratio ${contrastRatio.toFixed(2)}:1 is below WCAG AA minimum (${MIN_CONTRAST_RATIO}:1)`,
        htmlElement: element
      })
    }
  }

  return issues
}

export const clearOptOutHighlights = () => {
  const highlighted = document.querySelectorAll(
    "[data-ad-auditor-optout-highlight]"
  )
  highlighted.forEach((el) => {
    const htmlEl = el as HTMLElement
    htmlEl.style.outline = ""
    htmlEl.removeAttribute("data-ad-auditor-optout-highlight")
  })
}

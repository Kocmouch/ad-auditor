export type OptOutIssue = {
  element: string
  issueType: "missing" | "low-contrast" | "hidden"
  contrastRatio?: number
  details: string
  htmlElement?: HTMLElement
}

const MIN_CONTRAST_RATIO = 4.5

// Calculate relative luminance (WCAG formula)
const getLuminance = (r: number, g: number, b: number): number => {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const val = c / 255
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

// Calculate contrast ratio between two colors
const getContrastRatio = (
  color1: { r: number; g: number; b: number },
  color2: { r: number; g: number; b: number }
): number => {
  const lum1 = getLuminance(color1.r, color1.g, color1.b)
  const lum2 = getLuminance(color2.r, color2.g, color2.b)
  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)
  return (lighter + 0.05) / (darker + 0.05)
}

// Parse rgb/rgba color to object
const parseColor = (
  colorStr: string
): { r: number; g: number; b: number; a: number } | null => {
  const rgbaMatch = colorStr.match(
    /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/
  )
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1]),
      g: parseInt(rgbaMatch[2]),
      b: parseInt(rgbaMatch[3]),
      a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1
    }
  }

  const hexMatch = colorStr.match(/^#([0-9a-f]{6})$/i)
  if (hexMatch) {
    const hex = hexMatch[1]
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
      a: 1
    }
  }

  return null
}

// Get background color considering elements behind
const getEffectiveBackgroundColor = (
  element: HTMLElement
): { r: number; g: number; b: number } | null => {
  const computed = window.getComputedStyle(element)
  const bgColor = computed.backgroundColor

  const parsed = parseColor(bgColor)
  if (!parsed) {
    return null
  }

  // If fully opaque, return it
  if (parsed.a >= 0.99) {
    return { r: parsed.r, g: parsed.g, b: parsed.b }
  }

  // Try to get elements behind
  const rect = element.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  const elementsBelow = document.elementsFromPoint(centerX, centerY)
  const elementIndex = elementsBelow.indexOf(element)

  if (elementIndex !== -1 && elementIndex + 1 < elementsBelow.length) {
    const elementBelow = elementsBelow[elementIndex + 1] as HTMLElement
    const belowComputed = window.getComputedStyle(elementBelow)
    const belowBgColor = belowComputed.backgroundColor
    const belowParsed = parseColor(belowBgColor)

    if (belowParsed && belowParsed.a >= 0.99) {
      return { r: belowParsed.r, g: belowParsed.g, b: belowParsed.b }
    }
  }

  // Fallback: treat as white background if transparent
  if (parsed.a < 0.1) {
    return { r: 255, g: 255, b: 255 }
  }

  return { r: parsed.r, g: parsed.g, b: parsed.b }
}

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
    const bgColor = getEffectiveBackgroundColor(element)

    if (textColor && bgColor) {
      const contrastRatio = getContrastRatio(
        { r: textColor.r, g: textColor.g, b: textColor.b },
        { r: bgColor.r, g: bgColor.g, b: bgColor.b }
      )

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

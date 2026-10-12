export type FontMismatch = {
  element: string
  declared: string
  rendered: string
  htmlElement?: HTMLElement
}

const SYSTEM_FONTS = [
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded"
]

export const checkFontsInDocument = (): FontMismatch[] => {
  const mismatches: FontMismatch[] = []
  const allElements = document.querySelectorAll("*")

  // Remove previous highlights
  const previouslyHighlighted = document.querySelectorAll('[data-ad-auditor-font-highlight]')
  previouslyHighlighted.forEach((el) => {
    const htmlEl = el as HTMLElement
    htmlEl.style.border = ''
    htmlEl.style.backgroundImage = ''
    htmlEl.style.backgroundOrigin = ''
    htmlEl.style.backgroundClip = ''
    htmlEl.removeAttribute('data-ad-auditor-font-highlight')
  })

  // Helper function to check if element has direct text content (not just from children)
  const hasDirectTextContent = (element: Element): boolean => {
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
        return true
      }
    }
    return false
  }

  // Helper function to check if element has any child elements with text
  const hasTextInChildren = (element: Element): boolean => {
    for (const child of element.children) {
      if (child.textContent?.trim()) {
        return true
      }
    }
    return false
  }

  for (const element of allElements) {
    if (element.tagName.toLowerCase() === "html") {
      continue
    }

    if (!element.textContent?.trim()) {
      continue
    }

    // Skip if element has children with text (not a leaf node)
    // We only want to highlight the deepest elements that contain text
    if (hasTextInChildren(element) && !hasDirectTextContent(element)) {
      continue
    }

    const computed = window.getComputedStyle(element)

    // Only skip if visibility is hidden, but allow display: none
    // because elements might be shown/hidden dynamically (e.g., price swapping)
    if (computed.visibility === "hidden") {
      continue
    }

    const declaredFontFamily = computed.fontFamily

    if (!declaredFontFamily || declaredFontFamily === "inherit") {
      continue
    }

    const firstDeclaredFont = declaredFontFamily.split(",")[0].trim().replace(/['"]/g, "")

    if (SYSTEM_FONTS.includes(firstDeclaredFont.toLowerCase())) {
      continue
    }

    try {
      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")
      if (!context) {
        continue
      }

      const fontSize = computed.fontSize
      const fontWeight = computed.fontWeight
      const testText = "ABCDEFGabcdefg123456"

      context.font = `${fontWeight} ${fontSize} ${declaredFontFamily}`
      const declaredWidth = context.measureText(testText).width

      let renderedFallback = null
      for (const fallback of SYSTEM_FONTS) {
        context.font = `${fontWeight} ${fontSize} ${fallback}`
        const fallbackWidth = context.measureText(testText).width

        if (Math.abs(declaredWidth - fallbackWidth) < 1) {
          renderedFallback = fallback
          break
        }
      }

      if (renderedFallback) {
        const elementDesc =
          element.tagName.toLowerCase() +
          (element.id ? `#${element.id}` : "") +
          (element.className && typeof element.className === "string"
            ? `.${element.className.split(" ")[0]}`
            : "")

        // Add gradient border highlight
        const htmlElement = element as HTMLElement
        const originalBackground = htmlElement.style.backgroundImage || 'none'
        htmlElement.style.border = '1px solid transparent'
        htmlElement.style.backgroundImage = `
          ${originalBackground === 'none' ? 'linear-gradient(rgba(255,255,255,0), rgba(255,255,255,0))' : originalBackground},
          linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #f9ca24, #6c5ce7)
        `
        htmlElement.style.backgroundOrigin = 'border-box'
        htmlElement.style.backgroundClip = 'padding-box, border-box'
        htmlElement.setAttribute('data-ad-auditor-font-highlight', 'true')

        mismatches.push({
          element: elementDesc.substring(0, 50),
          declared: `${firstDeclaredFont} ${fontWeight}`,
          rendered: renderedFallback,
          htmlElement
        })
      }
    } catch {
      continue
    }
  }

  const seen = new Set<string>()
  const unique = mismatches.filter((item) => {
    const key = `${item.declared}`
    if (seen.has(key)) {
      // Don't add to unique list for panel, but keep the highlight
      return false
    }
    seen.add(key)
    return true
  })

  // Return unique list for the panel (deduplicated by font)
  // But all elements in mismatches array are already highlighted
  return unique.slice(0, 10)
}

export const clearFontHighlights = () => {
  const highlighted = document.querySelectorAll('[data-ad-auditor-font-highlight]')
  highlighted.forEach((el) => {
    const htmlEl = el as HTMLElement
    htmlEl.style.border = ''
    htmlEl.style.backgroundImage = ''
    htmlEl.style.backgroundOrigin = ''
    htmlEl.style.backgroundClip = ''
    htmlEl.removeAttribute('data-ad-auditor-font-highlight')
  })
}

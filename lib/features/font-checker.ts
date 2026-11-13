import {
  addHighlight,
  clearHighlights,
  HIGHLIGHT_LAYER_ID
} from "~lib/ui/highlight"

const FONT_GROUP = "font"

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

  clearHighlights(FONT_GROUP)

  const hasDirectTextContent = (element: Element): boolean => {
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
        return true
      }
    }
    return false
  }

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

    if (element.closest(`#${HIGHLIGHT_LAYER_ID}`)) {
      continue
    }

    if (!element.textContent?.trim()) {
      continue
    }

    if (hasTextInChildren(element) && !hasDirectTextContent(element)) {
      continue
    }

    const computed = window.getComputedStyle(element)

    if (computed.visibility === "hidden") {
      continue
    }

    const declaredFontFamily = computed.fontFamily

    if (!declaredFontFamily || declaredFontFamily === "inherit") {
      continue
    }

    const firstDeclaredFont = declaredFontFamily
      .split(",")[0]
      .trim()
      .replace(/['"]/g, "")

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

        const htmlElement = element as HTMLElement
        addHighlight(htmlElement, {
          severity: "warning",
          label: "Font fallback",
          group: FONT_GROUP
        })

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
      return false
    }
    seen.add(key)
    return true
  })

  return unique.slice(0, 10)
}

export const clearFontHighlights = () => clearHighlights(FONT_GROUP)

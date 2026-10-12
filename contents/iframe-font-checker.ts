import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

type FontMismatch = {
  element: string
  declared: string
  rendered: string
}

const checkFontsInDocument = (): FontMismatch[] => {
  const systemFonts = [
    "Arial",
    "Times New Roman",
    "Courier New",
    "Georgia",
    "Verdana",
    "serif",
    "sans-serif",
    "monospace"
  ]

  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    return []
  }

  const testText = "mmmmmmmmmmlli"
  const fontSize = 72

  const getWidth = (font: string): number => {
    ctx.font = `${fontSize}px ${font}`
    return ctx.measureText(testText).width
  }

  const systemWidths = new Map<string, number>()
  for (const font of systemFonts) {
    systemWidths.set(font, getWidth(font))
  }

  const mismatches: FontMismatch[] = []
  const elements = document.querySelectorAll("*")

  for (const el of elements) {
    if (!(el instanceof HTMLElement)) {
      continue
    }

    // Skip html element
    if (el.tagName.toLowerCase() === "html") {
      continue
    }

    try {
      const computed = window.getComputedStyle(el)
      const fontFamily = computed.fontFamily
      const fontWeight = computed.fontWeight || "400"

      if (!fontFamily || fontFamily === "inherit") {
        continue
      }

      const fonts = fontFamily
        .split(",")
        .map((f) => f.trim().replace(/['"]/g, ""))

      if (fonts.length === 0) {
        continue
      }

      const firstDeclaredFont = fonts[0]
      if (systemFonts.includes(firstDeclaredFont)) {
        continue
      }

      const declaredWidth = getWidth(`${fontWeight} ${firstDeclaredFont}`)
      let renderedFallback = "unknown"

      for (const [sysFont, sysWidth] of systemWidths.entries()) {
        if (Math.abs(declaredWidth - sysWidth) < 0.1) {
          renderedFallback = sysFont
          break
        }
      }

      if (renderedFallback !== "unknown") {
        const elementDesc =
          el.tagName.toLowerCase() +
          (el.className ? `.${el.className.split(" ")[0]}` : "") +
          (el.id ? `#${el.id}` : "")

        mismatches.push({
          element: elementDesc.substring(0, 50),
          declared: `${firstDeclaredFont} ${fontWeight}`,
          rendered: renderedFallback
        })
      }
    } catch (e) {
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

// Only run in iframes, not on main page
if (window.self !== window.top) {
  window.addEventListener("message", (event) => {
    if (event.data?.type === "ad-auditor-check-fonts-request") {
      const fontMismatches = checkFontsInDocument()

      window.parent.postMessage(
        {
          type: "ad-auditor-check-fonts-response",
          fontMismatches: fontMismatches,
          iframeUrl: window.location.href
        },
        "*"
      )
    }
  })
}

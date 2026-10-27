export type BorderIssue = {
  element: string
  issueType: "missing" | "invisible"
  details: string
  htmlElement?: HTMLElement
}

// Check if border is visible (has sufficient contrast with background)
const isBorderVisible = (
  borderColor: string,
  backgroundColor: string
): { visible: boolean; contrast: number } => {
  const parseColor = (color: string): number[] | null => {
    const rgbaMatch = color.match(
      /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/
    )
    if (rgbaMatch) {
      return [
        parseInt(rgbaMatch[1]),
        parseInt(rgbaMatch[2]),
        parseInt(rgbaMatch[3]),
        rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1
      ]
    }

    const hexMatch = color.match(/^#([0-9a-f]{6})$/i)
    if (hexMatch) {
      const hex = hexMatch[1]
      return [
        parseInt(hex.substring(0, 2), 16),
        parseInt(hex.substring(2, 4), 16),
        parseInt(hex.substring(4, 6), 16),
        1
      ]
    }

    return null
  }

  const borderRgba = parseColor(borderColor)
  const bgRgba = parseColor(backgroundColor)

  if (!borderRgba || !bgRgba) {
    return { visible: false, contrast: 0 }
  }

  // If border is transparent, it's not visible
  if (borderRgba[3] < 0.3) {
    return { visible: false, contrast: 0 }
  }

  // Calculate color difference (0-765 range, 255*3)
  const diff =
    Math.abs(borderRgba[0] - bgRgba[0]) +
    Math.abs(borderRgba[1] - bgRgba[1]) +
    Math.abs(borderRgba[2] - bgRgba[2])

  // For ad banners, even subtle borders are intentional
  // Lower threshold: #fff vs #dedede = diff of ~33, which should pass
  // Threshold of 20 allows for subtle but visible borders
  const visible = diff > 20

  return { visible, contrast: diff }
}

export const checkBorderElements = (): BorderIssue[] => {
  const issues: BorderIssue[] = []

  // Clear previous highlights
  const previouslyHighlighted = document.querySelectorAll(
    "[data-ad-auditor-border-highlight]"
  )
  previouslyHighlighted.forEach((el) => {
    const htmlEl = el as HTMLElement
    htmlEl.style.boxShadow = ""
    htmlEl.removeAttribute("data-ad-auditor-border-highlight")
  })

  // Find .banner elements (main banner container)
  const bannerElements = document.querySelectorAll(".banner")

  if (bannerElements.length === 0) {
    // No .banner found - report as missing
    issues.push({
      element: "document",
      issueType: "missing",
      details: "No .banner element found in iframe",
      htmlElement: undefined
    })
    return issues
  }

  for (const banner of bannerElements) {
    if (!(banner instanceof HTMLElement)) {
      continue
    }

    const elementDesc =
      banner.tagName.toLowerCase() +
      (banner.id ? `#${banner.id}` : "") +
      (banner.className && typeof banner.className === "string"
        ? `.${banner.className.split(" ")[0]}`
        : "")

    let hasBorder = false
    let borderIssueFound = false

    // Method 1: Check .banner:after or .banner:before pseudo-element for border
    try {
      const afterStyle = window.getComputedStyle(banner, "::after")
      const afterContent = afterStyle.content
      // content: "" is valid (empty string shows as '""' in computed style)
      if (afterContent && afterContent !== "none") {
        const afterBorderWidth = parseFloat(afterStyle.borderWidth || "0")
        const afterBorderStyle = afterStyle.borderStyle
        const afterBorderColor = afterStyle.borderColor

        if (
          afterBorderWidth >= 1 &&
          afterBorderStyle !== "none" &&
          afterBorderStyle !== "hidden"
        ) {
          hasBorder = true
          const bannerBg = window.getComputedStyle(banner).backgroundColor
          const visibilityCheck = isBorderVisible(afterBorderColor, bannerBg)

          if (!visibilityCheck.visible) {
            borderIssueFound = true
            banner.style.boxShadow = "0 0 0 2px #f9ca24 inset"
            banner.setAttribute("data-ad-auditor-border-highlight", "true")

            issues.push({
              element: `${elementDesc}::after`,
              issueType: "invisible",
              details: `Pseudo-element border exists but is not visible (border: ${afterBorderColor}, background: ${bannerBg}, contrast: ${visibilityCheck.contrast})`,
              htmlElement: banner
            })
          }
        }
      }
    } catch {
      // Pseudo-element might not exist
    }

    // Also check ::before
    try {
      const beforeStyle = window.getComputedStyle(banner, "::before")
      const beforeContent = beforeStyle.content
      // content: "" is valid (empty string shows as '""' in computed style)
      if (beforeContent && beforeContent !== "none") {
        const beforeBorderWidth = parseFloat(beforeStyle.borderWidth || "0")
        const beforeBorderStyle = beforeStyle.borderStyle
        const beforeBorderColor = beforeStyle.borderColor

        if (
          beforeBorderWidth >= 1 &&
          beforeBorderStyle !== "none" &&
          beforeBorderStyle !== "hidden"
        ) {
          hasBorder = true
          const bannerBg = window.getComputedStyle(banner).backgroundColor
          const visibilityCheck = isBorderVisible(beforeBorderColor, bannerBg)

          if (!visibilityCheck.visible) {
            borderIssueFound = true
            banner.style.boxShadow = "0 0 0 2px #f9ca24 inset"
            banner.setAttribute("data-ad-auditor-border-highlight", "true")

            issues.push({
              element: `${elementDesc}::before`,
              issueType: "invisible",
              details: `Pseudo-element border exists but is not visible (border: ${beforeBorderColor}, background: ${bannerBg}, contrast: ${visibilityCheck.contrast})`,
              htmlElement: banner
            })
          }
        }
      }
    } catch {
      // Pseudo-element might not exist
    }

    // Method 2: Check for .border-container as child of .banner
    const borderContainer = banner.querySelector(".border-container")
    if (borderContainer instanceof HTMLElement) {
      const computed = window.getComputedStyle(borderContainer)
      const borderWidth = parseFloat(computed.borderWidth || "0")
      const borderStyle = computed.borderStyle
      const borderColor = computed.borderColor

      if (
        borderWidth >= 1 &&
        borderStyle !== "none" &&
        borderStyle !== "hidden"
      ) {
        hasBorder = true
        const bannerBg = window.getComputedStyle(banner).backgroundColor
        const visibilityCheck = isBorderVisible(borderColor, bannerBg)

        if (!visibilityCheck.visible) {
          borderIssueFound = true
          banner.style.boxShadow = "0 0 0 2px #f9ca24 inset"
          banner.setAttribute("data-ad-auditor-border-highlight", "true")

          issues.push({
            element: `${elementDesc} > .border-container`,
            issueType: "invisible",
            details: `Border container exists but border is not visible (border: ${borderColor}, background: ${bannerBg}, contrast: ${visibilityCheck.contrast})`,
            htmlElement: banner
          })
        }
      }
    }

    // If no border found via either method
    if (!hasBorder && !borderIssueFound) {
      banner.style.boxShadow = "0 0 0 2px #ff6b6b inset"
      banner.setAttribute("data-ad-auditor-border-highlight", "true")

      issues.push({
        element: elementDesc.substring(0, 50),
        issueType: "missing",
        details:
          "No banner border found (expected .banner::after with border OR .border-container child)",
        htmlElement: banner
      })
    }
  }

  return issues
}

export const clearBorderHighlights = () => {
  const highlighted = document.querySelectorAll(
    "[data-ad-auditor-border-highlight]"
  )
  highlighted.forEach((el) => {
    const htmlEl = el as HTMLElement
    htmlEl.style.boxShadow = ""
    htmlEl.removeAttribute("data-ad-auditor-border-highlight")
  })
}

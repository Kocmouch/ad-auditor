import { addHighlight, clearHighlights } from "~lib/ui/highlight"
import { compositeOver, parseColor, resolveBackground } from "~lib/utils/color"
import type { RGB } from "~lib/utils/color"

const BORDER_GROUP = "border"

export type BorderIssue = {
  element: string
  issueType: "missing" | "invisible"
  details: string
  htmlElement?: HTMLElement
}

// Check if border is visible (has sufficient difference from background)
export const isBorderVisible = (
  borderColor: string,
  background: RGB
): { visible: boolean; contrast: number } => {
  // computed borderColor may list several colors ("rgb(..) rgb(..)"); use the first
  const first = borderColor.match(/rgba?\([^)]*\)|#[0-9a-f]+|transparent/i)
  const border = parseColor(first ? first[0] : borderColor)
  if (!border) {
    return { visible: false, contrast: 0 }
  }

  // Nearly transparent border is not visible
  if (border.a < 0.3) {
    return { visible: false, contrast: 0 }
  }

  const flat = compositeOver(border, { ...background, a: 1 })
  // Color difference (0-765 range, 255*3)
  const diff = Math.round(
    Math.abs(flat.r - background.r) +
      Math.abs(flat.g - background.g) +
      Math.abs(flat.b - background.b)
  )

  // For ad banners even subtle borders are intentional (#fff vs #dedede passes)
  return { visible: diff > 20, contrast: diff }
}

// Returns null when the background can't be determined (image/gradient)
const checkBorderVisibility = (
  borderColor: string,
  banner: HTMLElement
): { visible: boolean; contrast: number; bg: string } | null => {
  const bg = resolveBackground(banner)
  if (bg.kind === "unverifiable") return null
  const c = bg.color
  return {
    ...isBorderVisible(borderColor, c),
    bg: `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`
  }
}

export const checkBorderElements = (): BorderIssue[] => {
  const issues: BorderIssue[] = []

  clearHighlights(BORDER_GROUP)

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
        const afterBorderColor =
          afterStyle.borderTopColor || afterStyle.borderColor

        if (
          afterBorderWidth >= 1 &&
          afterBorderStyle !== "none" &&
          afterBorderStyle !== "hidden"
        ) {
          hasBorder = true
          const visibilityCheck = checkBorderVisibility(
            afterBorderColor,
            banner
          )

          if (visibilityCheck && !visibilityCheck.visible) {
            borderIssueFound = true
            addHighlight(banner, {
              severity: "warning",
              label: "Border weak",
              group: BORDER_GROUP
            })

            issues.push({
              element: `${elementDesc}::after`,
              issueType: "invisible",
              details: `Pseudo-element border exists but is not visible (border: ${afterBorderColor}, background: ${visibilityCheck.bg}, contrast: ${visibilityCheck.contrast})`,
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
        const beforeBorderColor =
          beforeStyle.borderTopColor || beforeStyle.borderColor

        if (
          beforeBorderWidth >= 1 &&
          beforeBorderStyle !== "none" &&
          beforeBorderStyle !== "hidden"
        ) {
          hasBorder = true
          const visibilityCheck = checkBorderVisibility(
            beforeBorderColor,
            banner
          )

          if (visibilityCheck && !visibilityCheck.visible) {
            borderIssueFound = true
            addHighlight(banner, {
              severity: "warning",
              label: "Border weak",
              group: BORDER_GROUP
            })

            issues.push({
              element: `${elementDesc}::before`,
              issueType: "invisible",
              details: `Pseudo-element border exists but is not visible (border: ${beforeBorderColor}, background: ${visibilityCheck.bg}, contrast: ${visibilityCheck.contrast})`,
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
      const borderColor = computed.borderTopColor || computed.borderColor

      if (
        borderWidth >= 1 &&
        borderStyle !== "none" &&
        borderStyle !== "hidden"
      ) {
        hasBorder = true
        const visibilityCheck = checkBorderVisibility(borderColor, banner)

        if (visibilityCheck && !visibilityCheck.visible) {
          borderIssueFound = true
          addHighlight(banner, {
            severity: "warning",
            label: "Border weak",
            group: BORDER_GROUP
          })

          issues.push({
            element: `${elementDesc} > .border-container`,
            issueType: "invisible",
            details: `Border container exists but border is not visible (border: ${borderColor}, background: ${visibilityCheck.bg}, contrast: ${visibilityCheck.contrast})`,
            htmlElement: banner
          })
        }
      }
    }

    // If no border found via either method
    if (!hasBorder && !borderIssueFound) {
      addHighlight(banner, {
        severity: "error",
        label: "Border missing",
        group: BORDER_GROUP
      })

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

export const clearBorderHighlights = () => clearHighlights(BORDER_GROUP)

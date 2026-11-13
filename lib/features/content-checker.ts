import { checkImagesInDocument } from "~lib/features/image-checker"
import { checkLinksInDocument } from "~lib/features/link-checker"
import { addHighlight, clearHighlights } from "~lib/ui/highlight"

export const IMAGES_GROUP = "images"
export const LINKS_GROUP = "links"

export type ContentCategory = "images" | "links"
export type ContentSeverity = "error" | "warning" | "info"

export type ContentIssue = {
  category: ContentCategory
  kind: string
  severity: ContentSeverity
  message: string
  /** Not cloneable; stays in the iframe. Issues are focused by index. */
  element?: HTMLElement
}

export type ContentCheckResult = {
  issues: ContentIssue[]
  summary: { total: number; errors: number; warnings: number; infos: number }
}

const MAX_LABEL_LENGTH = 40

export const shortLabel = (message: string): string =>
  message.length > MAX_LABEL_LENGTH
    ? `${message.slice(0, MAX_LABEL_LENGTH - 1)}…`
    : message

export const clearContentHighlights = () => {
  clearHighlights(IMAGES_GROUP)
  clearHighlights(LINKS_GROUP)
}

/** Runs the image and link checkers and highlights the offending elements. */
export const runContentChecks = (
  doc: Document = document
): ContentCheckResult => {
  clearContentHighlights()

  const issues: ContentIssue[] = [
    ...checkImagesInDocument(doc).issues.map(
      ({ element, kind, message, severity }): ContentIssue => ({
        category: "images",
        element,
        kind,
        message,
        severity
      })
    ),
    ...checkLinksInDocument(doc).issues.map(
      ({ element, kind, message, severity }): ContentIssue => ({
        category: "links",
        element,
        kind,
        message,
        severity
      })
    )
  ]

  for (const issue of issues) {
    if (issue.element) {
      addHighlight(issue.element, {
        group: issue.category === "images" ? IMAGES_GROUP : LINKS_GROUP,
        label: shortLabel(issue.message),
        severity: issue.severity
      })
    }
  }

  const count = (severity: ContentSeverity) =>
    issues.filter((issue) => issue.severity === severity).length
  return {
    issues,
    summary: {
      errors: count("error"),
      infos: count("info"),
      total: issues.length,
      warnings: count("warning")
    }
  }
}

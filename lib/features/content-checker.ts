import { checkImagesInDocument } from "~lib/features/image-checker"
import { checkLinksInDocument } from "~lib/features/link-checker"
import { checkTemplateLeaks } from "~lib/features/template-leak-checker"
import { addHighlight, clearHighlights } from "~lib/ui/highlight"

export const IMAGES_GROUP = "images"
export const LINKS_GROUP = "links"
export const TEMPLATE_GROUP = "template"

export type ContentCategory = "images" | "links" | "template"
export type ContentSeverity = "error" | "warning" | "info"

export type ContentIssue = {
  category: ContentCategory
  kind: string
  severity: ContentSeverity
  message: string
  /** Not cloneable; stays in the iframe. Issues are focused by index. */
  element?: HTMLElement
}

export type IssueSummary = {
  total: number
  errors: number
  warnings: number
  infos: number
}

export type ContentCheckResult = {
  issues: ContentIssue[]
  summary: IssueSummary
}

const MAX_LABEL_LENGTH = 40

export const shortLabel = (message: string): string =>
  message.length > MAX_LABEL_LENGTH
    ? `${message.slice(0, MAX_LABEL_LENGTH - 1)}…`
    : message

/** Draws a severity highlight for every issue that has an element. */
export const highlightIssues = <
  T extends {
    element?: HTMLElement
    message: string
    severity: ContentSeverity
  }
>(
  issues: T[],
  groupOf: (issue: T) => string
) => {
  for (const issue of issues) {
    if (issue.element) {
      addHighlight(issue.element, {
        group: groupOf(issue),
        label: shortLabel(issue.message),
        severity: issue.severity
      })
    }
  }
}

export const summarizeIssues = (
  issues: ReadonlyArray<{ severity: ContentSeverity }>
): IssueSummary => {
  const count = (severity: ContentSeverity) =>
    issues.filter((issue) => issue.severity === severity).length
  return {
    errors: count("error"),
    infos: count("info"),
    total: issues.length,
    warnings: count("warning")
  }
}

const GROUPS: Record<ContentCategory, string> = {
  images: IMAGES_GROUP,
  links: LINKS_GROUP,
  template: TEMPLATE_GROUP
}

export const clearContentHighlights = () => {
  for (const group of Object.values(GROUPS)) {
    clearHighlights(group)
  }
}

type RawIssue = {
  element?: HTMLElement
  kind: string
  message: string
  severity: ContentSeverity
}

const tag =
  (category: ContentCategory) =>
  ({ element, kind, message, severity }: RawIssue): ContentIssue => ({
    category,
    element,
    kind,
    message,
    severity
  })

/** Runs the image, link and template-leak checkers and highlights elements. */
export const runContentChecks = (
  doc: Document = document
): ContentCheckResult => {
  clearContentHighlights()

  const issues: ContentIssue[] = [
    ...checkImagesInDocument(doc).issues.map(tag("images")),
    ...checkLinksInDocument(doc).issues.map(tag("links")),
    ...checkTemplateLeaks(doc).issues.map(tag("template"))
  ]

  highlightIssues(issues, (issue) => GROUPS[issue.category])
  return { issues, summary: summarizeIssues(issues) }
}

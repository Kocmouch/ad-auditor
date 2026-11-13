import { checkAnimations } from "~lib/features/animation-checker"
import { checkClickability } from "~lib/features/click-checker"
import {
  highlightIssues,
  summarizeIssues,
  type ContentSeverity,
  type IssueSummary
} from "~lib/features/content-checker"
import { checkStructure } from "~lib/features/structure-checker"
import { clearHighlights } from "~lib/ui/highlight"
import type { Rect } from "~lib/utils/banner-bounds"

export const STRUCTURE_GROUP = "structure"
export const CLICKS_GROUP = "clicks"
export const ANIMATIONS_GROUP = "animations"

export type QualityCategory = "structure" | "clicks" | "animations"

export type QualityIssue = {
  category: QualityCategory
  kind: string
  severity: ContentSeverity
  message: string
  /** Not cloneable; stays in the iframe. Issues are focused by index. */
  element?: HTMLElement
}

export type QualityCheckResult = {
  issues: QualityIssue[]
  /** Share of the banner area that is clickable (0-100). */
  coveragePercent: number
  summary: IssueSummary
}

const GROUPS: Record<QualityCategory, string> = {
  animations: ANIMATIONS_GROUP,
  clicks: CLICKS_GROUP,
  structure: STRUCTURE_GROUP
}

export const clearQualityHighlights = () => {
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
  (category: QualityCategory) =>
  ({ element, kind, message, severity }: RawIssue): QualityIssue => ({
    category,
    element,
    kind,
    message,
    severity
  })

/**
 * Runs structure, clickability and animation checks and highlights elements.
 * `bounds` is the banner rectangle in standalone mode (the window is larger
 * than the banner); leave it undefined inside ad iframes.
 */
export const runQualityChecks = (
  doc: Document = document,
  bounds?: Rect
): QualityCheckResult => {
  clearQualityHighlights()

  const options = bounds ? { bounds } : {}
  const clicks = checkClickability(doc, options)
  const issues: QualityIssue[] = [
    ...checkStructure(doc, options).issues.map(tag("structure")),
    ...clicks.issues.map(tag("clicks")),
    ...checkAnimations(doc).issues.map(tag("animations"))
  ]

  highlightIssues(issues, (issue) => GROUPS[issue.category])
  return {
    coveragePercent: clicks.coverage.percent,
    issues,
    summary: summarizeIssues(issues)
  }
}

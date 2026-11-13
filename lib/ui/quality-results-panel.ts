import type { WireQualityIssue } from "~lib/messaging"
import {
  createIssuesPanel,
  type ContentPanelHandlers
} from "~lib/ui/content-results-panel"
import type { Theme } from "~lib/ui/theme"

/** Header text for the click coverage, or undefined when unknown. */
export const formatCoverage = (
  coveragePercent: number | null
): string | undefined =>
  coveragePercent === null
    ? undefined
    : `Click coverage: ${Math.round(coveragePercent)}%`

/** Results panel for the structure + clickability + animation ("Quality") check. */
export const createQualityResultsPanel = (
  issues: WireQualityIssue[],
  coveragePercent: number | null,
  theme: Theme,
  handlers: ContentPanelHandlers
): HTMLDivElement =>
  createIssuesPanel(issues, theme, handlers, {
    emptyText: "✓ No structure, click or animation issues detected",
    id: "ad-auditor-quality-check-results",
    right: "max(20px, min(460px, calc(100vw - 440px)))",
    subtitle: formatCoverage(coveragePercent),
    title: "Quality Check Results"
  })

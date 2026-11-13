import type { LimitMetric } from "~lib/types/settings"
import { getUsageColor } from "~lib/usage-color"

const NEUTRAL_COLOR = "#ffffff"

export type UsageColors = {
  resources: string
  transferred: string
}

/** Colour the tracked metric by usage; the other value stays white. */
export const getUsageColors = (
  metric: LimitMetric,
  totals: { resources: number; transferred: number },
  limitBytes: number
): UsageColors => {
  if (metric === "resources") {
    return {
      resources: getUsageColor(totals.resources, limitBytes),
      transferred: NEUTRAL_COLOR
    }
  }

  return {
    resources: NEUTRAL_COLOR,
    transferred: getUsageColor(totals.transferred, limitBytes)
  }
}

export const NO_ISSUES_ALERT = "No obvious network issues detected."

/** The standalone badge hides the "all clear" message; the overlay shows it. */
export const hasNetworkAlerts = (alerts: string[]): boolean =>
  alerts.length > 0 && alerts[0] !== NO_ISSUES_ALERT

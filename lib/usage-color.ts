export const getUsageColor = (value: number, limit: number): string => {
  if (!Number.isFinite(value) || !Number.isFinite(limit) || limit <= 0) {
    return "#7dff6a"
  }

  const ratio = value / limit
  const clamped = Math.min(Math.max(ratio, 0), 1)
  const hue = Math.round(120 * (1 - clamped))
  return `hsl(${hue} 90% 58%)`
}

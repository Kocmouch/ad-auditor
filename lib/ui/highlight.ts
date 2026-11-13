/**
 * Shared element highlighting for checkers. Never touches the audited
 * element: boxes are drawn in a single fixed overlay layer appended to
 * document.documentElement and repositioned from getBoundingClientRect.
 */

import { Z_INDEX } from "~lib/ui/theme"

export type HighlightSeverity = "error" | "warning" | "info"

export type HighlightOptions = {
  severity: HighlightSeverity
  label?: string
  /** Independent clear scope, e.g. "font" | "optout" | "border" */
  group?: string
}

export type HighlightHandle = {
  element: Element
  group: string
  remove: () => void
}

export const HIGHLIGHT_LAYER_ID = "ad-auditor-highlight-layer"
export const DEFAULT_HIGHLIGHT_GROUP = "default"

export const SEVERITY_COLORS: Record<
  HighlightSeverity,
  { color: string; fill: string; badgeText: string }
> = {
  error: {
    color: "#ef4444",
    fill: "rgba(239,68,68,0.12)",
    badgeText: "#ffffff"
  },
  warning: {
    color: "#f59e0b",
    fill: "rgba(245,158,11,0.12)",
    badgeText: "#111827"
  },
  info: {
    color: "#3b82f6",
    fill: "rgba(59,130,246,0.12)",
    badgeText: "#ffffff"
  }
}

type Entry = {
  element: Element
  group: string
  severity: HighlightSeverity
  label: string
  index: number
  box: HTMLDivElement
  badge: HTMLDivElement
}

const BADGE_HEIGHT = 18
const entries = new Set<Entry>()
const counters = new Map<string, number>()
let layer: HTMLDivElement | null = null
let resizeObserver: ResizeObserver | null = null
let rafId: number | null = null
let listening = false

const STYLE_TEXT = `
@keyframes ad-auditor-hl-pulse { 0%,100% { opacity: 1 } 50% { opacity: .55 } }
@keyframes ad-auditor-hl-flash { 0%,100% { transform: scale(1) } 50% { transform: scale(1.03) } }
.ad-auditor-hl-error { animation: ad-auditor-hl-pulse 1.6s ease-in-out infinite }
.ad-auditor-hl-flash { animation: ad-auditor-hl-flash .35s ease-in-out 3 }
@media (prefers-reduced-motion: reduce) {
  .ad-auditor-hl-error, .ad-auditor-hl-flash { animation: none !important }
}
`

const ensureLayer = (): HTMLDivElement => {
  if (layer && layer.isConnected) return layer
  const el = document.createElement("div")
  el.id = HIGHLIGHT_LAYER_ID
  el.setAttribute("aria-hidden", "true")
  el.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:0;overflow:visible;" +
    `z-index:${Z_INDEX.highlight};pointer-events:none;`
  const style = document.createElement("style")
  style.textContent = STYLE_TEXT
  el.appendChild(style)
  document.documentElement.appendChild(el)
  layer = el
  // Re-observe tracked elements if the layer was recreated
  entries.forEach((e) => {
    el.appendChild(e.box)
    el.appendChild(e.badge)
  })
  return el
}

const positionEntry = (e: Entry) => {
  const rect = e.element.getBoundingClientRect()
  const hidden =
    !e.element.isConnected || (rect.width === 0 && rect.height === 0)
  const display = hidden ? "none" : "block"
  e.box.style.display = display
  e.badge.style.display = display
  if (hidden) return

  e.box.style.left = `${rect.left}px`
  e.box.style.top = `${rect.top}px`
  e.box.style.width = `${rect.width}px`
  e.box.style.height = `${rect.height}px`

  const vw = window.innerWidth || document.documentElement.clientWidth || 0
  const vh = window.innerHeight || document.documentElement.clientHeight || 0
  const badgeWidth = e.badge.offsetWidth || e.label.length * 6.5 + 16

  // Prefer sitting above the box; drop inside when there is no room.
  let top = rect.top - BADGE_HEIGHT
  if (top < 0) top = rect.top
  if (vh > 0) top = Math.min(top, Math.max(0, vh - BADGE_HEIGHT))
  top = Math.max(0, top)
  let left = rect.left
  if (vw > 0) left = Math.min(left, Math.max(0, vw - badgeWidth))
  left = Math.max(0, left)
  e.badge.style.left = `${left}px`
  e.badge.style.top = `${top}px`
}

export const updateHighlights = () => {
  rafId = null
  entries.forEach(positionEntry)
}

const scheduleUpdate = () => {
  if (rafId !== null) return
  if (typeof requestAnimationFrame === "function") {
    rafId = requestAnimationFrame(updateHighlights) as unknown as number
  } else {
    updateHighlights()
  }
}

const startTracking = () => {
  if (!listening) {
    window.addEventListener("scroll", scheduleUpdate, true)
    window.addEventListener("resize", scheduleUpdate)
    listening = true
  }
  if (!resizeObserver && typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(scheduleUpdate)
  }
}

const stopTrackingIfIdle = () => {
  if (entries.size > 0) return
  if (listening) {
    window.removeEventListener("scroll", scheduleUpdate, true)
    window.removeEventListener("resize", scheduleUpdate)
    listening = false
  }
  resizeObserver?.disconnect()
  resizeObserver = null
  if (rafId !== null && typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(rafId)
  }
  rafId = null
  layer?.remove()
  layer = null
}

const removeEntry = (e: Entry) => {
  if (!entries.delete(e)) return
  e.box.remove()
  e.badge.remove()
  resizeObserver?.unobserve(e.element)
  stopTrackingIfIdle()
}

/** Draw a highlight over `el`. Re-highlighting the same element in the same group replaces it. */
export const addHighlight = (
  el: Element,
  options: HighlightOptions
): HighlightHandle => {
  const group = options.group ?? DEFAULT_HIGHLIGHT_GROUP
  const severity = options.severity
  const colors = SEVERITY_COLORS[severity]

  entries.forEach((e) => {
    if (e.element === el && e.group === group) removeEntry(e)
  })

  const index = (counters.get(group) ?? 0) + 1
  counters.set(group, index)
  const label = options.label ? `${index} · ${options.label}` : String(index)

  const host = ensureLayer()
  startTracking()

  const box = document.createElement("div")
  box.setAttribute("data-highlight-group", group)
  box.setAttribute("data-highlight-severity", severity)
  box.style.cssText =
    `position:fixed;box-sizing:border-box;pointer-events:none;` +
    `border:2px solid ${colors.color};background:${colors.fill};border-radius:2px;`
  if (severity === "error") box.className = "ad-auditor-hl-error"

  const badge = document.createElement("div")
  badge.setAttribute("data-highlight-badge", "true")
  badge.textContent = label
  badge.style.cssText =
    `position:fixed;box-sizing:border-box;pointer-events:none;` +
    `height:${BADGE_HEIGHT}px;line-height:${BADGE_HEIGHT}px;padding:0 6px;` +
    `border-radius:3px;font:600 11px/${BADGE_HEIGHT}px system-ui,sans-serif;` +
    `white-space:nowrap;max-width:240px;overflow:hidden;text-overflow:ellipsis;` +
    `background:${colors.color};color:${colors.badgeText};`

  host.appendChild(box)
  host.appendChild(badge)

  const entry: Entry = {
    element: el,
    group,
    severity,
    label,
    index,
    box,
    badge
  }
  entries.add(entry)
  resizeObserver?.observe(el)
  positionEntry(entry)

  return { element: el, group, remove: () => removeEntry(entry) }
}

/** Remove highlights of one group, or every group when omitted. */
export const clearHighlights = (group?: string) => {
  entries.forEach((e) => {
    if (group === undefined || e.group === group) removeEntry(e)
  })
  if (group === undefined) counters.clear()
  else counters.delete(group)
}

export const clearAllHighlights = () => clearHighlights()

export const getHighlightCount = (group?: string): number => {
  let n = 0
  entries.forEach((e) => {
    if (group === undefined || e.group === group) n++
  })
  return n
}

/** Scroll `el` into view and briefly flash its highlight(s). Returns false if none exist. */
export const focusHighlight = (el: Element): boolean => {
  const matches = [...entries].filter((e) => e.element === el)
  if (matches.length === 0) return false
  try {
    el.scrollIntoView?.({ block: "center", inline: "nearest" })
  } catch {
    // ignore
  }
  scheduleUpdate()
  for (const e of matches) {
    e.box.classList.add("ad-auditor-hl-flash")
    setTimeout(() => e.box.classList.remove("ad-auditor-hl-flash"), 1100)
  }
  return true
}

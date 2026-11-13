import { isExtensionElement } from "~lib/utils/extension-dom"

/**
 * Animation checker: infinite loops, total animation length and animation count.
 *
 * Works from the Web Animations API (`document.getAnimations()`), which covers
 * CSS animations, CSS transitions and `element.animate()`. LIMITATION:
 * animations driven by JavaScript (jQuery `.animate()`, GSAP, requestAnimationFrame
 * loops, canvas) are invisible to this API and therefore are not checked.
 */

export type AnimationIssueSeverity = "error" | "warning" | "info"

export type AnimationIssueKind = "infinite" | "too-long" | "many-animations"

export type AnimationIssue = {
  kind: AnimationIssueKind
  severity: AnimationIssueSeverity
  message: string
  element?: HTMLElement
  /** Number of animations collapsed into this issue (only set when > 1). */
  count?: number
}

export type AnimationCheckResult = {
  issues: AnimationIssue[]
  summary: { total: number; errors: number; warnings: number }
  /** Longest finite animation (delay + duration * iterations + endDelay), seconds. */
  longestSeconds: number
  /** Number of infinite animations on visible targets. */
  infiniteCount: number
}

/** Minimal shape of an Animation the checker reads (eases faking in tests). */
export type AnimationLike = {
  animationName?: string
  transitionProperty?: string
  playState?: string
  effect?: {
    target?: unknown
    getTiming?: () => {
      delay?: number
      endDelay?: number
      duration?: unknown
      iterations?: number
    }
  } | null
}

export type AnimationCheckOptions = {
  /** Override animation source (default `doc.getAnimations?.()`). */
  getAnimations?: () => AnimationLike[]
}

export const MAX_ANIMATION_ISSUES = 30
/** Common IAB / Google Ads limit for total animation length. */
export const MAX_ANIMATION_SECONDS = 30
export const WARN_ANIMATION_SECONDS = 15
export const MAX_RUNNING_ANIMATIONS = 50
/** Names of tiny looping loaders/spinners, reported as info only. */
export const LOADER_PATTERN = /loader|spinner|progress/i

const SEVERITY_ORDER: Record<AnimationIssueSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2
}

const num = (value: unknown): number =>
  typeof value === "number" && !Number.isNaN(value) ? value : 0

const getTarget = (anim: AnimationLike): HTMLElement | undefined => {
  const target = anim.effect?.target as
    | (HTMLElement & { element?: HTMLElement })
    | null
    | undefined
  if (!target || typeof target !== "object") return undefined
  // Pseudo-element effects expose `element` in some engines; otherwise the target is the element.
  return (target as { tagName?: string }).tagName ? target : target.element
}

const isHidden = (element: HTMLElement, doc: Document): boolean => {
  const view = doc.defaultView
  if (!view) return false
  try {
    let current: HTMLElement | null = element
    while (current) {
      const style = view.getComputedStyle(current)
      if (style.display === "none") return true
      if (current === element) {
        if (style.visibility === "hidden" || style.visibility === "collapse") {
          return true
        }
        if (style.opacity === "0") return true
      }
      current = current.parentElement
    }
  } catch {
    return false
  }
  return false
}

const nameOf = (anim: AnimationLike): string =>
  anim.animationName || anim.transitionProperty || "(unnamed)"

const describeTarget = (element: HTMLElement | undefined): string => {
  if (!element) return "unknown element"
  let text = element.tagName.toLowerCase()
  if (element.id) text += `#${element.id}`
  const cls =
    typeof element.className === "string"
      ? element.className.trim().split(/\s+/).filter(Boolean)
      : []
  if (cls.length > 0) text += `.${cls.slice(0, 2).join(".")}`
  return text
}

const defaultGetAnimations = (doc: Document) => (): AnimationLike[] =>
  (typeof doc.getAnimations === "function"
    ? (doc.getAnimations() as unknown as AnimationLike[])
    : []) ?? []

export const checkAnimations = (
  doc: Document = document,
  options: AnimationCheckOptions = {}
): AnimationCheckResult => {
  let animations: AnimationLike[] = []
  try {
    animations = (options.getAnimations ?? defaultGetAnimations(doc))() ?? []
  } catch {
    animations = []
  }

  const issues: AnimationIssue[] = []
  let longestMs = 0
  let longestElement: HTMLElement | undefined
  let running = 0
  let infiniteCount = 0
  const infiniteGroups = new Map<
    string,
    { count: number; first: HTMLElement | undefined }
  >()

  for (const anim of animations) {
    if (!anim) continue
    // Skip the extension's own UI and Plasmo's dev-mode loading indicator.
    if (isExtensionElement(getTarget(anim) as Node | undefined)) continue
    if (anim.playState === undefined || anim.playState === "running") running++

    let timing:
      | ReturnType<
          NonNullable<NonNullable<AnimationLike["effect"]>["getTiming"]>
        >
      | undefined
    try {
      timing = anim.effect?.getTiming?.()
    } catch {
      timing = undefined
    }
    if (!timing) continue

    const target = getTarget(anim)
    if (timing.iterations === Infinity) {
      if (target && isHidden(target, doc)) continue
      infiniteCount++
      const name = nameOf(anim)
      const group = infiniteGroups.get(name)
      if (group) group.count++
      else infiniteGroups.set(name, { count: 1, first: target })
      continue
    }

    const total =
      num(timing.delay) +
      num(timing.duration) * (num(timing.iterations) || 1) +
      num(timing.endDelay)
    if (total > longestMs) {
      longestMs = total
      longestElement = target
    }
  }

  for (const [name, { count, first }] of infiniteGroups) {
    const loader = LOADER_PATTERN.test(name)
    const where = describeTarget(first)
    issues.push({
      kind: "infinite",
      severity: loader ? "info" : "warning",
      message:
        count > 1
          ? `Infinite animation "${name}" on ${count} elements (first: ${where})`
          : `Infinite animation "${name}" on ${where}`,
      element: first,
      ...(count > 1 ? { count } : {})
    })
  }

  const longestSeconds = Math.round(longestMs) / 1000
  if (longestSeconds > MAX_ANIMATION_SECONDS) {
    issues.push({
      kind: "too-long",
      severity: "error",
      message: `Animation runs ${longestSeconds}s, over the ${MAX_ANIMATION_SECONDS}s limit`,
      element: longestElement
    })
  } else if (longestSeconds > WARN_ANIMATION_SECONDS) {
    issues.push({
      kind: "too-long",
      severity: "warning",
      message: `Animation runs ${longestSeconds}s, over ${WARN_ANIMATION_SECONDS}s (limit is ${MAX_ANIMATION_SECONDS}s)`,
      element: longestElement
    })
  }

  if (running > MAX_RUNNING_ANIMATIONS) {
    issues.push({
      kind: "many-animations",
      severity: "info",
      message: `${running} animations running at once, which may be CPU-heavy`,
      count: running
    })
  }

  issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])

  const errors = issues.filter((i) => i.severity === "error").length
  const warnings = issues.filter((i) => i.severity === "warning").length

  return {
    issues: issues.slice(0, MAX_ANIMATION_ISSUES),
    summary: { total: issues.length, errors, warnings },
    longestSeconds,
    infiniteCount
  }
}

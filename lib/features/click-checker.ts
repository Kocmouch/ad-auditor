export type ClickIssueSeverity = "error" | "warning"

export type ClickIssueKind = "small-target" | "low-coverage" | "obstructed"

export type ClickIssue = {
  kind: ClickIssueKind
  severity: ClickIssueSeverity
  message: string
  element?: HTMLElement
  width?: number
  height?: number
}

export type ClickCoverage = {
  percent: number
  sampled: number
  covered: number
}

export type ClickCheckResult = {
  issues: ClickIssue[]
  coverage: ClickCoverage
  summary: {
    total: number
    errors: number
    warnings: number
    /** True when more than MAX_CLICK_ISSUES were found and the list was cut. */
    truncated: boolean
  }
}

export type ClickCheckOptions = {
  /** Override element measurement (useful where layout is unavailable). */
  measure?: (element: HTMLElement) => {
    width: number
    height: number
    /** Viewport position; defaults to 0 when an override omits them. */
    left?: number
    top?: number
  }
  /** Override hit testing; defaults to `doc.elementFromPoint`. */
  hitTest?: (x: number, y: number) => Element | null
  /** Override the viewport size; defaults to the document's window size. */
  viewport?: { width: number; height: number }
}

export const MAX_CLICK_ISSUES = 50
/** Smaller than this (either dimension) is a warning. */
export const MIN_TARGET_SIZE = 24
/** Smaller than this in both dimensions is an error. */
export const ERROR_TARGET_SIZE = 12
/** Clickables covering more than this fraction of the viewport are whole-banner areas. */
export const BIG_AREA_FRACTION = 0.25
export const GRID_COLUMNS = 12
export const GRID_ROWS = 10
/** Coverage below this percentage is a warning. */
export const LOW_COVERAGE_WARNING = 60
/** Coverage below this percentage is an error. */
export const LOW_COVERAGE_ERROR = 25
/** Clickables up to this wide are checked for obstruction. */
export const OBSTRUCTION_MAX_WIDTH = 200

export const CLICKABLE_SELECTOR =
  "a, button, [role=button], [onclick], [data-offer-id], [data-href], [data-clicktag]"
const OPTOUT_SELECTOR = ".optout, #optout, [class*=optout]"

const SEVERITY_ORDER: Record<ClickIssueSeverity, number> = {
  error: 0,
  warning: 1
}

const defaultMeasure = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect()
  return {
    width: rect.width,
    height: rect.height,
    left: rect.left,
    top: rect.top
  }
}

const isHidden = (element: HTMLElement, doc: Document): boolean => {
  const view = doc.defaultView
  if (!view) return false
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
  return false
}

const hasPointerCursor = (element: Element, doc: Document): boolean => {
  const view = doc.defaultView
  if (!view) return false
  try {
    return view.getComputedStyle(element).cursor === "pointer"
  } catch {
    return false
  }
}

const matchesClickable = (element: Element, doc: Document): boolean =>
  element.matches(CLICKABLE_SELECTOR) || hasPointerCursor(element, doc)

/** True when the element or any ancestor is clickable. */
const isInClickable = (start: Element, doc: Document): boolean => {
  let current: Element | null = start
  while (current) {
    if (matchesClickable(current, doc)) return true
    current = current.parentElement
  }
  return false
}

/** Clickable by selector, or the root of a cursor:pointer region. */
const isClickableRoot = (element: Element, doc: Document): boolean => {
  if (element.matches(CLICKABLE_SELECTOR)) return true
  if (!hasPointerCursor(element, doc)) return false
  const parent = element.parentElement
  return !parent || !hasPointerCursor(parent, doc)
}

const describe = (element: Element): string => {
  const tag = element.tagName.toLowerCase()
  const cls =
    typeof element.className === "string"
      ? element.className.trim().split(/\s+/)[0]
      : ""
  return cls ? `${tag}.${cls}` : tag
}

const round = (n: number): number => Math.round(n * 10) / 10

const getViewport = (doc: Document, options: ClickCheckOptions) => {
  if (options.viewport) return options.viewport
  const view = doc.defaultView
  const root = doc.documentElement
  return {
    width: view?.innerWidth || root?.clientWidth || 0,
    height: view?.innerHeight || root?.clientHeight || 0
  }
}

export const checkClickability = (
  doc: Document = document,
  options: ClickCheckOptions = {}
): ClickCheckResult => {
  const measure = options.measure ?? defaultMeasure
  const hitTest =
    options.hitTest ?? ((x: number, y: number) => doc.elementFromPoint(x, y))
  const viewport = getViewport(doc, options)
  const viewportArea = viewport.width * viewport.height
  const issues: ClickIssue[] = []

  // Visible clickable roots with their measured size.
  const visible: {
    el: HTMLElement
    width: number
    height: number
    cx: number
    cy: number
  }[] = []
  for (const el of Array.from(doc.querySelectorAll<HTMLElement>("*"))) {
    if (!isClickableRoot(el, doc)) continue
    if (isHidden(el, doc)) continue
    const { width, height, left = 0, top = 0 } = measure(el)
    if (!(width > 0) || !(height > 0)) continue
    visible.push({
      el,
      width,
      height,
      cx: left + width / 2,
      cy: top + height / 2
    })
  }

  // 1. Click target size.
  for (const { el, width, height } of visible) {
    if (viewportArea > 0 && width * height > viewportArea * BIG_AREA_FRACTION) {
      continue
    }
    if (el.tagName === "A" && el.closest("p")) continue
    if (width >= MIN_TARGET_SIZE && height >= MIN_TARGET_SIZE) continue
    const isError = width < ERROR_TARGET_SIZE && height < ERROR_TARGET_SIZE
    issues.push({
      kind: "small-target",
      severity: isError ? "error" : "warning",
      message: `Click target ${describe(el)} is ${round(width)}x${round(height)}px (minimum ${MIN_TARGET_SIZE}x${MIN_TARGET_SIZE})`,
      element: el,
      width: round(width),
      height: round(height)
    })
  }

  // 2. Click coverage over a grid of viewport points.
  let sampled = 0
  let covered = 0
  if (viewport.width > 0 && viewport.height > 0) {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLUMNS; col++) {
        const x = ((col + 0.5) / GRID_COLUMNS) * viewport.width
        const y = ((row + 0.5) / GRID_ROWS) * viewport.height
        sampled++
        const hit = hitTest(x, y)
        if (hit && isInClickable(hit, doc)) covered++
      }
    }
  }
  const percent = sampled === 0 ? 0 : round((covered / sampled) * 100)
  if (sampled > 0 && percent < LOW_COVERAGE_WARNING) {
    issues.push({
      kind: "low-coverage",
      severity: percent < LOW_COVERAGE_ERROR ? "error" : "warning",
      message: `Only ${percent}% of the ad is clickable (${covered}/${sampled} sampled points; ${round(100 - percent)}% uncovered)`
    })
  }

  // 3. Obstructed small / opt-out clickables.
  for (const { el, width, cx, cy } of visible) {
    if (!el.matches(OPTOUT_SELECTOR) && width > OBSTRUCTION_MAX_WIDTH) continue
    if (cx < 0 || cy < 0 || cx > viewport.width || cy > viewport.height) {
      continue
    }
    const top = hitTest(cx, cy)
    if (!top) continue
    if (top === el || el.contains(top) || top.contains(el)) continue
    issues.push({
      kind: "obstructed",
      severity: "warning",
      message: `${describe(el)} is covered by ${describe(top)}`,
      element: el
    })
  }

  issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  const errors = issues.filter((i) => i.severity === "error").length

  return {
    issues: issues.slice(0, MAX_CLICK_ISSUES),
    coverage: { percent, sampled, covered },
    summary: {
      total: issues.length,
      errors,
      warnings: issues.length - errors,
      truncated: issues.length > MAX_CLICK_ISSUES
    }
  }
}

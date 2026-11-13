import { HIGHLIGHT_LAYER_ID } from "~lib/ui/highlight"

export type StructureIssueKind =
  | "quirks-mode"
  | "charset"
  | "duplicate-id"
  | "invalid-attribute"
  | "overflow"
  | "clipped-text"
  | "tiny-font"
  | "offscreen"
export type StructureIssueSeverity = "error" | "warning" | "info"

export type StructureIssue = {
  kind: StructureIssueKind
  severity: StructureIssueSeverity
  message: string
  element?: HTMLElement
}

export type StructureCheckResult = {
  issues: StructureIssue[]
  summary: { total: number; errors: number; warnings: number }
}

export type ElementMetrics = {
  rect: {
    left: number
    top: number
    right: number
    bottom: number
    width: number
    height: number
  }
  scrollWidth: number
  clientWidth: number
  scrollHeight: number
  clientHeight: number
}

export type StructureCheckOptions = {
  /** Layout measurement, injectable for tests (defaults to real element metrics). */
  measure?: (el: HTMLElement) => ElementMetrics
  /** Viewport size (defaults to the window's inner size). */
  viewport?: { width: number; height: number }
}

export const MAX_ISSUES = 50
/** Upper bound on elements scanned. */
export const MAX_SCANNED_ELEMENTS = 5000
/** Font sizes (px) below this are flagged as warning. */
export const MIN_READABLE_FONT_PX = 8
/** Font sizes (px) below this are flagged as error. */
export const ERROR_FONT_PX = 5
/** Scroll/client differences up to this many px are ignored. */
export const OVERFLOW_TOLERANCE_PX = 1
/** Fraction of clipped content above which clipped text is a warning. */
export const CLIPPED_WARNING_RATIO = 0.2
/** Max clipped-text issues per document. */
export const MAX_CLIPPED_ISSUES = 20
/** Max offscreen issues per document. */
export const MAX_OFFSCREEN_ISSUES = 20
/** Max invalid-attribute issues per document. */
export const MAX_ATTRIBUTE_ISSUES = 20
/** Max distinct duplicate ids listed in a message. */
export const MAX_DUPLICATE_IDS_LISTED = 10
/** Elements smaller than this (both sides) are ignored for offscreen checks. */
export const MIN_OFFSCREEN_SIZE_PX = 10

const SEVERITY_ORDER: Record<StructureIssueSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2
}

const NUMERIC_LENGTH = /^\s*(\d+(\.\d*)?|\.\d+)(px|%)?\s*$/i
const SVG_LENGTH =
  /^\s*(\d+(\.\d*)?|\.\d+)(px|%|em|ex|rem|pt|pc|cm|mm|in)?\s*$/i

const SKIPPED_TAGS = new Set([
  "HTML",
  "HEAD",
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "META",
  "LINK",
  "TITLE",
  "TEMPLATE"
])

const defaultMeasure = (el: HTMLElement): ElementMetrics => {
  const r = el.getBoundingClientRect()
  return {
    rect: {
      left: r.left,
      top: r.top,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
      height: r.height
    },
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight
  }
}

const isClipping = (value: string) => value === "hidden" || value === "clip"

/** Returns the [x, y] overflow values, handling the shorthand. */
const getOverflow = (style: CSSStyleDeclaration): [string, string] => {
  const parts = (style.overflow || "").trim().split(/\s+/).filter(Boolean)
  const x = style.overflowX || parts[0] || "visible"
  const y = style.overflowY || parts[1] || parts[0] || "visible"
  return [x, y]
}

const isInsideOverlay = (el: Element) => !!el.closest(`#${HIGHLIGHT_LAYER_ID}`)

const hasDirectText = (el: Element) => {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 3 && (node.textContent ?? "").trim() !== "") {
      return true
    }
  }
  return false
}

const isStyleHidden = (style: CSSStyleDeclaration) =>
  style.display === "none" ||
  style.visibility === "hidden" ||
  style.visibility === "collapse" ||
  style.opacity === "0"

const describe = (el: Element) => {
  const tag = el.localName
  const classes = (el.getAttribute("class") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
  return classes.length ? `${tag}.${classes.join(".")}` : tag
}

const px = (n: number) => `${Math.round(n * 10) / 10}px`

const checkDocumentBasics = (doc: Document, issues: StructureIssue[]) => {
  if (!doc.doctype) {
    issues.push({
      kind: "quirks-mode",
      severity: "warning",
      message:
        "Missing <!DOCTYPE html>: the document renders in quirks mode, layout may differ between browsers"
    })
  } else if (doc.compatMode === "BackCompat") {
    issues.push({
      kind: "quirks-mode",
      severity: "warning",
      message:
        "Document renders in quirks mode (BackCompat); use <!DOCTYPE html> for standards mode"
    })
  }

  const hasCharset =
    !!doc.querySelector("meta[charset]") ||
    Array.from(doc.querySelectorAll("meta[http-equiv]")).some(
      (m) => (m.getAttribute("http-equiv") ?? "").toLowerCase() === "content-type"
    )
  if (!hasCharset) {
    issues.push({
      kind: "charset",
      severity: "info",
      message:
        'No character encoding declared; add <meta charset="utf-8"> to avoid garbled text'
    })
  }

  const counts = new Map<string, number>()
  const firstEl = new Map<string, HTMLElement>()
  doc.querySelectorAll("[id]").forEach((node) => {
    const id = node.getAttribute("id") ?? ""
    if (!id || isInsideOverlay(node)) return
    counts.set(id, (counts.get(id) ?? 0) + 1)
    if (!firstEl.has(id)) firstEl.set(id, node as HTMLElement)
  })
  const dupes = Array.from(counts.entries()).filter(([, n]) => n > 1)
  if (dupes.length > 0) {
    const listed = dupes
      .slice(0, MAX_DUPLICATE_IDS_LISTED)
      .map(([id, n]) => `"${id}" x${n}`)
      .join(", ")
    const more =
      dupes.length > MAX_DUPLICATE_IDS_LISTED
        ? ` and ${dupes.length - MAX_DUPLICATE_IDS_LISTED} more`
        : ""
    issues.push({
      kind: "duplicate-id",
      severity: "warning",
      message: `Duplicate id attributes (${dupes.length}): ${listed}${more}`,
      element: firstEl.get(dupes[0][0])
    })
  }
}

const checkAttributes = (doc: Document): StructureIssue[] => {
  const issues: StructureIssue[] = []
  const push = (element: HTMLElement, message: string) => {
    if (issues.length < MAX_ATTRIBUTE_ISSUES) {
      issues.push({
        kind: "invalid-attribute",
        severity: "warning",
        message,
        element
      })
    }
  }
  doc.querySelectorAll("img, svg, canvas").forEach((node) => {
    if (isInsideOverlay(node)) return
    const el = node as HTMLElement
    const tag = el.localName
    const re = tag === "svg" ? SVG_LENGTH : NUMERIC_LENGTH
    for (const attr of ["width", "height"]) {
      const value = el.getAttribute(attr)
      if (value !== null && value.trim() !== "" && !re.test(value)) {
        push(el, `<${tag}> has invalid ${attr}="${value}" (expected a number)`)
      }
    }
    if (tag === "svg" && el.hasAttribute("viewport") && !el.hasAttribute("viewBox")) {
      push(
        el,
        "<svg> uses a viewport attribute, which is not valid SVG; use viewBox"
      )
    }
    if (tag === "img" && !el.hasAttribute("src") && !el.hasAttribute("srcset")) {
      push(el, "<img> has neither src nor srcset")
    }
  })
  return issues
}

const checkPageOverflow = (
  doc: Document,
  win: Window & typeof globalThis,
  measure: (el: HTMLElement) => ElementMetrics
): StructureIssue[] => {
  const issues: StructureIssue[] = []
  const html = doc.documentElement
  const body = doc.body
  if (!html) return issues
  const htmlStyle = win.getComputedStyle(html)
  const bodyStyle = body ? win.getComputedStyle(body) : null
  const [hx, hy] = getOverflow(htmlStyle)
  const [bx, by] = bodyStyle ? getOverflow(bodyStyle) : ["visible", "visible"]
  const hiddenX = isClipping(hx) || isClipping(bx)
  const hiddenY = isClipping(hy) || isClipping(by)
  const htmlM = measure(html)
  const bodyM = body ? measure(body) : null

  const horizontal = [htmlM, bodyM]
    .filter((m): m is ElementMetrics => !!m)
    .find((m) => m.scrollWidth - m.clientWidth > OVERFLOW_TOLERANCE_PX)
  if (horizontal && !hiddenX) {
    issues.push({
      kind: "overflow",
      severity: "warning",
      message: `Horizontal scrollbar: content is ${px(horizontal.scrollWidth)} wide in a ${px(horizontal.clientWidth)} wide area (+${px(horizontal.scrollWidth - horizontal.clientWidth)})`,
      element: html
    })
  }
  const vertical = [htmlM, bodyM]
    .filter((m): m is ElementMetrics => !!m)
    .find((m) => m.scrollHeight - m.clientHeight > OVERFLOW_TOLERANCE_PX)
  if (vertical && !hiddenY) {
    issues.push({
      kind: "overflow",
      severity: "warning",
      message: `Vertical scrollbar: content is ${px(vertical.scrollHeight)} tall in a ${px(vertical.clientHeight)} tall area (+${px(vertical.scrollHeight - vertical.clientHeight)})`,
      element: html
    })
  }
  return issues
}

export const checkStructure = (
  doc: Document = document,
  options: StructureCheckOptions = {}
): StructureCheckResult => {
  const win = (doc.defaultView ?? window) as Window & typeof globalThis
  const measure = options.measure ?? defaultMeasure
  const viewport = options.viewport ?? {
    width: win.innerWidth || doc.documentElement?.clientWidth || 0,
    height: win.innerHeight || doc.documentElement?.clientHeight || 0
  }

  const issues: StructureIssue[] = []
  checkDocumentBasics(doc, issues)
  issues.push(...checkAttributes(doc))
  issues.push(...checkPageOverflow(doc, win, measure))

  const clipped: StructureIssue[] = []
  const offscreen: StructureIssue[] = []
  const offscreenEls = new Set<Element>()
  const tiny = new Map<
    string,
    { element: HTMLElement; size: number; count: number; label: string }
  >()

  const all = doc.querySelectorAll("*")
  const limit = Math.min(all.length, MAX_SCANNED_ELEMENTS)
  for (let i = 0; i < limit; i++) {
    const el = all[i]
    if (!(el instanceof win.HTMLElement)) continue
    if (SKIPPED_TAGS.has(el.tagName) || el === doc.body) continue
    if (isInsideOverlay(el)) continue
    const style = win.getComputedStyle(el)
    if (isStyleHidden(style)) continue
    const m = measure(el)
    if (m.rect.width <= 0 && m.rect.height <= 0 && m.clientWidth <= 0) continue

    const textual = hasDirectText(el)

    if (textual) {
      const fontSize = parseFloat(style.fontSize)
      if (fontSize > 0 && fontSize < MIN_READABLE_FONT_PX) {
        const label = describe(el)
        const key = `${label}|${fontSize}`
        const entry = tiny.get(key)
        if (entry) entry.count++
        else tiny.set(key, { element: el, size: fontSize, count: 1, label })
      }

      const [ox, oy] = getOverflow(style)
      const clampValue = style.getPropertyValue("-webkit-line-clamp")
      const clamped = !!clampValue && clampValue !== "none"
      if (
        (isClipping(ox) || isClipping(oy)) &&
        style.textOverflow !== "ellipsis" &&
        !clamped &&
        clipped.length < MAX_CLIPPED_ISSUES
      ) {
        let cut = 0
        if (
          isClipping(ox) &&
          m.clientWidth > 0 &&
          m.scrollWidth > m.clientWidth + OVERFLOW_TOLERANCE_PX
        ) {
          cut = Math.max(cut, 1 - m.clientWidth / m.scrollWidth)
        }
        if (
          isClipping(oy) &&
          m.clientHeight > 0 &&
          m.scrollHeight > m.clientHeight + OVERFLOW_TOLERANCE_PX
        ) {
          cut = Math.max(cut, 1 - m.clientHeight / m.scrollHeight)
        }
        if (cut > 0) {
          clipped.push({
            kind: "clipped-text",
            severity: cut > CLIPPED_WARNING_RATIO ? "warning" : "info",
            message: `Text in <${describe(el)}> is clipped (about ${Math.round(cut * 100)}% of the content is cut off)`,
            element: el
          })
        }
      }
    }

    if (
      offscreen.length < MAX_OFFSCREEN_ISSUES &&
      m.rect.width >= MIN_OFFSCREEN_SIZE_PX &&
      m.rect.height >= MIN_OFFSCREEN_SIZE_PX &&
      viewport.width > 0 &&
      viewport.height > 0 &&
      (m.rect.left >= viewport.width || m.rect.top >= viewport.height)
    ) {
      let ancestorReported = false
      for (let p = el.parentElement; p; p = p.parentElement) {
        if (offscreenEls.has(p)) {
          ancestorReported = true
          break
        }
      }
      if (!ancestorReported) {
        offscreenEls.add(el)
        const side =
          m.rect.left >= viewport.width && m.rect.top >= viewport.height
            ? "right and bottom"
            : m.rect.left >= viewport.width
              ? "right"
              : "bottom"
        offscreen.push({
          kind: "offscreen",
          severity: "info",
          message: `<${describe(el)}> (${Math.round(m.rect.width)}x${Math.round(m.rect.height)}) lies entirely outside the viewport on the ${side} (${Math.round(m.rect.left)}, ${Math.round(m.rect.top)})`,
          element: el
        })
      }
    }
  }

  for (const t of tiny.values()) {
    issues.push({
      kind: "tiny-font",
      severity: t.size < ERROR_FONT_PX ? "error" : "warning",
      message: `Text in <${t.label}> uses a ${px(t.size)} font${t.count > 1 ? ` (${t.count} elements)` : ""}, hard to read (minimum ${MIN_READABLE_FONT_PX}px)`,
      element: t.element
    })
  }
  issues.push(...clipped, ...offscreen)

  issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  const capped = issues.slice(0, MAX_ISSUES)
  return {
    issues: capped,
    summary: {
      total: capped.length,
      errors: capped.filter((i) => i.severity === "error").length,
      warnings: capped.filter((i) => i.severity === "warning").length
    }
  }
}

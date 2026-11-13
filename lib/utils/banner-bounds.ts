/** Rectangle in viewport coordinates. */
export type Rect = { left: number; top: number; width: number; height: number }

/** Banners smaller than this (per side) are not trusted as a detection. */
export const MIN_BANNER_SIZE = 50

/**
 * Union bounding box of `rects`, clipped to the viewport. Returns undefined
 * when there is nothing usable or the result is smaller than `minSize` on
 * either side (the caller then falls back to the whole viewport).
 */
export const unionBounds = (
  rects: ReadonlyArray<Rect>,
  viewport: { width: number; height: number },
  minSize: number = MIN_BANNER_SIZE
): Rect | undefined => {
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const rect of rects) {
    if (!(rect.width > 0) || !(rect.height > 0)) {
      continue
    }
    left = Math.min(left, rect.left)
    top = Math.min(top, rect.top)
    right = Math.max(right, rect.left + rect.width)
    bottom = Math.max(bottom, rect.top + rect.height)
  }
  if (!Number.isFinite(left)) {
    return undefined
  }

  left = Math.max(0, left)
  top = Math.max(0, top)
  right = Math.min(viewport.width, right)
  bottom = Math.min(viewport.height, bottom)
  const width = right - left
  const height = bottom - top
  if (width < minSize || height < minSize) {
    return undefined
  }
  return { height, left, top, width }
}

const SKIPPED_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "LINK",
  "META",
  "NOSCRIPT",
  "TEMPLATE",
  "HEAD",
  "TITLE",
  "BR"
])
const MEDIA_TAGS = new Set([
  "IMG",
  "CANVAS",
  "SVG",
  "VIDEO",
  "IFRAME",
  "PICTURE"
])
const EXTENSION_ID_PREFIX = "ad-auditor"

const isTransparent = (color: string) =>
  !color || color === "transparent" || /^rgba\([^)]*,\s*0\)$/.test(color)

/** True when the element paints something itself (media, text, background, border). */
const paintsContent = (el: Element, style: CSSStyleDeclaration): boolean => {
  if (MEDIA_TAGS.has(el.tagName.toUpperCase())) return true
  if (!isTransparent(style.backgroundColor)) return true
  if (style.backgroundImage && style.backgroundImage !== "none") return true
  if (parseFloat(style.borderTopWidth) > 0 && style.borderTopStyle !== "none") {
    return true
  }
  return Array.from(el.childNodes).some(
    (node) => node.nodeType === 3 && (node.textContent ?? "").trim() !== ""
  )
}

/**
 * Standalone mode: the banner is the top document and the window is bigger
 * than the banner. There is no size in the URL, so the banner is taken as the
 * union box of the visible, painted body descendants, clipped to the window.
 * Extension UI (ids starting with "ad-auditor") is ignored. Returns undefined
 * when nothing sensible is found.
 */
export const detectBannerBounds = (
  doc: Document = document
): Rect | undefined => {
  const view = doc.defaultView
  const body = doc.body
  if (!view || !body) {
    return undefined
  }

  const rects: Rect[] = []
  for (const el of Array.from(body.querySelectorAll("*"))) {
    if (SKIPPED_TAGS.has(el.tagName.toUpperCase())) continue
    if (el.closest(`[id^="${EXTENSION_ID_PREFIX}"]`)) continue
    const style = view.getComputedStyle(el)
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      parseFloat(style.opacity) === 0
    ) {
      continue
    }
    if (!paintsContent(el, style)) continue
    const rect = el.getBoundingClientRect()
    rects.push({
      height: rect.height,
      left: rect.left,
      top: rect.top,
      width: rect.width
    })
  }

  return unionBounds(rects, {
    height: view.innerHeight || doc.documentElement.clientHeight || 0,
    width: view.innerWidth || doc.documentElement.clientWidth || 0
  })
}

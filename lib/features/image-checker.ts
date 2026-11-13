export type ImageIssueKind = "oversized" | "upscaled" | "format" | "broken"
export type ImageIssueSeverity = "error" | "warning" | "info"

export type ImageIssue = {
  kind: ImageIssueKind
  severity: ImageIssueSeverity
  src: string
  message: string
  element?: HTMLElement
  naturalWidth: number
  naturalHeight: number
  renderedWidth: number
  renderedHeight: number
  /** Fraction of natural pixels not needed at the rendered size (0..1), oversized only. */
  wastedPixelRatio?: number
}

export type ImageCheckResult = {
  issues: ImageIssue[]
  summary: { total: number; errors: number; warnings: number }
}

/** natural area / rendered area above which an image is a warning. */
export const OVERSIZE_WARNING_RATIO = 2.5
/** natural area / rendered area above which an image is an error. */
export const OVERSIZE_ERROR_RATIO = 6
/** Images with both sides at or below this are treated as tracking pixels. */
export const TRACKING_PIXEL_MAX_SIDE = 1
/** GIFs with at least this many natural pixels are flagged as a warning. */
export const LARGE_GIF_MIN_PIXELS = 150_000
/** Display scale (rendered / natural, linear) above which an image looks soft. */
export const UPSCALE_WARNING_SCALE = 1.5
/** Display scale above which an image is clearly blurry/pixelated. */
export const UPSCALE_ERROR_SCALE = 3
export const MAX_ISSUES = 50
/** Upper bound on elements scanned for CSS background images. */
export const MAX_SCANNED_ELEMENTS = 5000

const SEVERITY_ORDER: Record<ImageIssueSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2
}

const LEGACY_FORMATS: Record<string, string> = {
  png: "PNG",
  jpg: "JPEG",
  jpeg: "JPEG",
  gif: "GIF"
}

const MODERN_HINT = "WebP or AVIF"

export const getImageFormat = (src: string): string | null => {
  const dataMatch = /^data:image\/([a-z0-9.+-]+)/i.exec(src)
  if (dataMatch) return dataMatch[1].toLowerCase()
  if (/^data:/i.test(src)) return null
  const path = src.split(/[?#]/)[0]
  const extMatch = /\.([a-z0-9]+)$/i.exec(path)
  return extMatch ? extMatch[1].toLowerCase() : null
}

const shortSrc = (src: string) =>
  src.startsWith("data:") ? `${src.slice(0, 40)}...` : src

export const extractCssUrls = (value: string): string[] => {
  const urls: string[] = []
  const re = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"\s][^)]*?))\s*\)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(value))) {
    const url = (m[1] ?? m[2] ?? m[3] ?? "").trim()
    if (url) urls.push(url)
  }
  return urls
}

type Candidate = {
  src: string
  element: HTMLElement
  naturalWidth: number
  naturalHeight: number
  renderedWidth: number
  renderedHeight: number
  broken: boolean
  /** True when natural size is unknown (e.g. background image not yet loaded). */
  sizeUnknown: boolean
  /** How the image is fitted into its box: contain, cover/fill (stretched) or natural size. */
  fit: "contain" | "cover" | "none"
}

const toFit = (value: string): Candidate["fit"] =>
  value === "contain" ? "contain" : value === "cover" ? "cover" : "none"

const analyze = (c: Candidate): ImageIssue[] => {
  const base = {
    src: c.src,
    element: c.element,
    naturalWidth: c.naturalWidth,
    naturalHeight: c.naturalHeight,
    renderedWidth: c.renderedWidth,
    renderedHeight: c.renderedHeight
  }
  if (c.broken) {
    return [
      {
        ...base,
        kind: "broken",
        severity: "error",
        message: `Image failed to load: ${shortSrc(c.src)}`
      }
    ]
  }

  const issues: ImageIssue[] = []
  const renderedArea = c.renderedWidth * c.renderedHeight
  const naturalArea = c.naturalWidth * c.naturalHeight

  if (!c.sizeUnknown && renderedArea > 0) {
    const ratio = naturalArea / renderedArea
    if (ratio > OVERSIZE_WARNING_RATIO) {
      const wasted = 1 - renderedArea / naturalArea
      issues.push({
        ...base,
        kind: "oversized",
        severity: ratio > OVERSIZE_ERROR_RATIO ? "error" : "warning",
        wastedPixelRatio: Math.round(wasted * 1000) / 1000,
        message: `Image is ${c.naturalWidth}x${c.naturalHeight} but rendered at ${Math.round(c.renderedWidth)}x${Math.round(c.renderedHeight)} (${ratio.toFixed(1)}x the pixels needed, ${Math.round(wasted * 100)}% wasted)`
      })
    }
  }

  if (
    !c.sizeUnknown &&
    c.fit !== "none" &&
    naturalArea > 0 &&
    renderedArea > 0
  ) {
    const sx = c.renderedWidth / c.naturalWidth
    const sy = c.renderedHeight / c.naturalHeight
    const scale = c.fit === "contain" ? Math.min(sx, sy) : Math.max(sx, sy)
    if (scale > UPSCALE_WARNING_SCALE && getImageFormat(c.src) !== "svg") {
      issues.push({
        ...base,
        kind: "upscaled",
        severity: scale > UPSCALE_ERROR_SCALE ? "error" : "warning",
        message: `Image is ${c.naturalWidth}x${c.naturalHeight} but displayed ${scale.toFixed(1)}x larger (${Math.round(c.renderedWidth)}x${Math.round(c.renderedHeight)} box), it will look blurry`
      })
    }
  }

  const format = getImageFormat(c.src)
  const label = format ? LEGACY_FORMATS[format] : undefined
  if (label) {
    const largeGif =
      format === "gif" && !c.sizeUnknown && naturalArea >= LARGE_GIF_MIN_PIXELS
    issues.push({
      ...base,
      kind: "format",
      severity: largeGif ? "warning" : "info",
      message: largeGif
        ? `Large GIF (${c.naturalWidth}x${c.naturalHeight}) is likely heavy if animated; consider video or animated ${MODERN_HINT}`
        : `${label} image could be served as ${MODERN_HINT}`
    })
  }
  return issues
}

const isHidden = (style: CSSStyleDeclaration) =>
  style.display === "none" || style.visibility === "hidden"

const getRenderedSize = (el: HTMLElement) => {
  const rect = el.getBoundingClientRect()
  return { width: rect.width, height: rect.height }
}

/**
 * RTB House image endpoints (`/ad/images?...&w=269&h=300`) encode the served
 * size in the query string. Used when the image is not decoded yet, so
 * oversize checks still work for background images.
 */
export const getSizeFromImageUrl = (
  src: string
): { width: number; height: number } | null => {
  try {
    const url = new URL(src)
    if (!url.pathname.endsWith("/ad/images")) return null
    const width = Number(url.searchParams.get("w"))
    const height = Number(url.searchParams.get("h"))
    return width > 0 && height > 0 ? { width, height } : null
  } catch {
    return null
  }
}

const loadBackgroundNaturalSize = (
  win: Window & typeof globalThis,
  src: string
): { width: number; height: number } | null => {
  try {
    const img = new win.Image()
    img.src = src
    if (img.complete && img.naturalWidth > 0) {
      return { width: img.naturalWidth, height: img.naturalHeight }
    }
  } catch {
    // ignore
  }
  return getSizeFromImageUrl(src)
}

export const checkImagesInDocument = (
  doc: Document = document
): ImageCheckResult => {
  const win = doc.defaultView as (Window & typeof globalThis) | null
  const getStyle = (el: Element) =>
    (win ?? window).getComputedStyle(el as HTMLElement)
  const candidates: Candidate[] = []

  doc.querySelectorAll("img").forEach((node) => {
    const img = node as HTMLImageElement
    const src = img.currentSrc || img.getAttribute("src") || ""
    if (!src) return
    const style = getStyle(img)
    if (isHidden(style)) return

    const naturalWidth = img.naturalWidth
    const naturalHeight = img.naturalHeight
    const { width, height } = getRenderedSize(img)

    if (img.complete && naturalWidth === 0) {
      candidates.push({
        src,
        element: img,
        naturalWidth,
        naturalHeight,
        renderedWidth: width,
        renderedHeight: height,
        broken: true,
        sizeUnknown: true,
        fit: "none"
      })
      return
    }
    if (width === 0 || height === 0) return
    const tiny = (w: number, h: number) =>
      w <= TRACKING_PIXEL_MAX_SIDE && h <= TRACKING_PIXEL_MAX_SIDE
    if (tiny(naturalWidth, naturalHeight) || tiny(width, height)) return

    candidates.push({
      src,
      element: img,
      naturalWidth,
      naturalHeight,
      renderedWidth: width,
      renderedHeight: height,
      broken: false,
      sizeUnknown: naturalWidth === 0,
      // Default object-fit (fill) stretches the image like "cover" for our purposes.
      fit:
        style.objectFit === "contain"
          ? "contain"
          : style.objectFit === "none" || style.objectFit === "scale-down"
            ? "none"
            : "cover"
    })
  })

  const all = doc.querySelectorAll("*")
  const limit = Math.min(all.length, MAX_SCANNED_ELEMENTS)
  for (let i = 0; i < limit; i++) {
    const el = all[i] as HTMLElement
    if (!(el instanceof (win ?? window).HTMLElement)) continue
    if (el.tagName === "IMG") continue
    const style = getStyle(el)
    const bg = style.backgroundImage
    if (!bg || bg === "none" || isHidden(style)) continue
    const urls = extractCssUrls(bg)
    if (urls.length === 0) continue
    const { width, height } = getRenderedSize(el)
    if (width === 0 || height === 0) continue
    if (width <= TRACKING_PIXEL_MAX_SIDE && height <= TRACKING_PIXEL_MAX_SIDE)
      continue

    for (const src of urls) {
      const natural = win ? loadBackgroundNaturalSize(win, src) : null
      if (natural && natural.width <= 1 && natural.height <= 1) continue
      candidates.push({
        src,
        element: el,
        naturalWidth: natural?.width ?? 0,
        naturalHeight: natural?.height ?? 0,
        renderedWidth: width,
        renderedHeight: height,
        broken: false,
        sizeUnknown: !natural,
        fit: toFit(style.backgroundSize)
      })
    }
  }

  const seen = new Set<string>()
  const issues: ImageIssue[] = []
  for (const c of candidates) {
    for (const issue of analyze(c)) {
      const key = `${issue.kind}|${issue.src}`
      if (seen.has(key)) continue
      seen.add(key)
      issues.push(issue)
    }
  }

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

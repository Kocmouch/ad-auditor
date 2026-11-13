export type RGB = { r: number; g: number; b: number }
export type RGBA = RGB & { a: number }

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n))

const parseChannel = (token: string): number | null => {
  const t = token.trim()
  const v = parseFloat(t)
  if (Number.isNaN(v)) return null
  return t.endsWith("%") ? clamp((v / 100) * 255, 0, 255) : clamp(v, 0, 255)
}

const parseAlpha = (token: string | undefined): number | null => {
  if (token === undefined || token.trim() === "") return 1
  const t = token.trim()
  const v = parseFloat(t)
  if (Number.isNaN(v)) return null
  return clamp(t.endsWith("%") ? v / 100 : v, 0, 1)
}

/**
 * Parses CSS colors: #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba() in comma or
 * space/slash syntax, and "transparent". Returns null for anything else.
 */
export const parseColor = (input: string | null | undefined): RGBA | null => {
  if (!input) return null
  const str = input.trim().toLowerCase()

  if (str === "transparent") return { r: 0, g: 0, b: 0, a: 0 }

  if (str.startsWith("#")) {
    const hex = str.slice(1)
    if (!/^[0-9a-f]+$/.test(hex)) return null
    if (hex.length === 3 || hex.length === 4) {
      const [r, g, b, a] = hex.split("").map((c) => parseInt(c + c, 16))
      return { r, g, b, a: a === undefined ? 1 : a / 255 }
    }
    if (hex.length === 6 || hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
      }
    }
    return null
  }

  const fn = str.match(/^rgba?\(\s*([^)]*)\)$/)
  if (!fn) return null
  const body = fn[1].trim()

  let channels: string[]
  let alphaToken: string | undefined
  if (body.includes(",")) {
    const parts = body.split(",").map((p) => p.trim())
    if (parts.length < 3 || parts.length > 4) return null
    channels = parts.slice(0, 3)
    alphaToken = parts[3]
  } else {
    const [colorPart, alphaPart] = body.split("/").map((p) => p.trim())
    channels = colorPart.split(/\s+/)
    if (channels.length !== 3) return null
    alphaToken = alphaPart
  }

  const [r, g, b] = channels.map(parseChannel)
  const a = parseAlpha(alphaToken)
  if (r === null || g === null || b === null || a === null) return null
  return { r, g, b, a }
}

/** Composites `fg` over `bg` (standard "over" operator). */
export const compositeOver = (fg: RGBA, bg: RGBA): RGBA => {
  const a = fg.a + bg.a * (1 - fg.a)
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 }
  const mix = (f: number, b2: number) => (f * fg.a + b2 * bg.a * (1 - fg.a)) / a
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a }
}

/** WCAG relative luminance. */
export const getLuminance = ({ r, g, b }: RGB): number => {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/** WCAG contrast ratio (1..21) between two opaque colors. */
export const getContrastRatio = (c1: RGB, c2: RGB): number => {
  const l1 = getLuminance(c1)
  const l2 = getLuminance(c2)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

export const WHITE: RGBA = { r: 255, g: 255, b: 255, a: 1 }

export type BackgroundResult =
  | { kind: "color"; color: RGBA }
  | { kind: "unverifiable"; reason: string }

type StyleLike = { backgroundColor: string; backgroundImage: string }
type StyleGetter = (el: Element) => StyleLike

/**
 * Resolves the effective opaque background behind an element by walking up the
 * ancestor chain and compositing semi-transparent layers. If a layer needed to
 * determine the color has a background-image (image/gradient), the result is
 * "unverifiable". If the chain ends without an opaque layer, the canvas is
 * assumed white (browser default).
 */
export const resolveBackground = (
  element: Element,
  getStyle: StyleGetter = (el) => window.getComputedStyle(el)
): BackgroundResult => {
  const layers: RGBA[] = []
  let current: Element | null = element
  let opaque = false

  while (current) {
    const style = getStyle(current)
    const image = style.backgroundImage
    if (
      image &&
      /url\(|gradient\(|image-set\(|element\(|cross-fade\(/i.test(image)
    ) {
      return {
        kind: "unverifiable",
        reason: "background is an image or gradient"
      }
    }
    const bg = parseColor(style.backgroundColor)
    if (bg && bg.a > 0) {
      layers.push(bg)
      if (bg.a >= 0.999) {
        opaque = true
        break
      }
    }
    current = current.parentElement
  }

  let result: RGBA = opaque ? layers.pop()! : WHITE
  for (let i = layers.length - 1; i >= 0; i--) {
    result = compositeOver(layers[i], result)
  }
  return { kind: "color", color: { ...result, a: 1 } }
}

/** Contrast of a (possibly semi-transparent) text color over an opaque background. */
export const getTextContrast = (text: RGBA, background: RGB): number => {
  const flat = compositeOver(text, { ...background, a: 1 })
  return getContrastRatio(flat, background)
}

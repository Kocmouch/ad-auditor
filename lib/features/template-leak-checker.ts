export type TemplateLeakSeverity = "error" | "warning" | "info"

export type TemplateLeakKind = "text" | "url"

export type TemplateLeakIssue = {
  kind: TemplateLeakKind
  severity: TemplateLeakSeverity
  /** The offending token as found (e.g. `undefined`, `{{ price }}`). */
  token: string
  message: string
  /** Surrounding text or URL, at most MAX_EXCERPT_LENGTH characters. */
  excerpt: string
  /** Element holding the leak (text parent, or the element with the URL). */
  element?: HTMLElement
}

export type TemplateLeakResult = {
  issues: TemplateLeakIssue[]
  summary: {
    /** Deduplicated issue count (before the MAX_TEMPLATE_LEAK_ISSUES cap). */
    total: number
    errors: number
    warnings: number
  }
}

export const MAX_TEMPLATE_LEAK_ISSUES = 50
export const MAX_EXCERPT_LENGTH = 80
const MAX_TOKEN_LENGTH = 40

type TextPattern = {
  regex: RegExp
  severity: TemplateLeakSeverity
  label: string
}

/**
 * Text patterns, in priority order: when matches overlap, the earlier
 * pattern wins (so `{{ undefined }}` is reported once as a mustache token).
 * Word-like tokens must not touch letters, digits, `_`, `.` or `-`, so
 * "nullable", "annulled" and "non-null" are never flagged.
 */
export const TEXT_LEAK_PATTERNS: readonly TextPattern[] = [
  {
    regex: /\{\{[^{}]*\}\}/g,
    severity: "error",
    label: "Unreplaced {{ }} template placeholder"
  },
  {
    regex: /\$\{[^{}]*\}/g,
    severity: "error",
    label: "Unreplaced ${ } template placeholder"
  },
  {
    regex: /<%[=\-#]?[\s\S]*?%>/g,
    severity: "error",
    label: "Unreplaced <% %> template tag"
  },
  {
    regex: /\[object \w+\]/g,
    severity: "error",
    label: "Object printed as text"
  },
  {
    regex: /(?<![\w.-])(?:undefined|null|NaN)(?![\w-])/g,
    severity: "error",
    label: "Missing value rendered as text"
  },
  {
    regex: /(?<![\w%])%(?:\d+\$)?[sd](?!\w)/g,
    severity: "error",
    label: "Unreplaced printf placeholder"
  },
  {
    regex: /\{\d+\}/g,
    severity: "error",
    label: "Unreplaced positional placeholder"
  },
  {
    // "Infinity" is a legitimate word/brand, so only a warning.
    regex: /(?<![\w.-])-?Infinity(?![\w-])/g,
    severity: "warning",
    label: "Infinity rendered as text (possible division by zero)"
  },
  {
    regex: /\{[A-Za-z_][\w.-]*\}/g,
    severity: "warning",
    label: "Possible unreplaced {placeholder}"
  }
]

type UrlPattern = {
  regex: RegExp
  severity: TemplateLeakSeverity
  label: string
  /** Downgrade to warning when the token is glued to `-`/`_` (e.g. a slug). */
  softBoundary?: boolean
}

export const URL_LEAK_PATTERNS: readonly UrlPattern[] = [
  {
    regex: /\{\{[^{}]*\}\}|%7B%7B.*?%7D%7D|%7B%7B/gi,
    severity: "error",
    label: "Unreplaced {{ }} placeholder in URL"
  },
  {
    regex: /\$\{[^{}]*\}|(?:\$|%24)%7B[^]*?%7D|%24%7B/gi,
    severity: "error",
    label: "Unreplaced ${ } placeholder in URL"
  },
  {
    regex: /\[object(?: |%20|\+)\w+\]|%5Bobject(?: |%20|\+)\w+%5D/gi,
    severity: "error",
    label: "[object Object] in URL"
  },
  {
    regex: /(?<![A-Za-z0-9])(?:undefined|null|NaN)(?![A-Za-z0-9])/g,
    severity: "error",
    label: "Missing value in URL",
    softBoundary: true
  },
  {
    regex: /(?<![A-Za-z0-9%])%s(?![A-Za-z0-9])/g,
    severity: "error",
    label: "Literal %s placeholder in URL"
  },
  {
    regex: /\{[A-Za-z_][\w.-]*\}|%%[A-Za-z_][\w.-]*%%/g,
    severity: "warning",
    label: "Possible unreplaced macro in URL"
  }
]

const SKIPPED_TEXT_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEMPLATE",
  "TEXTAREA",
  "HEAD"
])

const URL_ATTRIBUTES = ["href", "src", "xlink:href", "poster"]

const SEVERITY_ORDER: Record<TemplateLeakSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2
}

const SOFT_BOUNDARY_CHARS = new Set(["-", "_"])

/** True for values that look like a URL/path, not arbitrary data-* content. */
const looksLikeUrl = (value: string): boolean => {
  const v = value.trim()
  if (v === "" || /\s/.test(v)) return false
  return (
    /^(?:https?:)?\/\//i.test(v) ||
    /^\.{0,2}\//.test(v) ||
    /^[\w.-]+\/[\w./%-]/.test(v) ||
    /\.(?:[a-z0-9]{2,5})(?:[?#]|$)/i.test(v)
  )
}

const compact = (text: string): string => text.replace(/\s+/g, " ").trim()

const excerptAround = (text: string, index: number, length: number): string => {
  const flat = text.replace(/\s+/g, " ")
  // Whitespace collapsing can shift indices; re-locate via the prefix.
  const shifted = text.slice(0, index).replace(/\s+/g, " ").length
  const start0 = Math.max(0, shifted - 0)
  if (flat.length <= MAX_EXCERPT_LENGTH) return flat.trim()
  const half = Math.floor((MAX_EXCERPT_LENGTH - length) / 2)
  let start = Math.max(0, start0 - Math.max(half, 0))
  let end = start + MAX_EXCERPT_LENGTH
  if (end > flat.length) {
    end = flat.length
    start = Math.max(0, end - MAX_EXCERPT_LENGTH)
  }
  return flat.slice(start, end).trim()
}

const shortToken = (token: string): string => {
  const flat = compact(token)
  return flat.length > MAX_TOKEN_LENGTH
    ? `${flat.slice(0, MAX_TOKEN_LENGTH - 1)}…`
    : flat
}

type Match = { index: number; text: string; pattern: TextPattern | UrlPattern }

const findMatches = (
  text: string,
  patterns: readonly (TextPattern | UrlPattern)[]
): Match[] => {
  const taken: Array<[number, number]> = []
  const matches: Match[] = []
  for (const pattern of patterns) {
    for (const m of text.matchAll(pattern.regex)) {
      const index = m.index ?? 0
      const end = index + m[0].length
      if (taken.some(([s, e]) => index < e && end > s)) continue
      taken.push([index, end])
      matches.push({ index, text: m[0], pattern })
    }
  }
  return matches.sort((a, b) => a.index - b.index)
}

type StyleView = Pick<Window, "getComputedStyle">

const isHiddenElement = (
  element: Element,
  view: StyleView | null,
  cache: Map<Element, boolean>
): boolean => {
  const cached = cache.get(element)
  if (cached !== undefined) return cached

  let hidden = false
  if ((element as HTMLElement).hidden === true) {
    hidden = true
  } else if (view) {
    const style = view.getComputedStyle(element)
    hidden =
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse" ||
      style.opacity === "0"
  }
  if (!hidden && element.parentElement) {
    // visibility inherits via computed style, display/opacity need the walk.
    hidden = isHiddenElement(element.parentElement, view, cache)
  }
  cache.set(element, hidden)
  return hidden
}

const addTextIssues = (
  node: Text,
  push: (issue: TemplateLeakIssue) => void
) => {
  const raw = node.nodeValue ?? ""
  if (raw.trim() === "") return
  const parent = node.parentElement ?? undefined
  for (const match of findMatches(raw, TEXT_LEAK_PATTERNS)) {
    const token = shortToken(match.text)
    push({
      kind: "text",
      severity: match.pattern.severity,
      token,
      message: `${match.pattern.label}: "${token}"`,
      excerpt: excerptAround(raw, match.index, match.text.length),
      element: parent
    })
  }
}

const addUrlIssues = (
  value: string,
  source: string,
  element: HTMLElement,
  push: (issue: TemplateLeakIssue) => void
) => {
  for (const match of findMatches(value, URL_LEAK_PATTERNS) as Array<
    Match & { pattern: UrlPattern }
  >) {
    let severity = match.pattern.severity
    if (match.pattern.softBoundary) {
      const before = value[match.index - 1] ?? ""
      const after = value[match.index + match.text.length] ?? ""
      if (SOFT_BOUNDARY_CHARS.has(before) || SOFT_BOUNDARY_CHARS.has(after)) {
        severity = "warning"
      }
    }
    const token = shortToken(match.text)
    push({
      kind: "url",
      severity,
      token,
      message: `${match.pattern.label} (${source}): "${token}"`,
      excerpt: excerptAround(value, match.index, match.text.length),
      element
    })
  }
}

/** Pull the inner targets out of a computed `url("...")` list. */
const extractCssUrls = (value: string): string[] => {
  const urls: string[] = []
  for (const m of value.matchAll(
    /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi
  )) {
    const url = m[1] ?? m[2] ?? m[3] ?? ""
    if (url.trim() !== "") urls.push(url.trim())
  }
  return urls
}

export const checkTemplateLeaks = (
  doc: Document = document
): TemplateLeakResult => {
  const view = doc.defaultView as StyleView | null
  const hiddenCache = new Map<Element, boolean>()
  const seen = new Set<string>()
  const found: TemplateLeakIssue[] = []

  const push = (issue: TemplateLeakIssue) => {
    const key = `${issue.kind}\u0000${issue.token}\u0000${issue.excerpt}`
    if (seen.has(key)) return
    seen.add(key)
    found.push(issue)
  }

  const root: Element | null = doc.body ?? doc.documentElement
  if (root) {
    // Visible text nodes.
    const walkText = (element: Element) => {
      if (SKIPPED_TEXT_TAGS.has(element.tagName.toUpperCase())) return
      if (isHiddenElement(element, view, hiddenCache)) return
      for (const child of Array.from(element.childNodes)) {
        if (child.nodeType === 3) addTextIssues(child as Text, push)
        else if (child.nodeType === 1) walkText(child as Element)
      }
    }
    walkText(root)

    // URLs in attributes and computed background images.
    const elements = [root, ...Array.from(root.querySelectorAll("*"))]
    for (const el of elements) {
      const tag = el.tagName.toUpperCase()
      if (tag === "TEMPLATE") continue
      const html = el as HTMLElement
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase()
        const value = attr.value
        if (URL_ATTRIBUTES.includes(name)) {
          if (/^\s*(?:data|javascript|blob):/i.test(value)) continue
          addUrlIssues(value, name, html, push)
        } else if (name.startsWith("data-") && looksLikeUrl(value)) {
          if (/^\s*(?:data|javascript|blob):/i.test(value)) continue
          addUrlIssues(value, name, html, push)
        }
      }
      if (view) {
        let background = ""
        try {
          background = view.getComputedStyle(el).backgroundImage ?? ""
        } catch {
          background = ""
        }
        if (background && background !== "none") {
          for (const url of extractCssUrls(background)) {
            if (/^\s*(?:data|blob):/i.test(url)) continue
            addUrlIssues(url, "background-image", html, push)
          }
        }
      }
    }
  }

  found.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])

  const errors = found.filter((i) => i.severity === "error").length
  const warnings = found.filter((i) => i.severity === "warning").length

  return {
    issues: found.slice(0, MAX_TEMPLATE_LEAK_ISSUES),
    summary: { total: found.length, errors, warnings }
  }
}

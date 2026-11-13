export type LinkIssueSeverity = "error" | "warning" | "info"

export type LinkIssueKind =
  | "empty-href"
  | "insecure-link"
  | "missing-target"
  | "missing-noopener"
  | "not-visible"
  | "duplicate-href"
  | "empty-clicktag"
  | "insecure-clicktag"

export type LinkIssue = {
  kind: LinkIssueKind
  severity: LinkIssueSeverity
  href: string
  message: string
  /** Number of links collapsed into this issue (only set when > 1). */
  count?: number
  /** First affected element; undefined for globals such as `clickTag`. */
  element?: HTMLElement
}

export type LinkCheckResult = {
  issues: LinkIssue[]
  summary: {
    total: number
    errors: number
    warnings: number
    infos: number
    /** True when more than MAX_LINK_ISSUES were found and the list was cut. */
    truncated: boolean
  }
}

export type LinkCheckOptions = {
  /** Override element measurement (useful where layout is unavailable). */
  measure?: (element: HTMLElement) => { width: number; height: number }
}

export const MAX_LINK_ISSUES = 50
/** Identical issues on this many (or more) links are collapsed into one. */
export const COLLAPSE_THRESHOLD = 3
/** Anchors whose class/id/text/aria suggest an offer, product or logo link. */
export const OFFER_LIKE_PATTERN =
  /offer|logo|product|cta|banner|brand|click(?:tag|able)?|deal|shop|buy/i

const SEVERITY_ORDER: Record<LinkIssueSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2
}

const HTTP_PATTERN = /^\s*http:\/\//i

const isEmptyHref = (href: string): boolean => {
  const value = href.trim().toLowerCase().replace(/\s+/g, "")
  return (
    value === "" ||
    value === "#" ||
    value === "javascript:void(0)" ||
    value === "javascript:void(0);" ||
    value === "javascript:;" ||
    value === "javascript:void()" ||
    /^javascript:void\(.*\);?$/.test(value)
  )
}

const isOfferLike = (element: HTMLElement): boolean => {
  const haystack = [
    typeof element.className === "string" ? element.className : "",
    element.id,
    element.getAttribute("aria-label") ?? "",
    element.getAttribute("title") ?? "",
    element.getAttribute("data-clicktag") !== null ? "clicktag" : "",
    (element.textContent ?? "").slice(0, 80),
    // Logo-like anchors often only wrap an image.
    element.querySelector("img")?.getAttribute("alt") ?? "",
    element.querySelector("img")?.getAttribute("src") ?? ""
  ].join(" ")
  return OFFER_LIKE_PATTERN.test(haystack)
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

const defaultMeasure = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect()
  return { width: rect.width, height: rect.height }
}

const describe = (href: string): string => (href === "" ? "(empty)" : href)

type Candidate = LinkIssue & { key: string }

export const checkLinksInDocument = (
  doc: Document = document,
  options: LinkCheckOptions = {}
): LinkCheckResult => {
  const measure = options.measure ?? defaultMeasure
  const candidates: Candidate[] = []
  const push = (issue: LinkIssue, groupHref = issue.href) => {
    candidates.push({ ...issue, key: `${issue.kind}\u0000${groupHref}` })
  }

  const anchors = Array.from(doc.querySelectorAll<HTMLElement>("a[href]"))
  const anchorSet = new Set(anchors)
  const hrefCounts = new Map<string, { count: number; first: HTMLElement }>()

  for (const anchor of anchors) {
    if (isHidden(anchor, doc)) continue

    const href = anchor.getAttribute("href") ?? ""
    const trimmed = href.trim()

    if (isEmptyHref(trimmed)) {
      if (isOfferLike(anchor)) {
        push({
          kind: "empty-href",
          severity: "error",
          href: describe(trimmed),
          message: `Offer/logo link has an empty or placeholder href (${describe(trimmed)})`,
          element: anchor
        })
      }
    } else {
      const entry = hrefCounts.get(trimmed)
      if (entry) entry.count++
      else hrefCounts.set(trimmed, { count: 1, first: anchor })

      if (HTTP_PATTERN.test(trimmed)) {
        push({
          kind: "insecure-link",
          severity: "warning",
          href: trimmed,
          message: "Link uses http:// (mixed content on https pages)",
          element: anchor
        })
      }
    }

    const target = (anchor.getAttribute("target") ?? "").trim().toLowerCase()
    if (target !== "_blank") {
      push({
        kind: "missing-target",
        severity: "warning",
        href: describe(trimmed),
        message: target
          ? `Link target is "${target}" instead of _blank`
          : "Link has no target=\"_blank\"",
        element: anchor
      })
    } else {
      const rel = (anchor.getAttribute("rel") ?? "").toLowerCase().split(/\s+/)
      if (!rel.includes("noopener") && !rel.includes("noreferrer")) {
        push({
          kind: "missing-noopener",
          severity: "info",
          href: describe(trimmed),
          message: 'target="_blank" link is missing rel="noopener"',
          element: anchor
        })
      }
    }

    const { width, height } = measure(anchor)
    if (width <= 0 || height <= 0) {
      push({
        kind: "not-visible",
        severity: "info",
        href: describe(trimmed),
        message: "Link has zero size and cannot be clicked",
        element: anchor
      })
    }
  }

  // Non-anchor click hints: data-href / data-clicktag (and onclick for visibility).
  const hinted = Array.from(
    doc.querySelectorAll<HTMLElement>("[onclick], [data-href], [data-clicktag]")
  ).filter((el) => !anchorSet.has(el))

  for (const el of hinted) {
    if (isHidden(el, doc)) continue
    for (const attr of ["data-href", "data-clicktag"]) {
      const raw = el.getAttribute(attr)
      if (raw === null) continue
      const value = raw.trim()
      if (isEmptyHref(value)) {
        push({
          kind: "empty-href",
          severity: "warning",
          href: describe(value),
          message: `${attr} is empty or a placeholder`,
          element: el
        })
      } else if (HTTP_PATTERN.test(value)) {
        push({
          kind: "insecure-link",
          severity: "warning",
          href: value,
          message: `${attr} uses http:// (mixed content on https pages)`,
          element: el
        })
      }
    }
    const { width, height } = measure(el)
    if (width <= 0 || height <= 0) {
      push({
        kind: "not-visible",
        severity: "info",
        href: describe(el.getAttribute("data-href") ?? ""),
        message: "Clickable element has zero size",
        element: el
      })
    }
  }

  // clickTag globals.
  const view = doc.defaultView as
    | (Window & { clickTag?: unknown; clickTAG?: unknown })
    | null
  if (view) {
    for (const name of ["clickTag", "clickTAG"] as const) {
      let value: unknown
      try {
        value = view[name]
      } catch {
        continue
      }
      if (value === undefined) continue
      const str = typeof value === "string" ? value.trim() : ""
      if (isEmptyHref(str)) {
        push({
          kind: "empty-clicktag",
          severity: "error",
          href: describe(str),
          message: `${name} global is empty or not a string`
        })
      } else if (HTTP_PATTERN.test(str)) {
        push({
          kind: "insecure-clicktag",
          severity: "warning",
          href: str,
          message: `${name} global uses http:// (mixed content)`
        })
      }
    }
  }

  // Duplicate identical hrefs.
  for (const [href, { count, first }] of hrefCounts) {
    if (count >= COLLAPSE_THRESHOLD) {
      push({
        kind: "duplicate-href",
        severity: "info",
        href,
        count,
        message: `Same href used by ${count} links`,
        element: first
      })
    }
  }

  // Collapse same kind + href groups that reach the threshold.
  const groups = new Map<string, Candidate[]>()
  for (const c of candidates) {
    const list = groups.get(c.key)
    if (list) list.push(c)
    else groups.set(c.key, [c])
  }

  const collapsed: LinkIssue[] = []
  const emitted = new Set<string>()
  for (const c of candidates) {
    const group = groups.get(c.key)!
    const { key: _key, ...issue } = c
    if (group.length >= COLLAPSE_THRESHOLD && c.kind !== "duplicate-href") {
      if (emitted.has(c.key)) continue
      emitted.add(c.key)
      collapsed.push({
        ...issue,
        count: group.length,
        message: `${issue.message} (${group.length} links)`
      })
    } else {
      collapsed.push(issue)
    }
  }

  collapsed.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  )

  const errors = collapsed.filter((i) => i.severity === "error").length
  const warnings = collapsed.filter((i) => i.severity === "warning").length
  const infos = collapsed.length - errors - warnings

  return {
    issues: collapsed.slice(0, MAX_LINK_ISSUES),
    summary: {
      total: collapsed.length,
      errors,
      warnings,
      infos,
      truncated: collapsed.length > MAX_LINK_ISSUES
    }
  }
}

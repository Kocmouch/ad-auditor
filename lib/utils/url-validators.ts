export const TARGET_HOSTS = new Set([
  "creatives-preview.rtbhouse.com",
  "statics.creativecdn.com",
  "ams.creativecdn.com"
])

export const CACHE_CONTROL_HOSTS = new Set([
  "creatives-preview.rtbhouse.com",
  "ams.creativecdn.com"
])

export const isTargetAuditUrl = (url: string): boolean => {
  if (!url) {
    return false
  }

  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" && TARGET_HOSTS.has(parsed.hostname)
  } catch {
    return false
  }
}

export const isCacheControlUrl = (url: string): boolean => {
  if (!url) {
    return false
  }

  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" && CACHE_CONTROL_HOSTS.has(parsed.hostname)
  } catch {
    return false
  }
}

export const normalizeDocumentUrl = (url: string): string => {
  if (!url) {
    return ""
  }

  try {
    const parsed = new URL(url)
    parsed.hash = ""
    return parsed.href
  } catch {
    return url
  }
}

export const getDocumentKey = (normalizedUrl: string): string => {
  if (!normalizedUrl) {
    return ""
  }

  try {
    const parsed = new URL(normalizedUrl)
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    return normalizedUrl
  }
}

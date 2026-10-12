export const formatBytes = (bytes: number): string => {
  if (bytes >= 1000000) {
    return `${(bytes / 1000000).toFixed(2)} MB`
  }

  return `${(bytes / 1000).toFixed(2)} kB`
}

export const shortUrl = (url: string): string => {
  if (!url) {
    return "(unknown URL)"
  }

  const maxLength = 110
  if (url.length <= maxLength) {
    return url
  }

  return `${url.slice(0, maxLength - 1)}…`
}

export const normalizeDocumentUrl = (url: string): string => {
  if (!url) {
    return ""
  }

  try {
    const parsed = new URL(url)
    parsed.hash = ""
    return parsed.toString()
  } catch {
    return url
  }
}

export const getDocumentKey = (url: string): string => {
  if (!url) {
    return ""
  }

  try {
    const parsed = new URL(normalizeDocumentUrl(url))
    return `${parsed.origin.toLowerCase()}${parsed.pathname}${parsed.search}`
  } catch {
    return normalizeDocumentUrl(url)
  }
}

export const getUrlHost = (url: string): string => {
  if (!url) {
    return ""
  }

  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ""
  }
}

export const asNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  return 0
}

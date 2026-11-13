export const AMS_HOSTNAME = "ams.creativecdn.com"
export const AMS_PREVIEW_PATH = "/ad/creatives"

export type LocationLike = {
  hostname: string
  pathname: string
  search: string
}

export const isStandaloneAmsPreviewLocation = (loc: LocationLike): boolean => {
  if (loc.hostname !== AMS_HOSTNAME || loc.pathname !== AMS_PREVIEW_PATH) {
    return false
  }

  return new URLSearchParams(loc.search).get("preview") === "true"
}

/** First iframe src that points at the AMS preview page, resolved to a URL. */
export const findNestedAmsPreviewUrl = (
  iframeSrcs: string[],
  baseUrl: string
): string => {
  for (const src of iframeSrcs) {
    if (!src) {
      continue
    }

    try {
      const parsed = new URL(src, baseUrl)
      if (
        parsed.hostname === AMS_HOSTNAME &&
        parsed.pathname === AMS_PREVIEW_PATH &&
        parsed.searchParams.get("preview") === "true"
      ) {
        return parsed.toString()
      }
    } catch {
      // Ignore unparsable iframe URLs.
    }
  }

  return ""
}

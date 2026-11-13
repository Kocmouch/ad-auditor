import type { RequestListItem } from "~lib/request-list"

/**
 * The base record (`RequestListItem`) carries only url/type/size/status. The
 * fields below are optional extras that the CDP network tracker may fill in;
 * every check that needs one is skipped when it is absent.
 */
export type RequestRecord = RequestListItem & {
  /** HTTP response status code. */
  httpStatus?: number
  /** True when the request failed (net::ERR_*, loadingFailed). */
  failed?: boolean
  /** True when the request was blocked (CSP, mixed content, extension...). */
  blocked?: boolean
  /** CDP errorText / blockedReason, used in messages. */
  errorText?: string
  /** Response `content-encoding` header ("" means none). */
  contentEncoding?: string
  /** Uncompressed body size in bytes. Falls back to `transferred`. */
  decodedBytes?: number
  /** URLs that redirected to this request, in order (excluding this url). */
  redirectChain?: string[]
}

export type RequestProblemSeverity = "error" | "warning"

export type RequestProblemKind =
  | "http-error"
  | "failed"
  | "blocked"
  | "mixed-content"
  | "uncompressed"
  | "redirect-chain"

export type RequestProblem = {
  kind: RequestProblemKind
  severity: RequestProblemSeverity
  url: string
  status?: number
  message: string
}

export type RequestProblemsResult = {
  problems: RequestProblem[]
  summary: { total: number; errors: number; warnings: number }
}

export type RequestProblemOptions = {
  /** Min HTTP status treated as an error. */
  minErrorStatus?: number
  /** Min size (bytes) for the uncompressed-text check. */
  uncompressedMinBytes?: number
  /** Min number of redirects before a chain is reported. */
  redirectChainMinHops?: number
  /** Cap on returned problems. */
  maxProblems?: number
}

export const MIN_ERROR_STATUS = 400
export const UNCOMPRESSED_MIN_BYTES = 20 * 1024
export const REDIRECT_CHAIN_MIN_HOPS = 2
export const MAX_REQUEST_PROBLEMS = 100

const COMPRESSED_ENCODING = /\b(gzip|br|brotli|deflate|zstd|x-gzip)\b/i
const TEXT_TYPES = new Set(["script", "stylesheet", "document", "xhr", "fetch"])
const TEXT_EXTENSIONS = new Set([
  "js",
  "mjs",
  "css",
  "html",
  "htm",
  "json",
  "svg"
])

const pathExtension = (url: string): string => {
  const path = url.split(/[?#]/, 1)[0]
  const match = /\.([a-z0-9]+)$/i.exec(path)
  return match ? match[1].toLowerCase() : ""
}

const isCompressibleText = (record: RequestRecord): boolean => {
  const ext = pathExtension(record.url)
  if (TEXT_EXTENSIONS.has(ext)) return true
  // Fall back on resource type only when the extension tells nothing.
  if (ext === "" && TEXT_TYPES.has(record.type.trim().toLowerCase())) {
    return true
  }
  return false
}

const formatKb = (bytes: number): string => `${(bytes / 1024).toFixed(1)} kB`

export const findRequestProblems = (
  requests: RequestRecord[],
  opts: RequestProblemOptions = {}
): RequestProblemsResult => {
  const minErrorStatus = opts.minErrorStatus ?? MIN_ERROR_STATUS
  const minBytes = opts.uncompressedMinBytes ?? UNCOMPRESSED_MIN_BYTES
  const minHops = opts.redirectChainMinHops ?? REDIRECT_CHAIN_MIN_HOPS
  const max = opts.maxProblems ?? MAX_REQUEST_PROBLEMS

  const problems: RequestProblem[] = []

  for (const request of requests) {
    const { url, httpStatus } = request

    if (typeof httpStatus === "number" && httpStatus >= minErrorStatus) {
      const message =
        httpStatus === 404
          ? "Resource not found (404)"
          : httpStatus === 410
            ? "Resource is gone (410)"
            : `Request failed with HTTP ${httpStatus}`
      problems.push({
        kind: "http-error",
        severity: "error",
        url,
        status: httpStatus,
        message
      })
    }

    if (request.blocked) {
      problems.push({
        kind: "blocked",
        severity: "error",
        url,
        message: request.errorText
          ? `Request was blocked (${request.errorText})`
          : "Request was blocked"
      })
    } else if (request.failed) {
      problems.push({
        kind: "failed",
        severity: "error",
        url,
        message: request.errorText
          ? `Request failed (${request.errorText})`
          : "Request failed"
      })
    }

    if (/^http:\/\//i.test(url)) {
      problems.push({
        kind: "mixed-content",
        severity: "warning",
        url,
        message: "Resource loaded over insecure http:// (mixed content)"
      })
    }

    if (
      request.contentEncoding !== undefined &&
      !COMPRESSED_ENCODING.test(request.contentEncoding) &&
      isCompressibleText(request)
    ) {
      const size = request.decodedBytes ?? request.transferred
      if (size > minBytes) {
        problems.push({
          kind: "uncompressed",
          severity: "warning",
          url,
          message: `Text resource of ${formatKb(size)} is served without gzip/br compression`
        })
      }
    }

    const hops = request.redirectChain?.length ?? 0
    if (hops >= minHops) {
      problems.push({
        kind: "redirect-chain",
        severity: "warning",
        url,
        message: `Request went through ${hops} redirects`
      })
    }
  }

  const errors = problems.filter((p) => p.severity === "error").length
  return {
    problems: problems.slice(0, max),
    summary: {
      total: problems.length,
      errors,
      warnings: problems.length - errors
    }
  }
}

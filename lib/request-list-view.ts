import { buildWaterfallLite, filterFocusOffenders } from "~lib/insights"
import {
  filterAndSortRequestItems,
  type RequestListItem,
  type RequestSort,
  type RequestStatusFilter
} from "~lib/request-list"
import { formatBytes, shortUrl } from "~lib/utils/formatters"

export const REQUEST_LIST_LIMIT = 100
export const WATERFALL_MAX_BARS = 5

export type RequestControlValues = {
  hostQuery: string
  showAll: boolean
  sort: string
  status: string
  type: string
}

export type RequestRowView = {
  meta: string
  url: string
}

export type WaterfallRowView = {
  label: string
  metric: string
  widthPercent: number
}

export type RequestListView = {
  /** "No requests match..." / "Showing top N..." line, if any. */
  footer: string | null
  rows: RequestRowView[]
  summary: string
  waterfall: WaterfallRowView[]
}

export const parseRequestSort = (value: string): RequestSort =>
  value === "resources_desc" || value === "url_asc"
    ? value
    : "transferred_desc"

export const parseRequestStatus = (value: string): RequestStatusFilter =>
  value === "done" || value === "pending" ? value : "all"

export const formatRequestMeta = (item: RequestListItem): string =>
  `[${item.type}] ${formatBytes(item.transferred)} / ${formatBytes(item.resources)} ${item.status === "done" ? "done" : "pending"}`

export const getRequestPanelSourceItems = (
  items: RequestListItem[],
  focusOffenders: boolean,
  limitBytes: number
): RequestListItem[] =>
  focusOffenders ? filterFocusOffenders(items, limitBytes) : items

export const buildWaterfallRows = (
  items: RequestListItem[],
  maxBars = WATERFALL_MAX_BARS
): WaterfallRowView[] =>
  buildWaterfallLite(items, maxBars).map((entry) => ({
    label: shortUrl(entry.label),
    metric: formatBytes(entry.transferred),
    widthPercent: Math.round(entry.ratio * 100)
  }))

/** Pure view-model for the request list. */
export const buildRequestListView = (
  sourceItems: RequestListItem[],
  controls: RequestControlValues,
  options: { focusOffenders: boolean; waterfallEnabled: boolean }
): RequestListView => {
  if (sourceItems.length === 0) {
    return { footer: null, rows: [], summary: "0/0 requests", waterfall: [] }
  }

  const result = filterAndSortRequestItems(
    sourceItems,
    {
      hostQuery: controls.hostQuery,
      showAll: controls.showAll,
      sort: parseRequestSort(controls.sort),
      status: parseRequestStatus(controls.status),
      type: controls.type || "all"
    },
    REQUEST_LIST_LIMIT
  )

  let footer: string | null = null
  if (result.visibleItems.length === 0) {
    footer = "No requests match current filters."
  } else if (result.hasMore && !controls.showAll) {
    footer = `Showing top ${REQUEST_LIST_LIMIT}. Enable Show all to see every request.`
  }

  return {
    footer,
    rows: result.visibleItems.map((item) => ({
      meta: formatRequestMeta(item),
      url: shortUrl(item.url)
    })),
    summary: `${result.visibleItems.length}/${result.filteredCount}/${result.totalCount} requests${options.focusOffenders ? " (focus)" : ""}`,
    waterfall: options.waterfallEnabled
      ? buildWaterfallRows(result.visibleItems)
      : []
  }
}

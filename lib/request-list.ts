export type RequestListItem = {
  host: string
  resources: number
  status: "done" | "pending"
  transferred: number
  type: string
  url: string
}

export type RequestSort = "transferred_desc" | "resources_desc" | "url_asc"
export type RequestStatusFilter = "all" | "done" | "pending"

export type RequestListFilters = {
  hostQuery: string
  showAll: boolean
  sort: RequestSort
  status: RequestStatusFilter
  type: string
}

export type RequestListResult = {
  filteredCount: number
  hasMore: boolean
  totalCount: number
  visibleItems: RequestListItem[]
}

const normalizeValue = (value: string): string => value.trim().toLowerCase()

export const getRequestTypes = (items: RequestListItem[]): string[] => {
  const unique = new Set<string>()

  for (const item of items) {
    const normalizedType = item.type.trim()
    if (!normalizedType) {
      continue
    }

    unique.add(normalizedType)
  }

  return Array.from(unique).sort((left, right) => left.localeCompare(right))
}

const sortRequestItems = (
  items: RequestListItem[],
  sort: RequestSort
): RequestListItem[] => {
  if (sort === "resources_desc") {
    return [...items].sort((left, right) => right.resources - left.resources)
  }

  if (sort === "url_asc") {
    return [...items].sort((left, right) => left.url.localeCompare(right.url))
  }

  return [...items].sort((left, right) => right.transferred - left.transferred)
}

export const filterAndSortRequestItems = (
  items: RequestListItem[],
  filters: RequestListFilters,
  limit: number
): RequestListResult => {
  const hostQuery = normalizeValue(filters.hostQuery)
  const normalizedType = normalizeValue(filters.type)

  const filteredItems = items.filter((item) => {
    if (filters.status !== "all" && item.status !== filters.status) {
      return false
    }

    if (normalizedType && normalizedType !== "all") {
      if (normalizeValue(item.type) !== normalizedType) {
        return false
      }
    }

    if (hostQuery) {
      if (!normalizeValue(item.host).includes(hostQuery)) {
        return false
      }
    }

    return true
  })

  const sortedItems = sortRequestItems(filteredItems, filters.sort)
  const visibleItems = filters.showAll ? sortedItems : sortedItems.slice(0, limit)

  return {
    filteredCount: filteredItems.length,
    hasMore: sortedItems.length > visibleItems.length,
    totalCount: items.length,
    visibleItems
  }
}

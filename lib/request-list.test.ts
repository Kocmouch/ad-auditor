import { describe, expect, test } from "bun:test"

import { filterAndSortRequestItems, getRequestTypes } from "./request-list"

const SAMPLE_ITEMS = [
  {
    host: "a.example.com",
    resources: 450,
    status: "done" as const,
    transferred: 200,
    type: "script",
    url: "https://a.example.com/a.js"
  },
  {
    host: "b.example.com",
    resources: 1200,
    status: "pending" as const,
    transferred: 900,
    type: "image",
    url: "https://b.example.com/b.png"
  },
  {
    host: "a.example.com",
    resources: 250,
    status: "done" as const,
    transferred: 700,
    type: "script",
    url: "https://a.example.com/c.js"
  }
]

describe("request-list filters", () => {
  test("returns unique sorted request types", () => {
    expect(getRequestTypes(SAMPLE_ITEMS)).toEqual(["image", "script"])
  })

  test("filters by status, type and host", () => {
    const result = filterAndSortRequestItems(
      SAMPLE_ITEMS,
      {
        hostQuery: "a.example",
        showAll: true,
        sort: "transferred_desc",
        status: "done",
        type: "script"
      },
      100
    )

    expect(result.filteredCount).toBe(2)
    expect(result.visibleItems.map((item) => item.url)).toEqual([
      "https://a.example.com/c.js",
      "https://a.example.com/a.js"
    ])
  })

  test("limits results when showAll is disabled", () => {
    const result = filterAndSortRequestItems(
      SAMPLE_ITEMS,
      {
        hostQuery: "",
        showAll: false,
        sort: "resources_desc",
        status: "all",
        type: "all"
      },
      1
    )

    expect(result.filteredCount).toBe(3)
    expect(result.visibleItems).toHaveLength(1)
    expect(result.hasMore).toBe(true)
    expect(result.visibleItems[0].url).toBe("https://b.example.com/b.png")
  })
})

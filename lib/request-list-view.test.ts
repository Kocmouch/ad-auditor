import { describe, expect, test } from "bun:test"

import type { RequestProblemsResult } from "./features/request-errors"
import type { RequestListItem } from "./request-list"
import {
  buildProblemsView,
  buildRequestListView,
  formatRequestMeta,
  getRequestPanelSourceItems,
  parseRequestSort,
  parseRequestStatus,
  REQUEST_LIST_LIMIT
} from "./request-list-view"

const item = (overrides: Partial<RequestListItem> = {}): RequestListItem => ({
  host: "a.example.com",
  resources: 2000,
  status: "done",
  transferred: 1000,
  type: "script",
  url: "https://a.example.com/a.js",
  ...overrides
})

const controls = {
  hostQuery: "",
  showAll: false,
  sort: "transferred_desc",
  status: "all",
  type: "all"
}

describe("request list view", () => {
  test("normalises unknown sort/status values", () => {
    expect(parseRequestSort("bogus")).toBe("transferred_desc")
    expect(parseRequestSort("url_asc")).toBe("url_asc")
    expect(parseRequestStatus("")).toBe("all")
    expect(parseRequestStatus("pending")).toBe("pending")
  })

  test("formats row meta", () => {
    expect(formatRequestMeta(item())).toBe("[script] 1.00 kB / 2.00 kB done")
    expect(formatRequestMeta(item({ status: "pending" }))).toContain("pending")
  })

  test("empty source shows zero summary and no rows", () => {
    expect(
      buildRequestListView([], controls, {
        focusOffenders: false,
        waterfallEnabled: true
      })
    ).toEqual({ footer: null, rows: [], summary: "0/0 requests", waterfall: [] })
  })

  test("summary, rows and focus suffix", () => {
    const view = buildRequestListView(
      [item(), item({ transferred: 5000, url: "https://a.example.com/b.js" })],
      controls,
      { focusOffenders: true, waterfallEnabled: false }
    )
    expect(view.summary).toBe("2/2/2 requests (focus)")
    expect(view.rows[0].url).toBe("https://a.example.com/b.js")
    expect(view.waterfall).toEqual([])
    expect(view.footer).toBeNull()
  })

  test("footer when filters match nothing", () => {
    const view = buildRequestListView(
      [item()],
      { ...controls, status: "pending" },
      { focusOffenders: false, waterfallEnabled: false }
    )
    expect(view.footer).toBe("No requests match current filters.")
    expect(view.summary).toBe("0/0/1 requests")
  })

  test("footer when more than the limit and not showing all", () => {
    const many = Array.from({ length: REQUEST_LIST_LIMIT + 5 }, (_, i) =>
      item({ url: `https://a.example.com/${i}.js` })
    )
    const options = { focusOffenders: false, waterfallEnabled: true }
    const limited = buildRequestListView(many, controls, options)
    expect(limited.rows).toHaveLength(REQUEST_LIST_LIMIT)
    expect(limited.footer).toContain(`top ${REQUEST_LIST_LIMIT}`)
    expect(limited.waterfall).toHaveLength(5)

    const all = buildRequestListView(
      many,
      { ...controls, showAll: true },
      options
    )
    expect(all.rows).toHaveLength(many.length)
    expect(all.footer).toBeNull()
  })

  test("focus offenders keeps pending and heavy requests", () => {
    const light = item({ resources: 10, transferred: 10 })
    const pending = item({ resources: 0, status: "pending", transferred: 0 })
    expect(getRequestPanelSourceItems([light, pending], true, 1_000_000)).toEqual(
      [pending]
    )
    expect(
      getRequestPanelSourceItems([light, pending], false, 1_000_000)
    ).toHaveLength(2)
  })
})

describe("buildProblemsView", () => {
  const problem = (
    severity: "error" | "warning",
    n: number
  ): RequestProblemsResult["problems"][number] => ({
    kind: severity === "error" ? "http-error" : "mixed-content",
    message: `msg ${n}`,
    severity,
    url: `https://a.example.com/${n}`
  })

  test("is empty without problems", () => {
    expect(
      buildProblemsView({
        problems: [],
        summary: { errors: 0, total: 0, warnings: 0 }
      })
    ).toEqual({ footer: null, rows: [], title: null })
  })

  test("lists errors first with a counted title", () => {
    const view = buildProblemsView({
      problems: [problem("warning", 1), problem("error", 2)],
      summary: { errors: 1, total: 2, warnings: 1 }
    })
    expect(view.title).toBe("Problems: 1 error, 1 warning")
    expect(view.rows.map((row) => row.severity)).toEqual(["error", "warning"])
    expect(view.rows[0].text).toBe("msg 2 - https://a.example.com/2")
    expect(view.footer).toBeNull()
  })

  test("caps rows and reports the remainder", () => {
    const problems = Array.from({ length: 5 }, (_, n) => problem("error", n))
    const view = buildProblemsView(
      { problems, summary: { errors: 5, total: 7, warnings: 0 } },
      3
    )
    expect(view.rows.length).toBe(3)
    expect(view.footer).toBe("+4 more")
  })
})

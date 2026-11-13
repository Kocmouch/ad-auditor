import { describe, expect, test } from "bun:test"

import { renderAlertLines } from "./badge-parts"
import { createIcon, ICONS, type IconName } from "./icons"
import { createPanelMount } from "./panel-mount"
import { createRequestPanel, updateRequestPanel } from "./request-panel"

describe("icons", () => {
  test("builds svg elements from specs without innerHTML", () => {
    for (const name of Object.keys(ICONS) as IconName[]) {
      const svg = createIcon(name)
      expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg")
      expect(svg.children.length).toBe(ICONS[name].shapes.length)
      expect(svg.getAttribute("viewBox")).toBe(ICONS[name].viewBox)
    }
    expect(createIcon("accessibility").hasAttribute("stroke-linejoin")).toBe(
      false
    )
    expect(createIcon("open").getAttribute("stroke-linejoin")).toBe("round")
  })
})

describe("panel mount", () => {
  test("appends first, then replaces in place", () => {
    const parent = document.createElement("div")
    const mount = createPanelMount(() => parent)
    const first = document.createElement("div")
    const second = document.createElement("div")
    mount.show(first)
    expect(parent.children[0]).toBe(first)
    mount.show(second)
    expect(parent.children.length).toBe(1)
    expect(parent.children[0]).toBe(second)

    second.remove()
    const third = document.createElement("div")
    mount.show(third)
    expect(parent.children[0]).toBe(third)
  })
})

describe("alerts", () => {
  test("renders lines as text and hides when empty", () => {
    const container = document.createElement("div")
    renderAlertLines(container, ["<b>x</b>"])
    expect(container.style.display).toBe("block")
    expect(container.textContent).toBe("- <b>x</b>")
    expect(container.querySelector("b")).toBeNull()
    renderAlertLines(container, [])
    expect(container.style.display).toBe("none")
  })
})

describe("request panel", () => {
  const handlers = {
    onCompareSnapshot() {},
    onControlChange() {},
    onSaveSnapshot() {}
  }
  const items = [
    {
      host: "a.com",
      resources: 3000,
      status: "done" as const,
      transferred: 2000,
      type: "script",
      url: "https://a.com/a.js"
    },
    {
      host: "b.com",
      resources: 100,
      status: "pending" as const,
      transferred: 100,
      type: "image",
      url: "https://b.com/b.png"
    }
  ]
  const base = {
    focusOffenders: false,
    hoverActive: true,
    limitBytes: 1_000_000
  }

  test("builds option elements for status, sort and types", () => {
    const panel = createRequestPanel(handlers)
    expect(Array.from(panel.statusSelect.options).map((o) => o.value)).toEqual([
      "all",
      "done",
      "pending"
    ])
    expect(Array.from(panel.sortSelect.options).map((o) => o.value)).toEqual([
      "transferred_desc",
      "resources_desc",
      "url_asc"
    ])

    updateRequestPanel(panel, {
      ...base,
      enabled: true,
      items,
      waterfallEnabled: true
    })
    expect(Array.from(panel.typeSelect.options).map((o) => o.value)).toEqual([
      "all",
      "image",
      "script"
    ])
    expect(panel.summary.textContent).toBe("2/2/2 requests")
    expect(panel.container.style.display).toBe("flex")
    expect(panel.list.children.length).toBe(2)
    expect(panel.waterfall.style.display).toBe("flex")
  })

  test("hides when disabled or empty and keeps the type selection", () => {
    const panel = createRequestPanel(handlers)
    const options = { ...base, waterfallEnabled: false }

    expect(
      updateRequestPanel(panel, { ...options, enabled: false, items })
    ).toBeNull()
    expect(panel.container.style.display).toBe("none")

    updateRequestPanel(panel, { ...options, enabled: true, items })
    panel.typeSelect.value = "image"
    updateRequestPanel(panel, { ...options, enabled: true, items })
    expect(panel.typeSelect.value).toBe("image")
    expect(panel.list.children.length).toBe(1)
    expect(panel.waterfall.style.display).toBe("none")

    updateRequestPanel(panel, { ...options, enabled: true, items: [] })
    expect(panel.summary.textContent).toBe("0/0 requests")
    expect(panel.container.style.display).toBe("none")
  })
})

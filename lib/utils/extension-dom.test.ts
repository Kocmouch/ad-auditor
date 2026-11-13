import { beforeEach, describe, expect, test } from "bun:test"

import { isExtensionElement } from "~lib/utils/extension-dom"

beforeEach(() => {
  document.body.innerHTML = ""
})

describe("isExtensionElement", () => {
  test("detects our ids and descendants", () => {
    document.body.innerHTML =
      '<div id="ad-auditor-badge"><span id="x">t</span></div><p id="p">hi</p>'
    expect(isExtensionElement(document.getElementById("x"))).toBe(true)
    expect(
      isExtensionElement(document.getElementById("ad-auditor-badge"))
    ).toBe(true)
    expect(isExtensionElement(document.getElementById("p"))).toBe(false)
  })

  test("detects plasmo hosts and nodes inside their shadow root", () => {
    const host = document.createElement("plasmo-csui")
    document.body.appendChild(host)
    const shadow = host.attachShadow({ mode: "open" })
    const svgPath = document.createElement("div")
    shadow.appendChild(svgPath)
    expect(isExtensionElement(host)).toBe(true)
    expect(isExtensionElement(svgPath)).toBe(true)
  })

  test("text nodes inherit from their parent and null is safe", () => {
    document.body.innerHTML = '<div id="ad-auditor-x">hello</div>'
    expect(
      isExtensionElement(document.getElementById("ad-auditor-x")?.firstChild)
    ).toBe(true)
    expect(isExtensionElement(null)).toBe(false)
  })
})

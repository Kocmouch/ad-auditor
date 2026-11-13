import { describe, expect, test } from "bun:test"

import {
  findNestedAmsPreviewUrl,
  isStandaloneAmsPreviewLocation
} from "./audit-url"

describe("audit url helpers", () => {
  test("detects the standalone AMS preview page", () => {
    const base = {
      hostname: "ams.creativecdn.com",
      pathname: "/ad/creatives",
      search: "?preview=true"
    }
    expect(isStandaloneAmsPreviewLocation(base)).toBe(true)
    expect(isStandaloneAmsPreviewLocation({ ...base, search: "" })).toBe(false)
    expect(isStandaloneAmsPreviewLocation({ ...base, pathname: "/other" })).toBe(
      false
    )
    expect(
      isStandaloneAmsPreviewLocation({ ...base, hostname: "example.com" })
    ).toBe(false)
  })

  test("finds the first nested AMS preview iframe", () => {
    const srcs = [
      "",
      "https://other.example.com/ad/creatives?preview=true",
      "https://ams.creativecdn.com/ad/creatives?preview=false",
      "https://ams.creativecdn.com/ad/creatives?preview=true&id=1"
    ]
    expect(findNestedAmsPreviewUrl(srcs, "https://host.example.com/")).toBe(
      "https://ams.creativecdn.com/ad/creatives?preview=true&id=1"
    )
    expect(findNestedAmsPreviewUrl(["not a url"], "")).toBe("")
    expect(findNestedAmsPreviewUrl([], "https://host.example.com/")).toBe("")
  })
})

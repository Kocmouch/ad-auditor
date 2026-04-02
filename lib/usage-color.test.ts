import { describe, expect, test } from "bun:test"

import { getUsageColor } from "./usage-color"

describe("usage color mapping", () => {
  test("returns fallback color for invalid inputs", () => {
    expect(getUsageColor(Number.NaN, 100)).toBe("#7dff6a")
    expect(getUsageColor(50, 0)).toBe("#7dff6a")
  })

  test("maps ratio to hsl color", () => {
    expect(getUsageColor(0, 100)).toBe("hsl(120 90% 58%)")
    expect(getUsageColor(100, 100)).toBe("hsl(0 90% 58%)")
  })
})

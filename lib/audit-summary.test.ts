import { describe, expect, test } from "bun:test"

import {
  accessibilityOutcome,
  contentOutcome,
  fontOutcome,
  getOverallStatus,
  isCheckSeverity,
  requestOutcome,
  withRequestOutcome,
  worstSeverity
} from "./audit-summary"

describe("worstSeverity", () => {
  test("picks the highest severity and defaults to ok", () => {
    expect(worstSeverity([])).toBe("ok")
    expect(worstSeverity(["ok", "info"])).toBe("info")
    expect(worstSeverity(["info", "error", "warning"])).toBe("error")
    expect(worstSeverity([undefined, "warning"])).toBe("warning")
  })

  test("validates severities", () => {
    expect(isCheckSeverity("error")).toBe(true)
    expect(isCheckSeverity("nope")).toBe(false)
    expect(isCheckSeverity(3)).toBe(false)
  })
})

describe("outcomes", () => {
  test("fonts are warnings", () => {
    expect(fontOutcome(0)).toEqual({ count: 0, severity: "ok" })
    expect(fontOutcome(2)).toEqual({ count: 2, severity: "warning" })
  })

  test("accessibility maps issue types to severities", () => {
    expect(accessibilityOutcome([], [])).toEqual({ count: 0, severity: "ok" })
    expect(
      accessibilityOutcome([{ issueType: "contrast-unverifiable" }], [])
    ).toEqual({ count: 1, severity: "info" })
    expect(accessibilityOutcome([], [{ issueType: "invisible" }])).toEqual({
      count: 1,
      severity: "warning"
    })
    expect(
      accessibilityOutcome(
        [{ issueType: "hidden" }],
        [{ issueType: "invisible" }]
      )
    ).toEqual({ count: 2, severity: "error" })
  })

  test("content uses the worst issue severity", () => {
    expect(contentOutcome([])).toEqual({ count: 0, severity: "ok" })
    expect(
      contentOutcome([{ severity: "info" }, { severity: "warning" }])
    ).toEqual({ count: 2, severity: "warning" })
  })

  test("requests: errors beat warnings", () => {
    expect(requestOutcome({ errors: 0, total: 0 }).severity).toBe("ok")
    expect(requestOutcome({ errors: 0, total: 2 }).severity).toBe("warning")
    expect(requestOutcome({ errors: 1, total: 2 }).severity).toBe("error")
  })
})

describe("getOverallStatus", () => {
  test("is none until a check has run", () => {
    expect(getOverallStatus({})).toBe("none")
  })

  test("green when everything is ok or info", () => {
    expect(
      getOverallStatus({
        content: { count: 1, severity: "info" },
        fonts: { count: 0, severity: "ok" }
      })
    ).toBe("green")
  })

  test("amber for warnings and red for errors", () => {
    expect(getOverallStatus({ fonts: { count: 1, severity: "warning" } })).toBe(
      "amber"
    )
    expect(
      getOverallStatus({
        accessibility: { count: 1, severity: "error" },
        fonts: { count: 1, severity: "warning" }
      })
    ).toBe("red")
  })

  test("request problems only count once another check ran", () => {
    const requests = { count: 1, severity: "error" as const }
    expect(getOverallStatus(withRequestOutcome({}, requests))).toBe("none")
    expect(
      getOverallStatus(
        withRequestOutcome({ fonts: { count: 0, severity: "ok" } }, requests)
      )
    ).toBe("red")
  })
})

import { describe, expect, test } from "bun:test"

import { Z_INDEX } from "~lib/ui/theme"

describe("Z_INDEX", () => {
  test("layers are ordered badge < tooltip < panel < audit button < modal < highlight", () => {
    expect(Z_INDEX.badge < Z_INDEX.tooltip).toBe(true)
    expect(Z_INDEX.tooltip < Z_INDEX.panel).toBe(true)
    expect(Z_INDEX.panel < Z_INDEX.auditAllButton).toBe(true)
    expect(Z_INDEX.auditAllButton < Z_INDEX.modalBackdrop).toBe(true)
    expect(Z_INDEX.modalBackdrop < Z_INDEX.modal).toBe(true)
    expect(Z_INDEX.modal < Z_INDEX.highlight).toBe(true)
  })
})

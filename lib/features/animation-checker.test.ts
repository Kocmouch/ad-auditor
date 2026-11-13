import { beforeEach, describe, expect, test } from "bun:test"

import {
  checkAnimations,
  MAX_ANIMATION_ISSUES,
  MAX_RUNNING_ANIMATIONS,
  type AnimationLike
} from "~lib/features/animation-checker"

type Timing = {
  delay?: number
  endDelay?: number
  duration?: number
  iterations?: number
}

const fake = (
  target: Element | null,
  timing: Timing,
  extra: Partial<AnimationLike> = {}
): AnimationLike => ({
  effect: { target, getTiming: () => timing },
  ...extra
})

const run = (anims: AnimationLike[]) =>
  checkAnimations(document, { getAnimations: () => anims })

const el = (html: string): HTMLElement => {
  document.body.insertAdjacentHTML("beforeend", html)
  return document.body.lastElementChild as HTMLElement
}

beforeEach(() => {
  document.body.innerHTML = ""
})

describe("checkAnimations", () => {
  test("no animations or missing API gives clean result", () => {
    const r = checkAnimations(document, { getAnimations: () => [] })
    expect(r.issues).toEqual([])
    expect([r.longestSeconds, r.infiniteCount]).toEqual([0, 0])
    const r2 = checkAnimations({ defaultView: null } as unknown as Document)
    expect(r2.summary.total).toBe(0)
  })

  test("infinite animation warns with name and target", () => {
    const a = el('<div id="box" class="hero"></div>')
    const r = run([
      fake(
        a,
        { duration: 1000, iterations: Infinity },
        { animationName: "pulse" }
      )
    ])
    expect(r.issues).toHaveLength(1)
    expect(r.issues[0].kind).toBe("infinite")
    expect(r.issues[0].severity).toBe("warning")
    expect(r.issues[0].message).toContain("pulse")
    expect(r.issues[0].message).toContain("div#box.hero")
    expect(r.issues[0].element).toBe(a)
    expect(r.infiniteCount).toBe(1)
    expect(r.summary.warnings).toBe(1)
  })

  test("identical infinite animations collapse with count", () => {
    const anims = [1, 2, 3].map(() =>
      fake(
        el("<i></i>"),
        { duration: 500, iterations: Infinity },
        { animationName: "twinkle" }
      )
    )
    const r = run(anims)
    expect(r.issues).toHaveLength(1)
    expect(r.issues[0].count).toBe(3)
    expect(r.infiniteCount).toBe(3)
  })

  test("loader-like infinite animation is info", () => {
    const r = run([
      fake(
        el("<i></i>"),
        { duration: 800, iterations: Infinity },
        { animationName: "Spinner-rotate" }
      )
    ])
    expect(r.issues[0].severity).toBe("info")
    expect(r.summary.warnings).toBe(0)
  })

  test("hidden targets are ignored", () => {
    const a = el('<div style="display:none"></div>')
    const r = run([
      fake(a, { duration: 1000, iterations: Infinity }, { animationName: "x" })
    ])
    expect(r.issues).toEqual([])
    expect(r.infiniteCount).toBe(0)
  })

  test("transitionProperty names unnamed transitions", () => {
    const r = run([
      fake(
        el("<b></b>"),
        { duration: 1000, iterations: Infinity },
        { transitionProperty: "opacity" }
      )
    ])
    expect(r.issues[0].message).toContain("opacity")
  })

  test("duration thresholds", () => {
    const a = el("<div></div>")
    const ok = run([
      fake(a, { delay: 1000, duration: 4000, iterations: 2, endDelay: 500 })
    ])
    expect(ok.issues).toEqual([])
    expect(ok.longestSeconds).toBe(9.5)

    const warn = run([fake(a, { duration: 5000, iterations: 4 })])
    expect(warn.longestSeconds).toBe(20)
    expect(warn.issues[0].kind).toBe("too-long")
    expect(warn.issues[0].severity).toBe("warning")
    expect(warn.issues[0].element).toBe(a)

    const err = run([fake(a, { delay: 5000, duration: 10000, iterations: 3 })])
    expect(err.longestSeconds).toBe(35)
    expect(err.issues[0].severity).toBe("error")
    expect(err.summary.errors).toBe(1)
  })

  test("exactly the limits do not trigger", () => {
    const a = el("<div></div>")
    expect(run([fake(a, { duration: 15000, iterations: 1 })]).issues).toEqual(
      []
    )
    expect(
      run([fake(a, { duration: 30000, iterations: 1 })]).issues[0].severity
    ).toBe("warning")
  })

  test("many running animations is info", () => {
    const anims = Array.from({ length: MAX_RUNNING_ANIMATIONS + 1 }, () =>
      fake(
        el("<i></i>"),
        { duration: 100, iterations: 1 },
        { playState: "running" }
      )
    )
    const r = run(anims)
    expect(r.issues).toHaveLength(1)
    expect(r.issues[0].kind).toBe("many-animations")
    expect(r.issues[0].severity).toBe("info")
    expect(r.issues[0].count).toBe(MAX_RUNNING_ANIMATIONS + 1)

    const finished = anims.map((x) => ({ ...x, playState: "finished" }))
    expect(run(finished).issues).toEqual([])
  })

  test("errors sort first and issues are capped", () => {
    const a = el("<div></div>")
    const r = run([
      fake(a, { duration: 1000, iterations: Infinity }, { animationName: "a" }),
      fake(a, { duration: 40000, iterations: 1 })
    ])
    expect(r.issues.map((i) => i.severity)).toEqual(["error", "warning"])

    const many = Array.from({ length: MAX_ANIMATION_ISSUES + 10 }, (_, i) =>
      fake(
        el("<i></i>"),
        { duration: 1, iterations: Infinity },
        { animationName: `n${i}` }
      )
    )
    const capped = run(many)
    expect(capped.issues).toHaveLength(MAX_ANIMATION_ISSUES)
    expect(capped.summary.total).toBe(MAX_ANIMATION_ISSUES + 10)
  })

  test("tolerates malformed animations and throwing sources", () => {
    const bad = {
      effect: {
        getTiming: () => {
          throw new Error("x")
        }
      }
    } as AnimationLike
    expect(run([bad, { effect: null }]).issues).toEqual([])
    const r = checkAnimations(document, {
      getAnimations: () => {
        throw new Error("boom")
      }
    })
    expect(r.summary.total).toBe(0)
  })
})

describe("extension UI is ignored", () => {
  test("infinite animation inside a plasmo shadow root is not reported", () => {
    const host = document.createElement("plasmo-csui")
    document.body.appendChild(host)
    const inner = host
      .attachShadow({ mode: "open" })
      .appendChild(document.createElement("div"))
    const anim = {
      animationName: "plasmo-loading-animate-svg-fill",
      playState: "running",
      effect: {
        target: inner,
        getTiming: () => ({
          delay: 0,
          duration: 1000,
          iterations: Infinity,
          endDelay: 0
        })
      }
    }
    const result = checkAnimations(document, {
      getAnimations: () => [anim as never]
    })
    expect(result.issues.length).toBe(0)
    expect(result.infiniteCount).toBe(0)
  })
})

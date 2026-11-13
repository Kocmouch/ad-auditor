import { describe, expect, test } from "bun:test"

import { findRequestProblems } from "~lib/features/request-errors"

import {
  getRequestProblemFields,
  handleNetworkLoadingFailed,
  handleNetworkLoadingFinished,
  handleNetworkRequestWillBeSent,
  handleNetworkResponseReceived
} from "./network-tracker"
import type { TabSession } from "./types"

const source = { tabId: 1 } as chrome.debugger.Debuggee

const createSession = (): TabSession => ({
  attachError: null,
  attachPromise: null,
  attached: true,
  childSessionIds: new Set(),
  isTopNavigationInProgress: false,
  lastNavigationUrl: "",
  requestKeyByRequestId: new Map(),
  requestSequenceByRequestId: new Map(),
  requests: new Map()
})

const start = (
  session: TabSession,
  requestId: string,
  url: string,
  redirectStatus?: number
) =>
  handleNetworkRequestWillBeSent(session, source, {
    ...(redirectStatus ? { redirectResponse: { status: redirectStatus } } : {}),
    request: { url },
    requestId,
    type: "Script"
  })

const only = (session: TabSession) => Array.from(session.requests.values())

describe("handleNetworkResponseReceived", () => {
  test("stores status and content-encoding (case-insensitive)", () => {
    const session = createSession()
    start(session, "1", "https://a.test/app.js")
    handleNetworkResponseReceived(session, source, {
      requestId: "1",
      response: {
        headers: { "Content-Encoding": "gzip" },
        status: 200,
        url: "https://a.test/app.js"
      }
    })
    const [metric] = only(session)
    expect(metric.httpStatus).toBe(200)
    expect(metric.contentEncoding).toBe("gzip")
  })

  test("missing header means no encoding; non-http urls are skipped", () => {
    const session = createSession()
    start(session, "1", "https://a.test/app.js")
    start(session, "2", "data:text/css,x")
    handleNetworkResponseReceived(session, source, {
      requestId: "1",
      response: { headers: {}, status: 404, url: "https://a.test/app.js" }
    })
    handleNetworkResponseReceived(session, source, {
      requestId: "2",
      response: { headers: {}, status: 200, url: "data:text/css,x" }
    })
    const [first, second] = only(session)
    expect(first.contentEncoding).toBe("")
    expect(first.httpStatus).toBe(404)
    expect(second.contentEncoding === undefined).toBe(true)
  })

  test("ignores unknown requests and malformed params", () => {
    const session = createSession()
    handleNetworkResponseReceived(session, source, {
      requestId: "9",
      response: { status: 500 }
    })
    handleNetworkResponseReceived(session, source, undefined)
    expect(session.requests.size).toBe(0)
  })
})

describe("handleNetworkLoadingFailed", () => {
  test("marks failures with errorText", () => {
    const session = createSession()
    start(session, "1", "https://a.test/x.png")
    handleNetworkLoadingFailed(session, source, {
      errorText: "net::ERR_NAME_NOT_RESOLVED",
      requestId: "1"
    })
    const [metric] = only(session)
    expect(metric.failed).toBe(true)
    expect(metric.errorText).toBe("net::ERR_NAME_NOT_RESOLVED")
    expect(metric.blocked === undefined).toBe(true)
  })

  test("blockedReason marks the request blocked", () => {
    const session = createSession()
    start(session, "1", "https://a.test/x.png")
    handleNetworkLoadingFailed(session, source, {
      blockedReason: "csp",
      errorText: "net::ERR_BLOCKED_BY_CLIENT",
      requestId: "1"
    })
    const [metric] = only(session)
    expect(metric.blocked).toBe(true)
    expect(metric.errorText).toBe("csp")
    expect(metric.failed === undefined).toBe(true)
  })

  test("cancellations are not reported as failures", () => {
    const session = createSession()
    start(session, "1", "https://a.test/x.png")
    handleNetworkLoadingFailed(session, source, {
      canceled: true,
      errorText: "net::ERR_ABORTED",
      requestId: "1"
    })
    const [metric] = only(session)
    expect(metric.completed).toBe(true)
    expect(metric.failed === undefined).toBe(true)
  })
})

describe("redirects", () => {
  test("tracks the chain and the status of earlier hops", () => {
    const session = createSession()
    start(session, "1", "https://a.test/1")
    start(session, "1", "https://a.test/2", 302)
    start(session, "1", "https://a.test/3", 301)
    const [first, second, third] = only(session)
    expect(first.httpStatus).toBe(302)
    expect(second.httpStatus).toBe(301)
    expect(second.redirectChain).toEqual(["https://a.test/1"])
    expect(third.redirectChain).toEqual([
      "https://a.test/1",
      "https://a.test/2"
    ])
  })
})

describe("getRequestProblemFields", () => {
  test("only returns fields that are set and feeds findRequestProblems", () => {
    const session = createSession()
    start(session, "1", "https://a.test/missing.js")
    handleNetworkResponseReceived(session, source, {
      requestId: "1",
      response: { headers: {}, status: 404, url: "https://a.test/missing.js" }
    })
    handleNetworkLoadingFinished(session, source, {
      encodedDataLength: 10,
      requestId: "1"
    })
    const [metric] = only(session)
    expect(getRequestProblemFields(metric)).toEqual({
      contentEncoding: "",
      httpStatus: 404
    })

    const { problems } = findRequestProblems([
      {
        ...getRequestProblemFields(metric),
        host: "a.test",
        resources: 0,
        status: "done",
        transferred: 10,
        type: "Script",
        url: metric.requestUrl
      }
    ])
    expect(problems.map((problem) => problem.kind)).toEqual(["http-error"])
  })

  test("returns an empty object for a plain request", () => {
    const session = createSession()
    start(session, "1", "https://a.test/ok.js")
    expect(getRequestProblemFields(only(session)[0])).toEqual({})
  })
})

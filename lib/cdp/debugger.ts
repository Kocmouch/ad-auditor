import type { DebuggeeWithSession } from "./types"

export const DEBUGGER_PROTOCOL_VERSION = "1.3"

export const sendDebuggerCommand = <T>(
  debuggee: DebuggeeWithSession,
  method: string,
  params?: Record<string, unknown>
): Promise<T> =>
  new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(
      debuggee as chrome.debugger.Debuggee,
      method,
      params,
      (result) => {
        const err = chrome.runtime.lastError
        if (err) {
          reject(new Error(err.message))
          return
        }

        resolve(result as T)
      }
    )
  })

export const attachDebugger = (tabId: number): Promise<void> =>
  new Promise((resolve, reject) => {
    chrome.debugger.attach({ tabId }, DEBUGGER_PROTOCOL_VERSION, () => {
      const err = chrome.runtime.lastError
      if (err) {
        reject(new Error(err.message))
        return
      }

      resolve()
    })
  })

export const setCacheDisabledForDebuggee = async (
  debuggee: DebuggeeWithSession,
  disableCacheEnabled: boolean
) => {
  await sendDebuggerCommand<void>(debuggee, "Network.setCacheDisabled", {
    cacheDisabled: disableCacheEnabled
  })
}

export const clearBrowserCacheForTab = async (tabId: number) => {
  await sendDebuggerCommand<void>({ tabId }, "Network.clearBrowserCache")
}

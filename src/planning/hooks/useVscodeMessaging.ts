import { useCallback, useEffect, useRef } from 'react'

type VscodeApi = { postMessage: (msg: unknown) => void }

type MessageHandler = (msg: unknown) => void

let vscodeApiInstance: VscodeApi | null = null

function getVscodeApi(): VscodeApi | null {
  if (vscodeApiInstance) return vscodeApiInstance
  try {
    const acquire = (window as Window & { acquireVsCodeApi?: () => VscodeApi }).acquireVsCodeApi
    if (acquire) {
      vscodeApiInstance = acquire()
      return vscodeApiInstance
    }
  } catch {
    // no-op: running outside VS Code webview
  }
  return null
}

// Detect running inside an Obsidian iframe (not VS Code)
function isObsidianIframe(): boolean {
  try {
    return window !== window.parent && !getVscodeApi()
  } catch {
    return false
  }
}

export function useVscodeMessaging() {
  const handlersRef = useRef<Set<MessageHandler>>(new Set())

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      for (const handler of handlersRef.current) {
        handler(event.data)
      }
    }
    window.addEventListener('message', listener)
    return () => window.removeEventListener('message', listener)
  }, [])

  const postMessage = useCallback((msg: unknown) => {
    const api = getVscodeApi()
    if (api) {
      api.postMessage(msg)
    } else if (isObsidianIframe()) {
      window.parent.postMessage(msg, '*')
    }
  }, [])

  const onMessage = useCallback((handler: MessageHandler) => {
    handlersRef.current.add(handler)
    return () => {
      handlersRef.current.delete(handler)
    }
  }, [])

  // isVscode = true for any hosted context (VS Code or Obsidian iframe)
  return { postMessage, onMessage, isVscode: Boolean(getVscodeApi()) || isObsidianIframe() }
}

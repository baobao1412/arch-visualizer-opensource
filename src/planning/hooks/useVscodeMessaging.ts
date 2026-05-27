import { useCallback, useEffect, useRef } from 'react'

type VscodeApi = { postMessage: (msg: unknown) => void }
type MessageHandler = (msg: unknown) => void

// Bridge injected by the Obsidian plugin when running via direct DOM injection
interface ObsidianBridge {
  send: (msg: unknown) => void
  setReceiver: (fn: (msg: unknown) => void) => void
}

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

function getObsidianBridge(): ObsidianBridge | null {
  return (window as Window & { __archVizBridge?: ObsidianBridge }).__archVizBridge ?? null
}

// Detect running inside an Obsidian iframe (not VS Code) — legacy path
function isObsidianIframe(): boolean {
  try {
    return window !== window.parent && !getVscodeApi() && !getObsidianBridge()
  } catch {
    return false
  }
}

export function useVscodeMessaging() {
  const handlersRef = useRef<Set<MessageHandler>>(new Set())

  useEffect(() => {
    const bridge = getObsidianBridge()
    if (bridge) {
      // Register with the Obsidian bridge for incoming messages
      bridge.setReceiver((msg) => {
        for (const handler of handlersRef.current) handler(msg)
      })
      return () => bridge.setReceiver(() => {})
    }

    // VS Code or iframe: listen on window.message
    const listener = (event: MessageEvent) => {
      for (const handler of handlersRef.current) {
        handler(event.data)
      }
    }
    window.addEventListener('message', listener)
    return () => window.removeEventListener('message', listener)
  }, [])

  const postMessage = useCallback((msg: unknown) => {
    const bridge = getObsidianBridge()
    if (bridge) {
      bridge.send(msg)
      return
    }
    const api = getVscodeApi()
    if (api) {
      api.postMessage(msg)
      return
    }
    if (isObsidianIframe()) {
      window.parent.postMessage(msg, '*')
    }
  }, [])

  const onMessage = useCallback((handler: MessageHandler) => {
    handlersRef.current.add(handler)
    return () => { handlersRef.current.delete(handler) }
  }, [])

  const isHosted = Boolean(getVscodeApi()) || Boolean(getObsidianBridge()) || isObsidianIframe()
  return { postMessage, onMessage, isVscode: isHosted }
}

type PersistBag = Record<string, unknown>

type VscodeStateApi = {
  getState: () => unknown
  setState: (state: unknown) => void
}

let apiCache: VscodeStateApi | null | undefined

function getVscodeStateApi(): VscodeStateApi | null {
  if (apiCache !== undefined) return apiCache

  try {
    const acquire = (window as Window & { acquireVsCodeApi?: () => unknown }).acquireVsCodeApi
    if (!acquire) {
      apiCache = null
      return apiCache
    }

    const api = acquire() as VscodeStateApi
    if (typeof api.getState === 'function' && typeof api.setState === 'function') {
      apiCache = api
      return apiCache
    }
  } catch {
    // Ignore and fallback to localStorage.
  }

  apiCache = null
  return apiCache
}

function readBag(): PersistBag {
  const vscodeApi = getVscodeStateApi()
  if (vscodeApi) {
    try {
      const state = vscodeApi.getState() as PersistBag | undefined
      return state && typeof state === 'object' ? state : {}
    } catch {
      return {}
    }
  }

  try {
    const raw = localStorage.getItem('archviz.persist.v1')
    if (!raw) return {}
    const parsed = JSON.parse(raw) as PersistBag
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeBag(next: PersistBag): void {
  const vscodeApi = getVscodeStateApi()
  if (vscodeApi) {
    try {
      vscodeApi.setState(next)
      return
    } catch {
      // Fallback to localStorage below.
    }
  }

  try {
    localStorage.setItem('archviz.persist.v1', JSON.stringify(next))
  } catch {
    // Ignore storage errors.
  }
}

export function readPersist<T>(key: string, fallback: T): T {
  const bag = readBag()
  if (!(key in bag)) return fallback
  return bag[key] as T
}

export function writePersist<T>(key: string, value: T): void {
  const bag = readBag()
  bag[key] = value
  writeBag(bag)
}

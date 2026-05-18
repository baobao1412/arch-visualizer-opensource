import { useEffect, useId, useState } from 'react'

interface Props {
  code: string
}

interface MermaidApi {
  initialize: (config: Record<string, unknown>) => void
  render: (id: string, code: string) => Promise<{ svg: string }>
}

let mermaidInitialized = false
let mermaidLoader: Promise<MermaidApi> | null = null
const svgCache = new Map<string, string>()
const MERMAID_CDN_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs'

async function importFromUrl(url: string): Promise<unknown> {
  return new Function('u', 'return import(/* @vite-ignore */ u)')(url) as Promise<unknown>
}

async function getMermaidApi(): Promise<MermaidApi> {
  if (!mermaidLoader) {
    mermaidLoader = importFromUrl(MERMAID_CDN_URL).then((module) => {
      const typedModule = module as { default?: MermaidApi }
      return typedModule.default ?? (module as MermaidApi)
    })
  }

  return mermaidLoader
}

function ensureMermaidInitialized(mermaid: MermaidApi) {
  if (mermaidInitialized) {
    return
  }

  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
    flowchart: { useMaxWidth: true, htmlLabels: true },
    sequence: { useMaxWidth: true },
  })

  mermaidInitialized = true
}

function hashText(value: string): string {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(16)
}

export default function MermaidRenderer({ code }: Props) {
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string>('')
  const componentId = useId().replace(/:/g, '')

  useEffect(() => {
    let disposed = false
    const codeHash = hashText(code)

    const cached = svgCache.get(codeHash)
    if (cached) {
      setTimeout(() => {
        setError("")
        setSvg(cached)
      }, 0)
      return () => {
        disposed = true
      }
    }

    async function renderDiagram() {
      setSvg('')
      setError('')

      try {
        const mermaid = await getMermaidApi()
        ensureMermaidInitialized(mermaid)
        const renderKey = `mermaid-${componentId}-${codeHash}`
        const result = await mermaid.render(renderKey, code)
        if (!disposed) {
          svgCache.set(codeHash, result.svg)
          setSvg(result.svg)
        }
      } catch (err) {
        if (!disposed) {
          setSvg('')
          setError(err instanceof Error ? err.message : 'Failed to render Mermaid diagram.')
        }
      }
    }

    void renderDiagram()

    return () => {
      disposed = true
    }
  }, [code, componentId])

  if (error) {
    return <div className="mdp-error">Mermaid render error: {error}</div>
  }

  if (!svg) {
    return <div className="mdp-loading">Rendering diagram...</div>
  }

  return <div className="mdp-mermaid" dangerouslySetInnerHTML={{ __html: svg }} />
}

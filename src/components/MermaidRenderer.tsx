import { useEffect, useId, useState } from 'react'
import mermaid from 'mermaid'

interface Props {
  code: string
}

let mermaidInitialized = false

function ensureMermaidInitialized() {
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

    async function renderDiagram() {
      ensureMermaidInitialized()
      setError('')

      try {
        const renderKey = `mermaid-${componentId}-${hashText(code)}`
        const result = await mermaid.render(renderKey, code)
        if (!disposed) {
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

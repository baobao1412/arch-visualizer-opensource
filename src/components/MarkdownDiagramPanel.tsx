import { useEffect, useMemo, useRef, useState } from 'react'
import MermaidRenderer from './MermaidRenderer'
import type { FlowDef } from '../data/flows'
import { buildFlowMarkdown, parseMermaidBlocks } from '../utils/markdownMermaid'

interface Props {
  open: boolean
  onClose: () => void
  activeFlow: FlowDef | null
}

export default function MarkdownDiagramPanel({ open, onClose, activeFlow }: Props) {
  const [markdown, setMarkdown] = useState<string>(() => buildFlowMarkdown(activeFlow))
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const blocks = useMemo(() => parseMermaidBlocks(markdown), [markdown])
  const selected = useMemo(() => {
    if (blocks.length === 0) {
      return null
    }

    const selectedById = selectedBlockId ? blocks.find((block) => block.id === selectedBlockId) : null
    return selectedById ?? blocks[0]
  }, [blocks, selectedBlockId])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && open) {
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  async function onLoadFile(file: File) {
    const text = await file.text()
    setMarkdown(text)
  }

  if (!open) {
    return null
  }

  return (
    <div className="mdp-overlay" role="dialog" aria-modal="true" aria-label="Markdown Mermaid Panel">
      <div className="mdp-backdrop" onClick={onClose} />

      <aside className="mdp-drawer">
        <header className="mdp-header">
          <div>
            <h2>README Mermaid Viewer</h2>
            <p>Supports sequenceDiagram and classDiagram blocks in Markdown.</p>
          </div>
          <button className="mdp-close" onClick={onClose} type="button">
            Close
          </button>
        </header>

        <div className="mdp-toolbar">
          <button
            type="button"
            onClick={() => setMarkdown(buildFlowMarkdown(activeFlow))}
            className="mdp-btn"
          >
            Insert sample sequence/class
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mdp-btn"
          >
            Load README .md
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".md,text/markdown,text/plain"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                void onLoadFile(file)
              }
              event.currentTarget.value = ''
            }}
            style={{ display: 'none' }}
          />

          <span className="mdp-count">Found {blocks.length} Mermaid block(s)</span>
        </div>

        <section className="mdp-grid">
          <div className="mdp-col mdp-col-editor">
            <label htmlFor="mdp-markdown-input" className="mdp-label">
              Markdown content
            </label>
            <textarea
              id="mdp-markdown-input"
              className="mdp-editor"
              value={markdown}
              onChange={(event) => setMarkdown(event.target.value)}
              spellCheck={false}
            />
          </div>

          <div className="mdp-col mdp-col-preview">
            <div className="mdp-label">Detected diagrams</div>
            <div className="mdp-tabs" role="tablist" aria-label="Mermaid diagrams list">
              {blocks.map((block) => {
                const active = selected?.id === block.id
                return (
                  <button
                    type="button"
                    key={block.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedBlockId(block.id)}
                    className={`mdp-tab ${active ? 'is-active' : ''}`}
                  >
                    {block.title}
                  </button>
                )
              })}
            </div>

            {selected ? (
              <>
                <div className="mdp-preview-wrap">
                  <MermaidRenderer code={selected.code} />
                </div>

                <pre className="mdp-code" aria-label="Selected Mermaid code">
                  {selected.code}
                </pre>
              </>
            ) : (
              <div className="mdp-empty">
                No Mermaid block detected. Add block in this format:{' '}
                <code>{'```mermaid ... ```'}</code>
              </div>
            )}
          </div>
        </section>
      </aside>
    </div>
  )
}

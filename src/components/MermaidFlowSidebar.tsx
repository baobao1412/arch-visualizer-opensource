import { useState } from 'react'
import type { MermaidBlock } from '../utils/markdownMermaid'

interface Props {
  blocks: MermaidBlock[]
  activeBlockId: string | null
  onSelect: (blockId: string) => void
  onReorder: (blocks: MermaidBlock[]) => void
}

function moveBlock(blocks: MermaidBlock[], fromId: string, toId: string) {
  const fromIndex = blocks.findIndex((block) => block.id === fromId)
  const toIndex = blocks.findIndex((block) => block.id === toId)

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return blocks
  }

  const next = [...blocks]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

export default function MermaidFlowSidebar({ blocks, activeBlockId, onSelect, onReorder }: Props) {
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null)

  return (
    <aside className="mermaid-sidebar">
      <div className="mermaid-sidebar-header">
        <div className="mermaid-sidebar-title">FLOWS</div>
        <div className="mermaid-sidebar-count">
          README Mermaid selections ({blocks.length})
        </div>
      </div>

      <div className="mermaid-sidebar-list">
        {blocks.map((block) => {
          const active = block.id === activeBlockId
          const dragged = block.id === draggedBlockId
          return (
            <button
              key={block.id}
              type="button"
              onClick={() => onSelect(block.id)}
              draggable
              onDragStart={(event) => {
                setDraggedBlockId(block.id)
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', block.id)
              }}
              onDragEnd={() => setDraggedBlockId(null)}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(event) => {
                event.preventDefault()
                const fromId = event.dataTransfer.getData('text/plain') || draggedBlockId
                if (!fromId || fromId === block.id) {
                  setDraggedBlockId(null)
                  return
                }
                onReorder(moveBlock(blocks, fromId, block.id))
                setDraggedBlockId(null)
              }}
              className={`mermaid-block-btn${active ? ' is-active' : ''}${dragged ? ' is-dragging' : ''}`}
            >
              <div className="mermaid-block-title">
                <span className="mermaid-block-drag-icon" aria-hidden="true">⠿</span>
                <span>{block.title}</span>
              </div>
              <div className="mermaid-block-meta">{block.type} · drag to reorder</div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}

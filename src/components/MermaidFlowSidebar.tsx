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
    <aside
      style={{
        width: 280,
        borderRight: '1px solid #1e293b',
        background: '#0b1020',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '14px 12px 10px', borderBottom: '1px solid #1e293b' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#93c5fd', letterSpacing: '0.06em' }}>FLOWS</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
          README Mermaid selections ({blocks.length})
        </div>
      </div>

      <div style={{ padding: 10, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
              style={{
                textAlign: 'left',
                border: active ? '1px solid #facc15' : '1px solid #23324a',
                background: dragged ? '#13233a' : active ? '#2d250c' : '#0f172a',
                color: active ? '#fde68a' : '#cbd5e1',
                borderRadius: 8,
                padding: '8px 10px',
                cursor: 'pointer',
                opacity: dragged ? 0.65 : 1,
                transition: 'transform 0.12s, background 0.12s, opacity 0.12s',
                transform: dragged ? 'scale(0.98)' : 'scale(1)',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#64748b', fontSize: 10, flexShrink: 0 }}>⠿</span>
                <span>{block.title}</span>
              </div>
              <div style={{ fontSize: 10, color: active ? '#fde68a' : '#7b94b5', marginTop: 3 }}>
                {block.type} · drag to reorder
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}

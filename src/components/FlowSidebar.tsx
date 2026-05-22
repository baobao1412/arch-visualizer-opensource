import { useState } from 'react';
import type { FlowDef } from '../data/flows';

interface Props {
  flows: FlowDef[];
  activeFlow: string | null;
  onSelect: (id: string | null) => void;
  onReorder: (flows: FlowDef[]) => void;
}

function moveFlow(flows: FlowDef[], fromId: string, toId: string) {
  const fromIndex = flows.findIndex((flow) => flow.id === fromId)
  const toIndex = flows.findIndex((flow) => flow.id === toId)

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return flows
  }

  const next = [...flows]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

export default function FlowSidebar({ flows, activeFlow, onSelect, onReorder }: Props) {
  const [draggedFlowId, setDraggedFlowId] = useState<string | null>(null)

  return (
    <aside
      style={{
        width: 260,
        background: '#0c0e18',
        borderRight: '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid #1e293b' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#475569', textTransform: 'uppercase' }}>
          Flows
        </div>
        <div style={{ fontSize: 11, color: '#334155', marginTop: 4 }}>
          Click to highlight a path
        </div>
      </div>

      {/* Flow list */}
      <div style={{ padding: '8px 8px' }}>
        {/* Clear selection */}
        {activeFlow && (
          <button
            onClick={() => onSelect(null)}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '7px 10px',
              marginBottom: 4,
              borderRadius: 6,
              border: '1px solid #1e293b',
              background: 'transparent',
              color: '#475569',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            x Clear selection
          </button>
        )}

        {flows.map((flow) => {
          const active = activeFlow === flow.id;
          const dragged = draggedFlowId === flow.id;
          return (
            <button
              key={flow.id}
              onClick={() => onSelect(active ? null : flow.id)}
              draggable
              onDragStart={(event) => {
                setDraggedFlowId(flow.id)
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', flow.id)
              }}
              onDragEnd={() => setDraggedFlowId(null)}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(event) => {
                event.preventDefault()
                const fromId = event.dataTransfer.getData('text/plain') || draggedFlowId
                if (!fromId || fromId === flow.id) {
                  setDraggedFlowId(null)
                  return
                }

                onReorder(moveFlow(flows, fromId, flow.id))
                setDraggedFlowId(null)
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 10px',
                marginBottom: 4,
                borderRadius: 6,
                border: `1px solid ${active ? flow.color : '#1e293b'}`,
                background: dragged ? '#10233a' : active ? `${flow.color}12` : 'transparent',
                color: active ? flow.color : '#94a3b8',
                fontSize: 12,
                cursor: 'grab',
                transition: 'all 0.15s',
                lineHeight: 1.4,
                opacity: dragged ? 0.72 : 1,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: flow.color,
                  marginRight: 8,
                  flexShrink: 0,
                  verticalAlign: 'middle',
                }}
              />
              <span style={{ color: '#64748b', marginRight: 6 }}>⠿</span>
              {flow.label}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

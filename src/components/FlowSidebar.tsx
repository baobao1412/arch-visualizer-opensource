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
    <aside className="flow-sidebar">
      <div className="flow-sidebar-header">
        <div className="flow-sidebar-title">Flows</div>
        <div className="flow-sidebar-hint">Click to highlight a path</div>
      </div>

      <div className="flow-sidebar-list">
        {activeFlow && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="flow-clear-btn"
          >
            <span aria-hidden="true">✕</span>
            Clear selection
          </button>
        )}

        {flows.map((flow) => {
          const active = activeFlow === flow.id;
          const dragged = draggedFlowId === flow.id;
          return (
            <button
              key={flow.id}
              type="button"
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
              className={`flow-item${active ? ' is-active' : ''}${dragged ? ' is-dragging' : ''}`}
              style={active ? ({
                '--flow-color': flow.color,
                '--flow-color-bg': `${flow.color}12`,
              } as React.CSSProperties) : undefined}
            >
              <span
                className="flow-item-dot"
                style={{ background: flow.color }}
              />
              <span className="flow-item-drag-icon" aria-hidden="true">⠿</span>
              {flow.label}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

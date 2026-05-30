import { useEffect, useMemo, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  useNodesState,
  type Edge,
  type Node,
} from '@xyflow/react'
import type { MermaidBlock } from '../utils/markdownMermaid'
import MermaidRenderer from './MermaidRenderer'
import { parseMermaidToFlow, type MermaidFlowEdgeData } from '../utils/mermaidToFlow'
import { readPersist, writePersist } from '../utils/persist'

interface Props {
  block: MermaidBlock
}

type StoredPositions = Record<string, { x: number; y: number }>

function storageKeyForBlock(blockId: string) {
  return `archviz.mermaid.nodes.${blockId}`
}

function loadStoredPositions(blockId: string): StoredPositions {
  return readPersist<StoredPositions>(storageKeyForBlock(blockId), {})
}

// ─── Segmented toggle ────────────────────────────────────────────────────────
function ViewToggle({
  current,
  onChange,
}: {
  current: 'exact' | 'interactive'
  onChange: (v: 'exact' | 'interactive') => void
}) {
  return (
    <div className="main-mode-toggle">
      <button
        type="button"
        className={`main-mode-btn${current === 'exact' ? ' is-active' : ''}`}
        onClick={() => onChange('exact')}
      >
        Exact
      </button>
      <button
        type="button"
        className={`main-mode-btn${current === 'interactive' ? ' is-active' : ''}`}
        onClick={() => onChange('interactive')}
      >
        Interactive
      </button>
    </div>
  )
}

// ─── Sequence lane SVG ────────────────────────────────────────────────────────
const LANE_COL = 220
const LANE_LEFT = 30
const LANE_BOX_W = 178
const LANE_BOX_H = 40
const LANE_BOX_Y = 10
const LANE_SIG_Y0 = LANE_BOX_Y + LANE_BOX_H + 26
const LANE_SIG_DY = 52
const LANE_ARROW = 7
const SEQ_LINE = '#facc15'
const SEQ_LINE_SOFT = '#fde68a'
const SEQ_LINE_DIM = '#7c5b00'
const SEQ_LINE_FAINT = '#3f2d06'
const SEQ_BG_ACTIVE = 'rgba(250, 204, 21, 0.10)'
const SEQ_BG_PREFERRED = 'rgba(250, 204, 21, 0.06)'

type SeqViewSignal = {
  id: string
  order: number
  fromId: string
  toId: string
  signal: string
  lineNumber: number
}

function truncSeq(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function SequenceLaneSVG({
  participants,
  signals,
  selectedId,
  selectedParticipantId,
  onSelectSignal,
  onSelectParticipant,
}: {
  participants: Array<{ id: string; label: string }>
  signals: SeqViewSignal[]
  selectedId: string | null
  selectedParticipantId: string | null
  onSelectSignal: (id: string) => void
  onSelectParticipant: (id: string) => void
}) {
  const totalW = Math.max(LANE_LEFT * 2 + participants.length * LANE_COL, 520)
  const totalH = LANE_SIG_Y0 + signals.length * LANE_SIG_DY + 50

  const pcx = (id: string) => {
    const idx = participants.findIndex((p) => p.id === id)
    return LANE_LEFT + (idx >= 0 ? idx : 0) * LANE_COL + LANE_COL / 2
  }

  return (
    <svg width={totalW} height={totalH} style={{ display: 'block', background: '#06101e' }}>
      {/* Lifelines */}
      {participants.map((p) => {
        const x = pcx(p.id)
        const hi = selectedParticipantId === p.id
        return (
          <line
            key={`ll-${p.id}`}
            x1={x} y1={LANE_BOX_Y + LANE_BOX_H} x2={x} y2={totalH - 20}
            stroke={hi ? SEQ_LINE : SEQ_LINE_FAINT}
            strokeWidth={hi ? 1.5 : 1}
            strokeDasharray="7 5"
          />
        )
      })}

      {/* Participant boxes */}
      {participants.map((p) => {
        const x = pcx(p.id)
        const hi = selectedParticipantId === p.id
        return (
          <g key={`pb-${p.id}`} onClick={() => onSelectParticipant(p.id)} style={{ cursor: 'pointer' }}>
            <rect
              x={x - LANE_BOX_W / 2} y={LANE_BOX_Y}
              width={LANE_BOX_W} height={LANE_BOX_H} rx={7}
              fill={hi ? 'rgba(250, 204, 21, 0.08)' : '#111827'}
              stroke={hi ? SEQ_LINE : '#2d3f55'}
              strokeWidth={1.5}
            />
            <text
              x={x} y={LANE_BOX_Y + LANE_BOX_H / 2 + 5}
              textAnchor="middle"
              fill={hi ? SEQ_LINE_SOFT : '#e5e7eb'}
              fontSize={11} fontWeight="700"
              style={{ userSelect: 'none' as const }}
            >
              {truncSeq(p.label, 20)}
            </text>
          </g>
        )
      })}

      {/* Signals */}
      {signals.map((sig, i) => {
        const y = LANE_SIG_Y0 + i * LANE_SIG_DY
        const fromX = pcx(sig.fromId)
        const toX = pcx(sig.toId)
        const active = sig.id === selectedId
        const pFocused = selectedParticipantId
          ? sig.fromId === selectedParticipantId || sig.toId === selectedParticipantId
          : false
        const focused = active || pFocused
        const color = SEQ_LINE
        const labelColor = focused ? SEQ_LINE_SOFT : SEQ_LINE_DIM
        const isSelf = sig.fromId === sig.toId
        const cleanSig = sig.signal.replace(/^\d+\.\s*/, '')

        return (
          <g key={sig.id} onClick={() => onSelectSignal(sig.id)} style={{ cursor: 'pointer' }}>
            {/* Row highlight */}
            <rect
              x={0} y={y - LANE_SIG_DY / 2 + 2} width={totalW} height={LANE_SIG_DY - 4}
              fill={focused ? (active ? SEQ_BG_ACTIVE : SEQ_BG_PREFERRED) : 'transparent'}
              rx={3}
            />
            {/* Order badge */}
            <text
              x={Math.min(fromX, isSelf ? fromX : toX) - 22} y={y + 4}
              fill={focused ? color : SEQ_LINE_FAINT}
              fontSize={9} fontWeight="700"
              style={{ userSelect: 'none' as const }}
            >
              #{sig.order}
            </text>

            {isSelf ? (
              <>
                <path
                  d={`M ${fromX} ${y} L ${fromX + 54} ${y} L ${fromX + 54} ${y + 20} L ${fromX + 2} ${y + 20}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={focused ? 2 : 1.3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={focused ? '8 6' : undefined}
                  className={focused ? 'main-seq-signal-link is-animated' : 'main-seq-signal-link'}
                />
                <polygon
                  points={`${fromX + 2},${y + 20 - LANE_ARROW} ${fromX + 2 + LANE_ARROW},${y + 20} ${fromX + 2},${y + 20 + LANE_ARROW}`}
                  fill={color}
                  className={focused ? 'main-seq-signal-arrow is-animated' : 'main-seq-signal-arrow'}
                />
                <text x={fromX + 60} y={y + 12}
                  fill={labelColor} fontSize={10} fontWeight={focused ? '600' : '400'}
                  style={{ userSelect: 'none' as const }}
                >
                  {truncSeq(cleanSig, 30)}
                </text>
              </>
            ) : (() => {
              const dir = toX > fromX ? 1 : -1
              const mid = (fromX + toX) / 2
              const maxChars = Math.max(14, Math.floor(Math.abs(toX - fromX) / 7))
              return (
                <>
                  <line
                    x1={fromX} y1={y} x2={toX - dir * (LANE_ARROW + 1)} y2={y}
                    stroke={color}
                    strokeWidth={focused ? 2 : 1.3}
                    strokeLinecap="round"
                    strokeDasharray={focused ? '8 6' : undefined}
                    className={focused ? 'main-seq-signal-link is-animated' : 'main-seq-signal-link'}
                  />
                  <polygon
                    points={`${toX},${y} ${toX - dir * LANE_ARROW},${y - LANE_ARROW} ${toX - dir * LANE_ARROW},${y + LANE_ARROW}`}
                    fill={color}
                    className={focused ? 'main-seq-signal-arrow is-animated' : 'main-seq-signal-arrow'}
                  />
                  <text x={mid} y={y - 8}
                    textAnchor="middle"
                    fill={labelColor} fontSize={10.5} fontWeight={focused ? '600' : '400'}
                    style={{ userSelect: 'none' as const }}
                  >
                    {truncSeq(cleanSig, maxChars)}
                  </text>
                </>
              )
            })()}

            {/* Line number far right */}
            <text x={totalW - 6} y={y + 4}
              textAnchor="end"
              fill={focused ? color : SEQ_LINE_FAINT}
              fontSize={9}
              style={{ userSelect: 'none' as const }}
            >
              L{sig.lineNumber}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function MermaidMainCanvas({ block }: Props) {
  const [viewMode, setViewMode] = useState<'exact' | 'interactive'>('exact')

  const parsedFlow = useMemo(() => parseMermaidToFlow(block.code), [block.code])
  const graph = useMemo(
    () => viewMode === 'interactive' ? parsedFlow : { kind: 'other' as const, nodes: [], edges: [], notes: [] as string[] },
    [parsedFlow, viewMode]
  )

  const storedPositions = useMemo(() => loadStoredPositions(block.id), [block.id])

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes)

  useEffect(() => {
    setNodes((current) =>
      graph.nodes.map((node) => {
        const previous = current.find((item) => item.id === node.id)
        return {
          ...node,
          position: previous?.position ?? storedPositions[node.id] ?? node.position,
        }
      })
    )
  }, [graph.nodes, setNodes, storedPositions])

  useEffect(() => {
    if (viewMode !== 'interactive') return
    const nextPositions: StoredPositions = {}
    for (const node of nodes) {
      nextPositions[node.id] = { x: node.position.x, y: node.position.y }
    }
    writePersist(storageKeyForBlock(block.id), nextPositions)
  }, [block.id, nodes, viewMode])

  const linkedNodeIds = useMemo(() => {
    const ids = new Set<string>()

    if (selectedNodeId) {
      ids.add(selectedNodeId)
      for (const edge of graph.edges) {
        if (edge.source === selectedNodeId || edge.target === selectedNodeId) {
          ids.add(edge.source)
          ids.add(edge.target)
        }
      }
    }

    if (selectedEdgeId) {
      const edge = graph.edges.find((item) => item.id === selectedEdgeId)
      if (edge) {
        ids.add(edge.source)
        ids.add(edge.target)
      }
    }

    return ids
  }, [graph.edges, selectedEdgeId, selectedNodeId])

  const styledNodes: Node[] = useMemo(() => {
    const hasSelection = Boolean(selectedNodeId || selectedEdgeId)

    return nodes.map((node) => {
      const isFocused = node.id === selectedNodeId || linkedNodeIds.has(node.id)
      return {
        ...node,
        style: {
          ...(node.style ?? {}),
          border: isFocused ? '1px solid #38bdf8' : '1px solid #334155',
          boxShadow: isFocused
            ? '0 0 0 1px #38bdf8, 0 8px 20px rgba(56, 189, 248, 0.2)'
            : '0 2px 8px rgba(2, 6, 23, 0.45)',
          opacity: hasSelection && !isFocused ? 0.45 : 1,
        },
      }
    })
  }, [linkedNodeIds, nodes, selectedEdgeId, selectedNodeId])

  const edges: Edge[] = useMemo(() => {
    const hasSelection = Boolean(selectedNodeId || selectedEdgeId)

    return graph.edges.map((edge) => {
      const isFocused =
        edge.id === selectedEdgeId ||
        edge.source === selectedNodeId ||
        edge.target === selectedNodeId

      return {
        ...edge,
        animated: isFocused,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 18,
          height: 18,
          color: isFocused ? '#facc15' : '#64748b',
        },
        style: {
          stroke: isFocused ? '#facc15' : '#64748b',
          strokeWidth: isFocused ? 2.4 : 1.5,
          opacity: hasSelection && !isFocused ? 0.25 : 1,
        },
        labelStyle: {
          fill: isFocused ? '#fde68a' : '#94a3b8',
          fontSize: 11,
          fontWeight: 600,
        },
      }
    })
  }, [graph.edges, selectedEdgeId, selectedNodeId])

  const selectedEdgeData = useMemo(() => {
    if (!selectedEdgeId) {
      return null
    }

    const edge = graph.edges.find((item) => item.id === selectedEdgeId)
    if (!edge) {
      return null
    }

    return edge.data as MermaidFlowEdgeData | undefined
  }, [graph.edges, selectedEdgeId])

  const connectedLines = useMemo(() => {
    if (!selectedNodeId) {
      return []
    }

    return graph.edges
      .filter((edge) => edge.source === selectedNodeId || edge.target === selectedNodeId)
      .map((edge) => edge.data as MermaidFlowEdgeData | undefined)
      .filter((item): item is MermaidFlowEdgeData => Boolean(item))
  }, [graph.edges, selectedNodeId])

  const participantLabelById = useMemo(() => {
    const map = new Map<string, string>()
    for (const node of graph.nodes) {
      const label = (node.data as { label?: string } | undefined)?.label ?? node.id
      map.set(node.id, String(label))
    }
    return map
  }, [graph.nodes])

  const sequenceSignals = useMemo(() => {
    if (graph.kind !== 'sequence') {
      return []
    }

    return graph.edges.map((edge, index) => {
      const lineData = (edge.data as MermaidFlowEdgeData | undefined) ?? {
        lineNumber: index + 1,
        lineText: edge.label ? String(edge.label) : '',
      }
      return {
        id: edge.id,
        order: index + 1,
        fromId: edge.source,
        toId: edge.target,
        fromLabel: participantLabelById.get(edge.source) ?? edge.source,
        toLabel: participantLabelById.get(edge.target) ?? edge.target,
        signal: edge.label ? String(edge.label) : '(no label)',
        lineData,
      }
    })
  }, [graph.edges, graph.kind, participantLabelById])

  const sequenceParticipantSignals = useMemo(() => {
    if (!selectedNodeId || graph.kind !== 'sequence') {
      return []
    }

    return sequenceSignals.filter(
      (signal) => signal.fromId === selectedNodeId || signal.toId === selectedNodeId
    )
  }, [graph.kind, selectedNodeId, sequenceSignals])

  if (viewMode === 'exact') {
    return (
      <div className="main-mermaid-shell">
        <div className="main-mermaid-bar">
          <div>
            <div className="main-mermaid-title">{block.title}</div>
            <div className="main-mermaid-subtitle">
              <span className={`main-type-badge main-type-${block.type}`}>{block.type}</span>
              Exact Mermaid render — matches README Viewer.
            </div>
          </div>
          <ViewToggle current={viewMode} onChange={setViewMode} />
        </div>
        <div className="main-mermaid-exact-wrap">
          <MermaidRenderer code={block.code} />
        </div>
      </div>
    )
  }

  if (parsedFlow.kind === 'other') {
    return (
      <div className="main-mermaid-shell">
        <div className="main-mermaid-bar">
          <div>
            <div className="main-mermaid-title">{block.title}</div>
            <div className="main-mermaid-subtitle">Interactive mode not available for this diagram type.</div>
          </div>
          <ViewToggle current={viewMode} onChange={setViewMode} />
        </div>
        <div className="main-mermaid-note">{parsedFlow.notes[0] ?? 'Please switch to Exact mode.'}</div>
      </div>
    )
  }

  if (graph.kind === 'sequence') {
    const selectedSignal = sequenceSignals.find((s) => s.id === selectedEdgeId) ?? null
    const svgParticipants = graph.nodes.map((n) => ({
      id: n.id,
      label: String((n.data as { label?: string }).label ?? n.id),
    }))
    const svgSignals: SeqViewSignal[] = sequenceSignals.map((s) => ({
      id: s.id,
      order: s.order,
      fromId: s.fromId,
      toId: s.toId,
      signal: s.signal,
      lineNumber: s.lineData.lineNumber,
    }))

    return (
      <div className="main-mermaid-shell">
        <div className="main-mermaid-bar">
          <div>
            <div className="main-mermaid-title">{block.title}</div>
            <div className="main-mermaid-subtitle">
              <span className="main-type-badge main-type-sequence">sequence</span>
              Lifeline diagram — click participant or arrow to inspect source.
            </div>
          </div>
          <ViewToggle current={viewMode} onChange={setViewMode} />
        </div>

        <div className="main-seq-shell">
          <div className="main-seq-split">
            {/* Left: SVG lane diagram */}
            <div className="main-seq-lane-wrap">
              <SequenceLaneSVG
                participants={svgParticipants}
                signals={svgSignals}
                selectedId={selectedEdgeId}
                selectedParticipantId={selectedNodeId}
                onSelectSignal={(id) => { setSelectedEdgeId(id); setSelectedNodeId(null) }}
                onSelectParticipant={(id) => { setSelectedNodeId(id); setSelectedEdgeId(null) }}
              />
            </div>
            {/* Right: signal list */}
            <div className="main-seq-list" role="list" aria-label="Sequence signals">
              <div className="main-seq-list-head">Signals ({sequenceSignals.length})</div>
              {sequenceSignals.map((signal) => {
                const active =
                  signal.id === selectedEdgeId ||
                  Boolean(selectedNodeId && (signal.fromId === selectedNodeId || signal.toId === selectedNodeId))
                const cleanSig = signal.signal.replace(/^\d+\.\s*/, '')
                return (
                  <button
                    key={signal.id}
                    type="button"
                    role="listitem"
                    className={`main-seq-row${active ? ' is-active' : ''}`}
                    onClick={() => { setSelectedEdgeId(signal.id); setSelectedNodeId(null) }}
                  >
                    <div className="main-seq-row-head">
                      <span className="main-seq-order">#{signal.order}</span>
                      <span className="main-seq-route">{signal.fromLabel} → {signal.toLabel}</span>
                      <span className="main-seq-line">L{signal.lineData.lineNumber}</span>
                    </div>
                    <div className="main-seq-signal">{cleanSig}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="main-mermaid-inspector">
            {selectedSignal ? (
              <div>
                <strong>L{selectedSignal.lineData.lineNumber}:</strong>
                <pre>{selectedSignal.lineData.lineText}</pre>
              </div>
            ) : sequenceParticipantSignals.length > 0 ? (
              <div>
                <strong>{selectedNodeId} — {sequenceParticipantSignals.length} signals:</strong>
                <pre>{sequenceParticipantSignals.map((s) => `L${s.lineData.lineNumber}: ${s.lineData.lineText.trim()}`).join('\n')}</pre>
              </div>
            ) : (
              <div>
                <strong>Inspector:</strong>
                <pre>Click a participant lifeline or signal arrow to inspect source.</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="main-mermaid-shell">
      <div className="main-mermaid-bar">
        <div>
          <div className="main-mermaid-title">{block.title}</div>
          <div className="main-mermaid-subtitle">
            <span className={`main-type-badge main-type-${block.type}`}>{block.type}</span>
            Node graph — click node or edge to inspect source line.
          </div>
        </div>
        <ViewToggle current={viewMode} onChange={setViewMode} />
      </div>

      <div className="main-mermaid-canvas">
        <ReactFlow
          nodes={styledNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          nodesDraggable
          onlyRenderVisibleElements
          minZoom={0.4}
          maxZoom={2}
          onPaneClick={() => {
            setSelectedNodeId(null)
            setSelectedEdgeId(null)
          }}
          onNodeClick={(_, node) => {
            setSelectedNodeId(node.id)
            setSelectedEdgeId(null)
          }}
          onEdgeClick={(_, edge) => {
            setSelectedEdgeId(edge.id)
            setSelectedNodeId(null)
          }}
          style={{ background: '#0a0a0f' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1e293b" />
          <Controls position="bottom-left" />
        </ReactFlow>
      </div>

      <div className="main-mermaid-inspector">
        {selectedEdgeData ? (
          <div>
            <strong>Selected edge line {selectedEdgeData.lineNumber}:</strong>
            <pre>{selectedEdgeData.lineText}</pre>
          </div>
        ) : null}

        {!selectedEdgeData && selectedNodeId ? (
          <div>
            <strong>Lines linked to node {selectedNodeId}:</strong>
            {connectedLines.length === 0 ? (
              <pre>No relation line found for this node.</pre>
            ) : (
              <pre>{connectedLines.map((line) => `L${line.lineNumber}: ${line.lineText.trim()}`).join('\n')}</pre>
            )}
          </div>
        ) : null}

        {!selectedEdgeData && !selectedNodeId ? (
          <div>
            <strong>Inspector:</strong>
            <pre>Click a node or edge to show Mermaid source line mapping.</pre>
          </div>
        ) : null}
      </div>
    </div>
  )
}

import { useMemo, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react'
import type { MermaidBlock } from '../utils/markdownMermaid'
import MermaidRenderer from './MermaidRenderer'
import { parseMermaidToFlow, type MermaidFlowEdgeData } from '../utils/mermaidToFlow'

interface Props {
  block: MermaidBlock
}

export default function MermaidMainCanvas({ block }: Props) {
  const [viewMode, setViewMode] = useState<'exact' | 'interactive'>('exact')
  const graph = useMemo(
    () => (viewMode === 'interactive' ? parseMermaidToFlow(block.code) : { kind: 'other', nodes: [], edges: [], notes: [] }),
    [block.code, viewMode]
  )
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

  const interactiveSupport = useMemo(() => parseMermaidToFlow(block.code), [block.code])

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

  const nodes: Node[] = useMemo(() => {
    const hasSelection = Boolean(selectedNodeId || selectedEdgeId)

    return graph.nodes.map((node) => {
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
  }, [graph.nodes, linkedNodeIds, selectedEdgeId, selectedNodeId])

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

  const sequenceCanvas = useMemo(() => {
    if (graph.kind !== 'sequence') {
      return { nodes: [] as Node[], edges: [] as Edge[] }
    }

    const participantX = new Map<string, number>()
    const participantNodes: Node[] = graph.nodes.map((node, index) => {
      const x = 80 + index * 260
      participantX.set(node.id, x)
      const label = (node.data as { label?: string } | undefined)?.label ?? node.id
      const focused = selectedNodeId === node.id
      return {
        id: `p-${node.id}`,
        position: { x, y: 40 },
        data: { label },
        draggable: false,
        selectable: true,
        style: {
          border: focused ? '1px solid #facc15' : '1px solid #334155',
          borderRadius: 8,
          background: focused ? '#28220a' : '#111827',
          color: '#e5e7eb',
          padding: 8,
          width: 180,
          textAlign: 'center',
          fontSize: 11,
          fontWeight: 700,
        },
      }
    })

    const messageNodes: Node[] = sequenceSignals.map((signal, index) => {
      const fromX = participantX.get(signal.fromId) ?? 80
      const toX = participantX.get(signal.toId) ?? 80
      const x = Math.round((fromX + toX) / 2)
      const y = 150 + index * 72
      const active = signal.id === selectedEdgeId
      return {
        id: `m-${signal.id}`,
        position: { x, y },
        data: {
          label: `#${signal.order} ${signal.signal}`,
        },
        draggable: false,
        selectable: true,
        style: {
          border: active ? '1px solid #facc15' : '1px solid #334155',
          borderRadius: 8,
          background: active ? '#2a2408' : '#0b1220',
          color: active ? '#fde68a' : '#cbd5e1',
          padding: '6px 8px',
          width: 260,
          textAlign: 'left',
          fontSize: 11,
          lineHeight: 1.35,
          boxShadow: active ? '0 0 0 1px #facc15' : 'none',
        },
      }
    })

    const connectionEdges: Edge[] = sequenceSignals.flatMap((signal) => {
      const active = signal.id === selectedEdgeId
      const participantFocused = selectedNodeId
        ? signal.fromId === selectedNodeId || signal.toId === selectedNodeId
        : false
      const focused = active || participantFocused
      const color = focused ? '#facc15' : '#475569'
      return [
        {
          id: `p2m-${signal.id}`,
          source: `p-${signal.fromId}`,
          target: `m-${signal.id}`,
          style: { stroke: color, strokeWidth: focused ? 2 : 1.3, opacity: selectedEdgeId || selectedNodeId ? (focused ? 1 : 0.25) : 0.75 },
          animated: focused,
        },
        {
          id: `m2p-${signal.id}`,
          source: `m-${signal.id}`,
          target: `p-${signal.toId}`,
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color },
          style: { stroke: color, strokeWidth: focused ? 2 : 1.3, opacity: selectedEdgeId || selectedNodeId ? (focused ? 1 : 0.25) : 0.75 },
          animated: focused,
        },
      ]
    })

    return {
      nodes: [...participantNodes, ...messageNodes],
      edges: connectionEdges,
    }
  }, [graph.kind, graph.nodes, selectedEdgeId, selectedNodeId, sequenceSignals])

  if (viewMode === 'exact') {
    return (
      <div className="main-mermaid-shell">
        <div className="main-mermaid-bar">
          <div>
            <div className="main-mermaid-title">Main Canvas: {block.title}</div>
            <div className="main-mermaid-subtitle">Exact Mermaid layout (matches README Mermaid Viewer).</div>
          </div>
          <div className="main-mermaid-actions">
            <button type="button" className="mdp-btn mdp-open-main" onClick={() => setViewMode('exact')}>
              Exact layout
            </button>
            <button type="button" className="mdp-btn" onClick={() => setViewMode('interactive')}>
              Interactive lines
            </button>
          </div>
        </div>

        <div className="main-mermaid-exact-wrap">
          <MermaidRenderer code={block.code} />
        </div>
      </div>
    )
  }

  if (interactiveSupport.kind === 'other') {
    return (
      <div className="main-mermaid-shell">
        <div className="main-mermaid-bar">
          <div>
            <div className="main-mermaid-title">Main Interactive Canvas</div>
            <div className="main-mermaid-subtitle">Interactive mode is not available for this Mermaid syntax.</div>
          </div>
          <div className="main-mermaid-actions">
            <button type="button" className="mdp-btn mdp-open-main" onClick={() => setViewMode('exact')}>
              Exact layout
            </button>
            <button type="button" className="mdp-btn" onClick={() => setViewMode('interactive')}>
              Interactive lines
            </button>
          </div>
        </div>
        <div className="main-mermaid-note">{interactiveSupport.notes[0] ?? 'Please switch to Exact layout mode.'}</div>
      </div>
    )
  }

  if (graph.kind === 'sequence') {
    const selectedSignal = sequenceSignals.find((item) => item.id === selectedEdgeId) ?? null

    return (
      <div className="main-mermaid-shell">
        <div className="main-mermaid-bar">
          <div>
            <div className="main-mermaid-title">Main Interactive Canvas: {block.title}</div>
            <div className="main-mermaid-subtitle">Signal timeline view for sequence diagrams (optimized readability).</div>
          </div>
          <div className="main-mermaid-actions">
            <button type="button" className="mdp-btn" onClick={() => setViewMode('exact')}>
              Exact layout
            </button>
            <button type="button" className="mdp-btn mdp-open-main" onClick={() => setViewMode('interactive')}>
              Interactive lines
            </button>
          </div>
        </div>

        <div className="main-seq-wrap">
          <div className="main-seq-diagram">
            <ReactFlow
              nodes={sequenceCanvas.nodes}
              edges={sequenceCanvas.edges}
              fitView
              fitViewOptions={{ padding: 0.16 }}
              nodesDraggable={false}
              nodesConnectable={false}
              onPaneClick={() => {
                setSelectedEdgeId(null)
                setSelectedNodeId(null)
              }}
              onNodeClick={(_, node) => {
                if (node.id.startsWith('m-')) {
                  setSelectedEdgeId(node.id.slice(2))
                  setSelectedNodeId(null)
                  return
                }

                if (node.id.startsWith('p-')) {
                  setSelectedNodeId(node.id.slice(2))
                  setSelectedEdgeId(null)
                }
              }}
              style={{ background: '#070f1d' }}
            >
              <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#1e293b" />
              <Controls position="bottom-left" />
            </ReactFlow>
          </div>

          <div className="main-seq-participants">
            {graph.nodes.map((node) => {
              const label = (node.data as { label?: string } | undefined)?.label ?? node.id
              const active = selectedNodeId === node.id
              return (
                <div key={node.id} className={`main-seq-participant-chip ${active ? 'is-active' : ''}`}>
                  {String(label)}
                </div>
              )
            })}
          </div>

          <div className="main-seq-list" role="list" aria-label="Sequence signals list">
            {sequenceSignals.map((signal) => {
              const active =
                signal.id === selectedEdgeId ||
                Boolean(selectedNodeId && (signal.fromId === selectedNodeId || signal.toId === selectedNodeId))
              return (
                <button
                  key={signal.id}
                  type="button"
                  role="listitem"
                  className={`main-seq-row ${active ? 'is-active' : ''}`}
                  onClick={() => {
                    setSelectedEdgeId(signal.id)
                    setSelectedNodeId(null)
                  }}
                >
                  <span className="main-seq-order">#{signal.order}</span>
                  <span className="main-seq-route">{signal.fromLabel} -&gt; {signal.toLabel}</span>
                  <span className="main-seq-signal">{signal.signal}</span>
                  <span className="main-seq-line">L{signal.lineData.lineNumber}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="main-mermaid-inspector">
          {selectedSignal ? (
            <div>
              <strong>Selected signal line {selectedSignal.lineData.lineNumber}:</strong>
              <pre>{selectedSignal.lineData.lineText}</pre>
            </div>
          ) : sequenceParticipantSignals.length > 0 ? (
            <div>
              <strong>Participant {selectedNodeId} linked lines:</strong>
              <pre>
                {sequenceParticipantSignals
                  .map((signal) => `L${signal.lineData.lineNumber}: ${signal.lineData.lineText.trim()}`)
                  .join('\n')}
              </pre>
            </div>
          ) : (
            <div>
              <strong>Inspector:</strong>
              <pre>Click signal row, message node, or participant node to inspect source line relationships.</pre>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="main-mermaid-shell">
      <div className="main-mermaid-bar">
        <div>
          <div className="main-mermaid-title">Main Interactive Canvas: {block.title}</div>
          <div className="main-mermaid-subtitle">Click node or edge to inspect mapped line(s) from Mermaid source.</div>
        </div>
        <div className="main-mermaid-actions">
          <button type="button" className="mdp-btn" onClick={() => setViewMode('exact')}>
            Exact layout
          </button>
          <button type="button" className="mdp-btn mdp-open-main" onClick={() => setViewMode('interactive')}>
            Interactive lines
          </button>
        </div>
      </div>

      <div className="main-mermaid-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.2 }}
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

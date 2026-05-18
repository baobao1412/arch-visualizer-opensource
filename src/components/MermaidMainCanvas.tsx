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
import { parseMermaidToFlow, type MermaidFlowEdgeData } from '../utils/mermaidToFlow'

interface Props {
  block: MermaidBlock
  onBack: () => void
}

export default function MermaidMainCanvas({ block, onBack }: Props) {
  const graph = useMemo(() => parseMermaidToFlow(block.code), [block.code])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

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

  if (graph.kind === 'other') {
    return (
      <div className="main-mermaid-shell">
        <div className="main-mermaid-bar">
          <div>
            <div className="main-mermaid-title">Main Interactive Canvas</div>
            <div className="main-mermaid-subtitle">Only sequence/class are supported for line interaction.</div>
          </div>
          <button type="button" className="mdp-btn" onClick={onBack}>
            Back to architecture
          </button>
        </div>
        <div className="main-mermaid-note">{graph.notes[0]}</div>
      </div>
    )
  }

  return (
    <div className="main-mermaid-shell">
      <div className="main-mermaid-bar">
        <div>
          <div className="main-mermaid-title">Main Interactive Canvas: {block.title}</div>
          <div className="main-mermaid-subtitle">Click node or edge to inspect linked line(s) from the Mermaid source.</div>
        </div>
        <button type="button" className="mdp-btn" onClick={onBack}>
          Back to architecture
        </button>
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

import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  useNodesState,
  type Node,
  type Edge,
} from '@xyflow/react';
import ArchNode from './ArchNode';
import FlowDetail from './FlowDetail';
import { BASE_NODES, BASE_EDGES, COLUMNS, FLOWS, type FlowDef } from '../data/flows';

const nodeTypes = { archNode: ArchNode };
const ARCH_NODE_POSITIONS_KEY = 'archviz.arch.nodes.v1';

type StoredPositions = Record<string, { x: number; y: number }>;

function loadStoredPositions(): StoredPositions {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ARCH_NODE_POSITIONS_KEY);
    return raw ? (JSON.parse(raw) as StoredPositions) : {};
  } catch {
    return {};
  }
}

interface Props {
  activeFlowId: string | null;
}

export default function ArchDiagram({ activeFlowId }: Props) {
  const activeFlow: FlowDef | null = activeFlowId
    ? (FLOWS.find((f) => f.id === activeFlowId) ?? null)
    : null;

  const storedPositions = useMemo(() => loadStoredPositions(), []);

  const baseNodes: Node[] = useMemo(() => {
    return BASE_NODES.map((node) => {
      const highlighted = activeFlow ? activeFlow.steps.includes(node.id) : false;
      const dimmed = activeFlow ? !highlighted : false;
      return {
        ...node,
        data: {
          ...node.data,
          highlighted,
          dimmed,
          activeColor: activeFlow?.color,
        },
        position: storedPositions[node.id] ?? node.position,
      };
    });
  }, [activeFlow, storedPositions]);

  const [nodes, setNodes, onNodesChange] = useNodesState(baseNodes);

  useEffect(() => {
    setNodes((current) =>
      baseNodes.map((node) => {
        const previous = current.find((item) => item.id === node.id);
        return {
          ...node,
          position: previous?.position ?? node.position,
        };
      })
    );
  }, [baseNodes, setNodes]);

  useEffect(() => {
    const nextPositions: StoredPositions = {};
    for (const node of nodes) {
      nextPositions[node.id] = { x: node.position.x, y: node.position.y };
    }
    localStorage.setItem(ARCH_NODE_POSITIONS_KEY, JSON.stringify(nextPositions));
  }, [nodes]);

  const edges: Edge[] = useMemo(() => {
    return BASE_EDGES.map((edge) => {
      const highlighted = activeFlow ? activeFlow.edgeIds.includes(edge.id) : false;
      const dimmed = activeFlow ? !highlighted : false;
      return {
        ...edge,
        className: highlighted ? 'highlighted' : dimmed ? 'dimmed' : '',
        animated: highlighted,
      };
    });
  }, [activeFlow]);

  const onEdgesChange = useCallback(() => {}, []);

  return (
    <div className="arch-canvas">
      <div className="arch-columns-overlay">
        {COLUMNS.map((col) => (
          <div
            key={col.id}
            className="arch-column-label"
            style={{ left: col.x + 20 }}
          >
            {col.label}
          </div>
        ))}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        zoomOnScroll
        onlyRenderVisibleElements
        minZoom={0.4}
        maxZoom={1.8}
        style={{ background: '#0a0a0f' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1e293b" />
        <Controls position="bottom-left" />
      </ReactFlow>

      <FlowDetail flow={activeFlow} />
    </div>
  );
}

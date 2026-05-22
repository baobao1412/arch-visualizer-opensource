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

interface Props {
  activeFlowId: string | null;
}

export default function ArchDiagram({ activeFlowId }: Props) {
  const activeFlow: FlowDef | null = activeFlowId
    ? (FLOWS.find((f) => f.id === activeFlowId) ?? null)
    : null;

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
      };
    });
  }, [activeFlow]);

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
    <div style={{ flex: 1, position: 'relative' }}>
      {/* Column headers */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 5,
          pointerEvents: 'none',
          display: 'flex',
          paddingLeft: 0,
        }}
      >
        {COLUMNS.map((col) => (
          <div
            key={col.id}
            style={{
              position: 'absolute',
              left: col.x + 20,
              top: 12,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: '#334155',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
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
        fitView
        fitViewOptions={{ padding: 0.15 }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        zoomOnScroll
        style={{ background: '#0a0a0f' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1e293b" />
        <Controls position="bottom-left" />
      </ReactFlow>

      <FlowDetail flow={activeFlow} />
    </div>
  );
}

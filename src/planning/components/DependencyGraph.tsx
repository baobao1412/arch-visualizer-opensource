import { useMemo, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  useEdgesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { PlanBoard, TaskCard } from '../types'

/* ── Colour maps ─────────────────────────────────────────────── */
const PRIORITY_COLOR: Record<string, string> = {
  high:   '#ef4444',
  medium: '#f59e0b',
  low:    '#3b82f6',
}

const COLUMN_COLOR: Record<string, string> = {
  todo:       '#475569',
  inprogress: '#3b82f6',
  review:     '#a78bfa',
  done:       '#22c55e',
}

function getColumnColor(col: string): string {
  const key = col.toLowerCase().replace(/[\s_-]/g, '')
  return COLUMN_COLOR[key] ?? '#475569'
}

/* ── Custom glass node ───────────────────────────────────────── */
type TaskNodeData = {
  task: TaskCard
  columnColor: string
  onEdit: (task: TaskCard) => void
}

function TaskNode({ data }: { data: TaskNodeData }) {
  const { task, columnColor, onEdit } = data
  const priorityColor = PRIORITY_COLOR[task.priority] ?? '#475569'

  return (
    <div
      onClick={() => onEdit(task)}
      style={{
        width: 200,
        background: 'linear-gradient(135deg,rgba(255,255,255,0.05) 0%,rgba(8,10,22,0.75) 100%)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: `1px solid ${columnColor}44`,
        borderLeft: `3px solid ${priorityColor}`,
        borderRadius: 10,
        padding: '9px 10px 8px',
        cursor: 'pointer',
        boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* shimmer top edge */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: `linear-gradient(90deg, transparent, ${columnColor}66, transparent)`,
      }} />

      {/* header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{
          fontFamily: 'monospace', fontSize: 9, fontWeight: 600,
          color: 'rgba(71,85,105,0.8)',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 3, padding: '1px 5px',
        }}>
          {task.id}
        </span>
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
          textTransform: 'uppercase', letterSpacing: '0.4px',
          color: priorityColor,
          background: `${priorityColor}22`,
        }}>
          {task.priority}
        </span>
      </div>

      {/* title */}
      <div style={{
        fontSize: 12, fontWeight: 600, color: '#e2e8f0',
        lineHeight: 1.4, marginBottom: 6,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {task.title}
      </div>

      {/* column badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 9, color: columnColor,
        background: `${columnColor}18`,
        border: `1px solid ${columnColor}33`,
        borderRadius: 999, padding: '1px 7px',
      }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: columnColor, boxShadow: `0 0 5px ${columnColor}` }} />
        {task.column}
      </div>

      {/* assignee */}
      {task.assignee && (
        <div style={{
          position: 'absolute', top: 8, right: 10,
          width: 18, height: 18, borderRadius: '50%',
          background: 'linear-gradient(135deg,#1d4ed8,#7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 7, fontWeight: 700, color: '#fff',
        }}>
          {task.assignee.slice(0, 2).toUpperCase()}
        </div>
      )}

      <Handle type="target" position={Position.Left}  style={{ background: columnColor, border: 'none', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: columnColor, border: 'none', width: 8, height: 8 }} />
    </div>
  )
}

const nodeTypes: NodeTypes = { taskNode: TaskNode as never }

/* ── Graph layout helpers ────────────────────────────────────── */
const NODE_W = 220
const NODE_H = 110
const H_GAP  = 60
const V_GAP  = 24

function buildGraph(board: PlanBoard, onEdit: (t: TaskCard) => void): { nodes: Node[]; edges: Edge[] } {
  // group tasks by column order
  const colOrder = board.columns
  const grouped: Record<string, TaskCard[]> = {}
  for (const col of colOrder) grouped[col] = []
  for (const task of board.tasks) {
    if (grouped[task.column]) {
      grouped[task.column].push(task)
    } else {
      grouped[task.column] = [task]
    }
  }

  const nodes: Node[] = []
  const colKeys = Object.keys(grouped)

  colKeys.forEach((col, colIdx) => {
    const tasks = grouped[col]
    const colColor = getColumnColor(col)
    tasks.forEach((task, rowIdx) => {
      nodes.push({
        id: task.id,
        type: 'taskNode',
        position: { x: colIdx * (NODE_W + H_GAP), y: rowIdx * (NODE_H + V_GAP) },
        data: { task, columnColor: colColor, onEdit } as unknown as Record<string, unknown>,
      })
    })
  })

  const edges: Edge[] = []
  for (const task of board.tasks) {
    for (const depId of task.depends ?? []) {
      edges.push({
        id: `e-${depId}-${task.id}`,
        source: depId,
        target: task.id,
        animated: true,
        style: { stroke: 'rgba(99,102,241,0.5)', strokeWidth: 1.5 },
        markerEnd: { type: 'arrowclosed' as never, color: 'rgba(99,102,241,0.7)' },
      })
    }
  }

  return { nodes, edges }
}

/* ── Inner graph (needs ReactFlow context) ───────────────────── */
function GraphInner({ board, onEditTask }: { board: PlanBoard; onEditTask: (t: TaskCard) => void }) {
  const { fitView } = useReactFlow()
  const { nodes: initNodes, edges: initEdges } = useMemo(
    () => buildGraph(board, onEditTask),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [board.tasks, board.columns],
  )

  const [nodes, , onNodesChange] = useNodesState(initNodes)
  const [edges, , onEdgesChange] = useEdgesState(initEdges)

  const onInit = useCallback(() => { fitView({ padding: 0.15 }) }, [fitView])

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={onInit}
        fitView
        minZoom={0.2}
        maxZoom={2}
        defaultEdgeOptions={{ animated: true }}
        style={{ background: '#060810' }}
      >
        <Background color="rgba(255,255,255,0.03)" gap={24} />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            const d = n.data as TaskNodeData
            return getColumnColor(d?.task?.column ?? '')
          }}
          style={{
            background: 'rgba(8,10,22,0.8)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8,
          }}
        />
      </ReactFlow>

      {/* legend */}
      <div style={{
        position: 'absolute', top: 12, left: 12,
        display: 'flex', gap: 8, flexWrap: 'wrap',
        background: 'rgba(8,10,22,0.8)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 8, padding: '6px 10px',
        pointerEvents: 'none',
      }}>
        {board.columns.map((col: string) => (
          <div key={col} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'rgba(148,163,184,0.8)' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: getColumnColor(col), boxShadow: `0 0 5px ${getColumnColor(col)}` }} />
            {col}
          </div>
        ))}
        <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', margin: '0 2px' }} />
        {Object.entries(PRIORITY_COLOR).map(([p, c]) => (
          <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: c }}>
            <div style={{ width: 10, height: 2, background: c, borderRadius: 1 }} />
            {p}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Public component ────────────────────────────────────────── */
export default function DependencyGraph({
  board,
  onEditTask,
}: {
  board: PlanBoard
  onEditTask: (task: TaskCard) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', background: '#060810' }}>
      {/* header */}
      <div style={{
        padding: '6px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(8,10,22,0.8)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        fontSize: 11, color: 'rgba(148,163,184,0.6)',
        display: 'flex', alignItems: 'center', gap: 8,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13 }}>📊</span>
        <span>Dependency Graph</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>{board.tasks.length} tasks</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>
          {board.tasks.reduce((n: number, t: TaskCard) => n + (t.depends?.length ?? 0), 0)} dependencies
        </span>
      </div>

      <ReactFlowProvider>
        <GraphInner board={board} onEditTask={onEditTask} />
      </ReactFlowProvider>
    </div>
  )
}

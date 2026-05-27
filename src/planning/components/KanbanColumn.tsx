import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { TaskCardView } from './TaskCard'
import type { TaskCard } from '../types'

interface KanbanColumnProps {
  column: string
  tasks: TaskCard[]
  isOver: boolean
  onEditTask: (task: TaskCard) => void
  onCreateTask: () => void
  onToggleSubtask: (taskId: string, subtaskIndex: number) => void
}

function getStatusDotClass(column: string): string {
  const lower = column.toLowerCase().replace(/\s+/g, '')
  if (lower === 'done') return 'column-dot-done'
  if (lower === 'inprogress') return 'column-dot-inprogress'
  if (lower === 'review') return 'column-dot-review'
  if (lower === 'todo') return 'column-dot-todo'
  return ''
}

function getColumnClass(column: string): string {
  const lower = column.toLowerCase().replace(/\s+/g, '')
  if (lower === 'done') return 'column-done'
  if (lower === 'inprogress') return 'column-inprogress'
  if (lower === 'review') return 'column-review'
  if (lower === 'todo') return 'column-todo'
  return ''
}

export function KanbanColumn({ column, tasks, isOver, onEditTask, onCreateTask, onToggleSubtask }: KanbanColumnProps) {
  const [collapsed, setCollapsed] = useState(false)

  const { setNodeRef } = useDroppable({ id: column })

  return (
    <div className={`kanban-column ${isOver ? 'column-over' : ''} ${getColumnClass(column)}`}>
      <div className="column-header">
        <div
          className="column-header-left"
          onClick={() => setCollapsed(!collapsed)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setCollapsed(!collapsed) }}
        >
          <span className={`collapse-arrow ${collapsed ? 'collapsed' : ''}`}>&#9662;</span>
          <span className={`column-status-dot ${getStatusDotClass(column)}`} />
          <span className="column-name">{column}</span>
          <span className="column-count">{tasks.length}</span>
        </div>
        <button
          type="button"
          className="column-add-btn"
          onClick={(e) => { e.stopPropagation(); onCreateTask() }}
          title={`Add task to ${column}`}
        >
          +
        </button>
      </div>

      {!collapsed && (
        <div ref={setNodeRef} className="column-body">
          <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {tasks.map((task) => (
              <TaskCardView
                key={task.id}
                task={task}
                onEdit={() => onEditTask(task)}
                onToggleSubtask={(index) => onToggleSubtask(task.id, index)}
              />
            ))}
          </SortableContext>
          {tasks.length === 0 && <div className="column-empty">Drop tasks here</div>}
        </div>
      )}
    </div>
  )
}

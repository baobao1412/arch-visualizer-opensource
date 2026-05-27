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

export function KanbanColumn({ column, tasks, isOver, onEditTask, onCreateTask, onToggleSubtask }: KanbanColumnProps) {
  const [collapsed, setCollapsed] = useState(false)

  const { setNodeRef } = useDroppable({ id: column })

  const colLower = column.toLowerCase()
  const columnClass =
    colLower === 'done'
      ? 'column-done'
      : colLower === 'in progress'
        ? 'column-inprogress'
        : colLower === 'review'
          ? 'column-review'
          : colLower === 'todo'
            ? 'column-todo'
            : ''

  return (
    <div className={`kanban-column ${isOver ? 'column-over' : ''} ${columnClass}`}>
      <div
        className="column-header"
        onClick={() => setCollapsed(!collapsed)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setCollapsed(!collapsed) }}
      >
        <div className="column-header-left">
          <span className={`collapse-arrow ${collapsed ? 'collapsed' : ''}`}>▼</span>
          <span className="column-name">{column}</span>
          <span className="column-count">{tasks.length}</span>
        </div>
        <button
          type="button"
          className="column-add-btn"
          onClick={(event) => {
            event.stopPropagation()
            onCreateTask()
          }}
          title="Add task"
        >
          +
        </button>
      </div>

      {!collapsed ? (
        <div ref={setNodeRef} className="column-body">
          <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
            {tasks.map((task) => (
              <TaskCardView
                key={task.id}
                task={task}
                onEdit={() => onEditTask(task)}
                onToggleSubtask={(index) => onToggleSubtask(task.id, index)}
              />
            ))}
          </SortableContext>

          {tasks.length === 0 ? <div className="column-empty">No tasks</div> : null}
        </div>
      ) : null}
    </div>
  )
}

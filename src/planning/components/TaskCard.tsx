import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { TaskCard } from '../types'

interface TaskCardProps {
  task: TaskCard
  isDragging?: boolean
  onEdit: () => void
  onToggleSubtask?: (index: number) => void
}

const PRIORITY_COLORS: Record<string, string> = {
  high: '#f44747',
  medium: '#cca700',
  low: '#3794ff',
}

export function TaskCardView({ task, isDragging, onEdit, onToggleSubtask }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({
    id: task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
  }

  const isOverdue = task.deadline ? new Date(task.deadline) < new Date() : false
  const subtasksDone = task.subtasks.filter((s) => s.done).length
  const subtasksTotal = task.subtasks.length

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-card ${isDragging ? 'task-dragging' : ''}`}
      onClick={onEdit}
      {...attributes}
      {...listeners}
    >
      <div className="task-priority-bar" style={{ backgroundColor: PRIORITY_COLORS[task.priority] }} />
      <div className="task-content">
        <div className="task-title">{task.title}</div>

        {task.assignee ? <div className="task-assignee">{task.assignee}</div> : null}

        {subtasksTotal > 0 ? (
          <div className="task-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${(subtasksDone / subtasksTotal) * 100}%` }} />
            </div>
            <span className="progress-text">
              {subtasksDone}/{subtasksTotal}
            </span>
          </div>
        ) : null}

        {subtasksTotal > 0 ? (
          <div className="task-subtasks">
            {task.subtasks.map((sub, i) => (
              <label
                key={i}
                className={`subtask-item ${sub.done ? 'subtask-done' : ''}`}
                onClick={(event) => {
                  event.stopPropagation()
                  onToggleSubtask?.(i)
                }}
              >
                <input type="checkbox" checked={sub.done} readOnly className="subtask-checkbox" />
                <span>{sub.text}</span>
              </label>
            ))}
          </div>
        ) : null}

        <div className="task-meta">
          {task.output ? (
            <span className="task-tag brief-tag" title={task.output}>
              brief
            </span>
          ) : null}
          {task.milestone ? <span className="task-tag milestone-tag">{task.milestone}</span> : null}
          {task.deadline ? <span className={`task-tag deadline-tag ${isOverdue ? 'overdue' : ''}`}>{task.deadline}</span> : null}
          {task.depends && task.depends.length > 0 ? (
            <span className="task-tag depends-tag">blocks: {task.depends.join(', ')}</span>
          ) : null}
          <span className={`task-tag priority-tag priority-${task.priority}`}>{task.priority}</span>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import type { BriefContent, Subtask, TaskCard } from '../types'

interface TaskFormProps {
  task: TaskCard | null
  defaultColumn: string
  columns: string[]
  brief: BriefContent | null
  briefLoading: boolean
  onSave: (task: Omit<TaskCard, 'id'> & { id?: string }, brief: BriefContent | null) => void
  onDelete?: () => void
  onClose: () => void
}

export function TaskForm({
  task,
  defaultColumn,
  columns,
  brief,
  briefLoading,
  onSave,
  onDelete,
  onClose,
}: TaskFormProps) {
  const [activeTab, setActiveTab] = useState<'task' | 'brief'>('task')
  const [title, setTitle] = useState(task?.title || '')
  const [description, setDescription] = useState(task?.description || '')
  const [milestone, setMilestone] = useState(task?.milestone || '')
  const [deadline, setDeadline] = useState(task?.deadline || '')
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>(task?.priority || 'medium')
  const [column, setColumn] = useState(task?.column || defaultColumn)
  const [assignee, setAssignee] = useState(task?.assignee || '')
  const [depends, setDepends] = useState(task?.depends?.join(', ') || '')
  const [subtasks, setSubtasks] = useState<Subtask[]>(task?.subtasks || [])
  const [newSubtask, setNewSubtask] = useState('')

  const [briefContext, setBriefContext] = useState(brief?.context || '')
  const [briefExpectedOutput, setBriefExpectedOutput] = useState(brief?.expectedOutput || '')
  const [briefAcceptanceCriteria, setBriefAcceptanceCriteria] = useState(brief?.acceptanceCriteria || '')
  const [briefTechnicalNotes, setBriefTechnicalNotes] = useState(brief?.technicalNotes || '')
  const [briefRulesFormat, setBriefRulesFormat] = useState(brief?.rulesFormat || '')

  useEffect(() => {
    if (!brief) return
    setBriefContext(brief.context)
    setBriefExpectedOutput(brief.expectedOutput)
    setBriefAcceptanceCriteria(brief.acceptanceCriteria)
    setBriefTechnicalNotes(brief.technicalNotes)
    setBriefRulesFormat(brief.rulesFormat)
  }, [brief])

  const hasBriefContent =
    briefContext.trim() ||
    briefExpectedOutput.trim() ||
    briefAcceptanceCriteria.trim() ||
    briefTechnicalNotes.trim() ||
    briefRulesFormat.trim()

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return

    const dependsList = depends.trim() ? depends.split(',').map((d) => d.trim()).filter(Boolean) : undefined

    const briefData: BriefContent | null = hasBriefContent
      ? {
          context: briefContext.trim(),
          expectedOutput: briefExpectedOutput.trim(),
          acceptanceCriteria: briefAcceptanceCriteria.trim(),
          technicalNotes: briefTechnicalNotes.trim(),
          rulesFormat: briefRulesFormat.trim(),
        }
      : null

    onSave(
      {
        ...(task ? { id: task.id } : {}),
        title: title.trim(),
        description: description.trim(),
        milestone: milestone.trim() || undefined,
        deadline: deadline.trim() || undefined,
        priority,
        column,
        assignee: assignee.trim() || undefined,
        depends: dependsList,
        subtasks,
      },
      briefData,
    )
  }

  const addSubtask = () => {
    if (!newSubtask.trim()) return
    setSubtasks([...subtasks, { text: newSubtask.trim(), done: false }])
    setNewSubtask('')
  }

  return (
    <div className="task-form-overlay" onClick={onClose}>
      <form className="task-form" onClick={(event) => event.stopPropagation()} onSubmit={handleSubmit}>
        <div className="form-header">
          <span>{task ? 'Edit Task' : 'New Task'}</span>
          <button type="button" className="form-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="form-tabs">
          <button
            type="button"
            className={`form-tab ${activeTab === 'task' ? 'form-tab-active' : ''}`}
            onClick={() => setActiveTab('task')}
          >
            Task
          </button>
          <button
            type="button"
            className={`form-tab ${activeTab === 'brief' ? 'form-tab-active' : ''}`}
            onClick={() => setActiveTab('brief')}
          >
            Brief {hasBriefContent ? <span className="form-tab-dot" /> : null}
          </button>
        </div>

        {activeTab === 'task' ? (
          <>
            <div className="form-field">
              <label>Title</label>
              <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Task title..." autoFocus />
            </div>

            <div className="form-field">
              <label>Description</label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Task description..."
                rows={3}
              />
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>Column</label>
                <select value={column} onChange={(event) => setColumn(event.target.value)}>
                  {columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Priority</label>
                <select value={priority} onChange={(event) => setPriority(event.target.value as 'high' | 'medium' | 'low')}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>Assignee</label>
                <input type="text" value={assignee} onChange={(event) => setAssignee(event.target.value)} placeholder="@name" />
              </div>
              <div className="form-field">
                <label>Milestone</label>
                <input
                  type="text"
                  value={milestone}
                  onChange={(event) => setMilestone(event.target.value)}
                  placeholder="e.g. MVP"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>Deadline</label>
                <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
              </div>
              <div className="form-field">
                <label>Depends on</label>
                <input
                  type="text"
                  value={depends}
                  onChange={(event) => setDepends(event.target.value)}
                  placeholder="task-1, task-2"
                />
              </div>
            </div>

            <div className="form-field">
              <label>
                Subtasks ({subtasks.filter((subtask) => subtask.done).length}/{subtasks.length})
              </label>
              <div className="subtask-list-edit">
                {subtasks.map((subtask, index) => (
                  <div key={index} className="subtask-edit-item">
                    <input
                      type="checkbox"
                      checked={subtask.done}
                      onChange={() => {
                        setSubtasks((prev) =>
                          prev.map((item, idx) => (idx === index ? { ...item, done: !item.done } : item)),
                        )
                      }}
                      className="subtask-checkbox"
                    />
                    <span className={subtask.done ? 'subtask-text-done' : ''}>{subtask.text}</span>
                    <button
                      type="button"
                      className="subtask-remove"
                      onClick={() => setSubtasks((prev) => prev.filter((_, idx) => idx !== index))}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div className="subtask-add">
                  <input
                    type="text"
                    value={newSubtask}
                    onChange={(event) => setNewSubtask(event.target.value)}
                    placeholder="Add subtask..."
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addSubtask()
                      }
                    }}
                  />
                  <button type="button" className="btn-secondary" onClick={addSubtask} style={{ padding: '4px 8px' }}>
                    +
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : briefLoading ? (
          <div className="brief-loading">Loading brief...</div>
        ) : (
          <>
            <div className="brief-hint">Define what AI agents and team members need to deliver for this task.</div>

            <div className="form-field">
              <label>Context</label>
              <textarea
                value={briefContext}
                onChange={(event) => setBriefContext(event.target.value)}
                placeholder="Why does this task exist?"
                rows={3}
              />
            </div>

            <div className="form-field">
              <label>Expected Output</label>
              <textarea
                value={briefExpectedOutput}
                onChange={(event) => setBriefExpectedOutput(event.target.value)}
                placeholder="What should the result look like?"
                rows={4}
              />
            </div>

            <div className="form-field">
              <label>Acceptance Criteria</label>
              <textarea
                value={briefAcceptanceCriteria}
                onChange={(event) => setBriefAcceptanceCriteria(event.target.value)}
                placeholder="When is this task done?"
                rows={3}
              />
            </div>

            <div className="form-field">
              <label>Technical Notes</label>
              <textarea
                value={briefTechnicalNotes}
                onChange={(event) => setBriefTechnicalNotes(event.target.value)}
                placeholder="Constraints, dependencies, gotchas..."
                rows={3}
              />
            </div>

            <div className="form-field">
              <label>Rules and Format</label>
              <textarea
                value={briefRulesFormat}
                onChange={(event) => setBriefRulesFormat(event.target.value)}
                placeholder="Coding standards, naming conventions..."
                rows={3}
              />
            </div>
          </>
        )}

        <div className="form-actions">
          {onDelete ? (
            <button type="button" className="btn-danger" onClick={onDelete}>
              Delete
            </button>
          ) : null}
          <div className="form-actions-right">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!title.trim()}>
              {task ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

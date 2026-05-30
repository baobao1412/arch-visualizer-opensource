import { useState } from 'react'
import type { BriefContent, Subtask, TaskCard, TaskComment } from '../types'

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

const TA_STYLE: React.CSSProperties = {
  background: '#181b24',
  border: '1px solid #242836',
  color: '#e2e8f0',
  borderRadius: 7,
  padding: '7px 10px',
  fontSize: 12,
  resize: 'vertical',
  outline: 'none',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
}

function BriefTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  rows?: number
}) {
  const [focused, setFocused] = useState(false)
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        ...TA_STYLE,
        borderColor: focused ? '#3b82f6' : '#242836',
        background:  focused ? '#1e2130' : '#181b24',
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  )
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
  const [activeTab, setActiveTab] = useState<'task' | 'brief' | 'subtasks' | 'review'>('task')

  const [title,       setTitle]       = useState(task?.title       || '')
  const [description, setDescription] = useState(task?.description || '')
  const [milestone,   setMilestone]   = useState(task?.milestone   || '')
  const [deadline,    setDeadline]    = useState(task?.deadline     || '')
  const [priority,    setPriority]    = useState<'high' | 'medium' | 'low'>(task?.priority || 'medium')
  const [column,      setColumn]      = useState(task?.column       || defaultColumn)
  const [assignee,    setAssignee]    = useState(task?.assignee     || '')
  const [depends,     setDepends]     = useState(task?.depends?.join(', ') || '')
  const [subtasks,    setSubtasks]    = useState<Subtask[]>(task?.subtasks || [])
  const [newSubtask,  setNewSubtask]  = useState('')

  const [comments,         setComments]         = useState<TaskComment[]>(task?.comments || [])
  const [newCommentText,   setNewCommentText]   = useState('')
  const [newCommentType,   setNewCommentType]   = useState<TaskComment['type']>('review')
  const [newCommentAuthor, setNewCommentAuthor] = useState(task?.assignee?.replace('@', '') || '')

  const [briefContext,            setBriefContext]            = useState(brief?.context            || '')
  const [briefExpectedOutput,     setBriefExpectedOutput]     = useState(brief?.expectedOutput     || '')
  const [briefAcceptanceCriteria, setBriefAcceptanceCriteria] = useState(brief?.acceptanceCriteria || '')
  const [briefTechnicalNotes,     setBriefTechnicalNotes]     = useState(brief?.technicalNotes     || '')
  const [briefRulesFormat,        setBriefRulesFormat]        = useState(brief?.rulesFormat        || '')
  const [copied, setCopied] = useState(false)

  const hasBriefContent =
    briefContext.trim()            ||
    briefExpectedOutput.trim()     ||
    briefAcceptanceCriteria.trim() ||
    briefTechnicalNotes.trim()     ||
    briefRulesFormat.trim()

  const displayId = task?.id
    ? (task.id.startsWith('task-') ? `#T-${task.id.slice(5)}` : `#${task.id}`)
    : 'New Task'

  const handleSubmit = () => {
    if (!title.trim()) return

    const dependsList = depends.trim()
      ? depends.split(',').map((d) => d.trim()).filter(Boolean)
      : undefined

    const briefData: BriefContent | null = hasBriefContent
      ? {
          context:            briefContext.trim(),
          expectedOutput:     briefExpectedOutput.trim(),
          acceptanceCriteria: briefAcceptanceCriteria.trim(),
          technicalNotes:     briefTechnicalNotes.trim(),
          rulesFormat:        briefRulesFormat.trim(),
        }
      : null

    onSave(
      {
        ...(task ? { id: task.id } : {}),
        title:       title.trim(),
        description: description.trim(),
        milestone:   milestone.trim()  || undefined,
        deadline:    deadline.trim()   || undefined,
        priority,
        column,
        assignee:    assignee.trim()   || undefined,
        depends:     dependsList,
        subtasks,
        comments:    comments.length > 0 ? comments : undefined,
      },
      briefData,
    )
  }

  const addSubtask = () => {
    if (!newSubtask.trim()) return
    setSubtasks([...subtasks, { text: newSubtask.trim(), done: false }])
    setNewSubtask('')
  }

  const addComment = () => {
    if (!newCommentText.trim()) return
    const comment: TaskComment = {
      author: newCommentAuthor.trim() || 'Anonymous',
      text: newCommentText.trim(),
      timestamp: new Date().toISOString(),
      type: newCommentType,
    }
    setComments([...comments, comment])
    setNewCommentText('')
  }

  const handleCopyPrompt = () => {
    const parts: string[] = [
      `TASK: ${title || task?.title || '(untitled)'}`,
      `ID: ${task?.id || 'new'}`,
      '',
    ]
    if (briefContext.trim())            parts.push(`CONTEXT:\n${briefContext.trim()}`, '')
    if (briefExpectedOutput.trim())     parts.push(`EXPECTED OUTPUT:\n${briefExpectedOutput.trim()}`, '')
    if (briefAcceptanceCriteria.trim()) parts.push(`ACCEPTANCE CRITERIA:\n${briefAcceptanceCriteria.trim()}`, '')
    if (briefTechnicalNotes.trim())     parts.push(`TECHNICAL NOTES:\n${briefTechnicalNotes.trim()}`, '')
    if (briefRulesFormat.trim())        parts.push(`RULES & FORMAT:\n${briefRulesFormat.trim()}`, '')

    const prompt = parts.join('\n').trimEnd()

    try {
      navigator.clipboard.writeText(prompt)
    } catch {
      const el = document.createElement('textarea')
      el.value = prompt
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="task-detail-overlay" onClick={onClose}>
      <div
        className="task-detail-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={task ? 'Edit task' : 'New task'}
      >
        {/* Header */}
        <div className="detail-header">
          <div className="detail-header-meta">
            <span className="detail-task-id">{displayId}</span>
            <input
              className="detail-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
              autoFocus={!task}
            />
          </div>
          <button type="button" className="detail-close-btn" onClick={onClose} title="Close">
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="detail-tabs">
          <button
            type="button"
            className={`detail-tab ${activeTab === 'task' ? 'detail-tab-active' : ''}`}
            onClick={() => setActiveTab('task')}
          >
            Task
          </button>
          <button
            type="button"
            className={`detail-tab ${activeTab === 'brief' ? 'detail-tab-active' : ''}`}
            onClick={() => setActiveTab('brief')}
          >
            AI Brief
            {hasBriefContent ? <span className="detail-tab-dot" /> : null}
          </button>
          <button
            type="button"
            className={`detail-tab ${activeTab === 'subtasks' ? 'detail-tab-active' : ''}`}
            onClick={() => setActiveTab('subtasks')}
          >
            Subtasks
            {subtasks.length > 0 && (
              <span className="column-count" style={{ marginLeft: 4 }}>
                {subtasks.length}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`detail-tab ${activeTab === 'review' ? 'detail-tab-active' : ''}`}
            onClick={() => setActiveTab('review')}
          >
            💬 Review {comments.length > 0 && <span className="detail-tab-dot" />}
          </button>
        </div>

        {/* Body */}
        <div className="detail-body">

          {/* TASK TAB */}
          {activeTab === 'task' && (
            <>
              <div className="form-field">
                <label>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description..."
                  rows={3}
                />
              </div>

              <div className="task-meta-grid">
                <div className="form-field">
                  <label>Column</label>
                  <select value={column} onChange={(e) => setColumn(e.target.value)}>
                    {columns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Priority</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value as 'high' | 'medium' | 'low')}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Assignee</label>
                  <input
                    type="text"
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    placeholder="@handle"
                  />
                </div>

                <div className="form-field">
                  <label>Milestone</label>
                  <input
                    type="text"
                    value={milestone}
                    onChange={(e) => setMilestone(e.target.value)}
                    placeholder="e.g. MVP"
                  />
                </div>

                <div className="form-field">
                  <label>Deadline</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label>Depends on</label>
                  <input
                    type="text"
                    value={depends}
                    onChange={(e) => setDepends(e.target.value)}
                    placeholder="task-1, task-2"
                  />
                </div>
              </div>
            </>
          )}

          {/* BRIEF TAB */}
          {activeTab === 'brief' && (
            briefLoading ? (
              <div className="brief-loading">Loading brief...</div>
            ) : (
              <>
                <div className="brief-header">
                  <div className="brief-title">AI Agent Brief</div>
                  <div className="brief-subtitle">Define what an AI agent needs to complete this task.</div>
                </div>

                <div className="brief-divider" />

                <div className="brief-section">
                  <div className="brief-section-label">
                    <span className="brief-section-icon">&#129504;</span> Context
                  </div>
                  <BriefTextarea
                    value={briefContext}
                    onChange={setBriefContext}
                    placeholder="Why does this task exist? What problem does it solve?"
                    rows={3}
                  />
                </div>

                <div className="brief-section">
                  <div className="brief-section-label">
                    <span className="brief-section-icon">&#128228;</span> Expected Output
                  </div>
                  <BriefTextarea
                    value={briefExpectedOutput}
                    onChange={setBriefExpectedOutput}
                    placeholder="What should the result look like? Files, data, behavior..."
                    rows={3}
                  />
                </div>

                <div className="brief-section">
                  <div className="brief-section-label">
                    <span className="brief-section-icon">&#9989;</span> Acceptance Criteria
                  </div>
                  <BriefTextarea
                    value={briefAcceptanceCriteria}
                    onChange={setBriefAcceptanceCriteria}
                    placeholder="When is this task done? List conditions..."
                    rows={3}
                  />
                </div>

                <div className="brief-section">
                  <div className="brief-section-label">
                    <span className="brief-section-icon">&#9881;&#65039;</span> Technical Notes
                  </div>
                  <BriefTextarea
                    value={briefTechnicalNotes}
                    onChange={setBriefTechnicalNotes}
                    placeholder="Constraints, dependencies, gotchas, edge cases..."
                    rows={3}
                  />
                </div>

                <div className="brief-section">
                  <div className="brief-section-label">
                    <span className="brief-section-icon">&#128207;</span> Rules &amp; Format
                  </div>
                  <BriefTextarea
                    value={briefRulesFormat}
                    onChange={setBriefRulesFormat}
                    placeholder="Coding standards, naming conventions, output format..."
                    rows={3}
                  />
                </div>

                <div className="brief-divider" />

                <button
                  type="button"
                  className={`brief-copy-btn ${copied ? 'copied' : ''}`}
                  onClick={handleCopyPrompt}
                >
                  {copied ? '\u2713 Copied to clipboard!' : '\u2398 Copy AI Prompt'}
                </button>
              </>
            )
          )}

          {/* SUBTASKS TAB */}
          {activeTab === 'subtasks' && (
            <>
              {subtasks.length > 0 && (
                <div className="subtask-progress-info">
                  {subtasks.filter((s) => s.done).length} / {subtasks.length} done
                </div>
              )}
              <div className="subtask-list-edit">
                {subtasks.map((subtask, index) => (
                  <div key={index} className="subtask-edit-item">
                    <input
                      type="checkbox"
                      checked={subtask.done}
                      className="subtask-checkbox"
                      onChange={() =>
                        setSubtasks((prev) =>
                          prev.map((item, idx) =>
                            idx === index ? { ...item, done: !item.done } : item,
                          ),
                        )
                      }
                    />
                    <span
                      style={{ flex: 1, fontSize: 12 }}
                      className={subtask.done ? 'subtask-text-done' : ''}
                    >
                      {subtask.text}
                    </span>
                    <button
                      type="button"
                      className="subtask-remove"
                      onClick={() =>
                        setSubtasks((prev) => prev.filter((_, idx) => idx !== index))
                      }
                      title="Remove"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>

              <div className="subtask-add">
                <input
                  type="text"
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  placeholder="Add subtask..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); addSubtask() }
                  }}
                />
                <button type="button" className="btn-secondary btn-sm" onClick={addSubtask}>
                  Add
                </button>
              </div>
            </>
          )}

          {/* REVIEW TAB */}
          {activeTab === 'review' && (
            <div className="form-body">
              <div className="review-input-section">
                <div className="review-type-row">
                  <label>Type:</label>
                  <select
                    value={newCommentType}
                    onChange={e => setNewCommentType(e.target.value as TaskComment['type'])}
                    className="review-type-select"
                  >
                    <option value="review">🔍 Review</option>
                    <option value="note">📝 Note</option>
                    <option value="rework">🔄 Rework</option>
                  </select>
                  <label>Author:</label>
                  <input
                    type="text"
                    value={newCommentAuthor}
                    onChange={e => setNewCommentAuthor(e.target.value)}
                    placeholder="Your name"
                    className="review-author-input"
                  />
                </div>
                <textarea
                  value={newCommentText}
                  onChange={e => setNewCommentText(e.target.value)}
                  placeholder="Write your review comment..."
                  rows={3}
                  className="review-textarea"
                />
                <button type="button" className="btn-primary review-add-btn" onClick={addComment}>
                  + Add Comment
                </button>
              </div>

              <hr className="review-separator" />

              <div className="review-comments-list">
                {comments.length === 0 && (
                  <div className="review-empty">No comments yet. Add review feedback above.</div>
                )}
                {[...comments].reverse().map((c, i) => {
                  const origIdx = comments.length - 1 - i
                  const typeEmoji = c.type === 'review' ? '🔍' : c.type === 'rework' ? '🔄' : '📝'
                  const date = new Date(c.timestamp)
                  const timeStr = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  return (
                    <div key={origIdx} className={`review-comment review-type-${c.type}`}>
                      <div className="review-comment-header">
                        <span className="review-comment-author">{typeEmoji} {c.author}</span>
                        <span className="review-comment-time">{timeStr}</span>
                        <button
                          type="button"
                          className="review-comment-delete"
                          onClick={() => setComments(comments.filter((_, idx) => idx !== origIdx))}
                        >×</button>
                      </div>
                      <p className="review-comment-text">{c.text}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="detail-actions">
          {onDelete ? (
            <button type="button" className="btn-danger" onClick={onDelete}>
              Delete
            </button>
          ) : (
            <div />
          )}
          <div className="detail-actions-right">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!title.trim()}
              onClick={handleSubmit}
            >
              {task ? 'Save changes' : 'Create task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

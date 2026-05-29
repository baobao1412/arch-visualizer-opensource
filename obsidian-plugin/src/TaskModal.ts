import { App, Modal, Setting, TextComponent, DropdownComponent } from 'obsidian'
import { TaskCard, BriefContent, Subtask, TaskComment } from './types'

export class TaskModal extends Modal {
  private task: TaskCard
  private columns: string[]
  private isNew: boolean
  private onSave: (task: TaskCard) => void
  private onDelete?: (taskId: string) => void
  private onLoadBrief?: (taskId: string) => Promise<BriefContent>
  private onSaveBrief?: (taskId: string, brief: BriefContent) => Promise<void>
  private onTriggerRework?: (task: TaskCard) => Promise<string | void>
  private briefContent: BriefContent | null = null

  constructor(
    app: App,
    task: TaskCard,
    columns: string[],
    isNew: boolean,
    onSave: (task: TaskCard) => void,
    onDelete?: (taskId: string) => void,
    onLoadBrief?: (taskId: string) => Promise<BriefContent>,
    onSaveBrief?: (taskId: string, brief: BriefContent) => Promise<void>,
    onTriggerRework?: (task: TaskCard) => Promise<string | void>,
  ) {
    super(app)
    this.task = JSON.parse(JSON.stringify(task))
    this.columns = columns
    this.isNew = isNew
    this.onSave = onSave
    this.onDelete = onDelete
    this.onLoadBrief = onLoadBrief
    this.onSaveBrief = onSaveBrief
    this.onTriggerRework = onTriggerRework
  }

  async onOpen() {
    const { contentEl } = this
    contentEl.empty()
    contentEl.addClass('av-task-modal')

    const header = contentEl.createDiv({ cls: 'av-modal-header' })
    const headerText = header.createDiv({ cls: 'av-modal-header-text' })
    headerText.createEl('h2', { text: this.isNew ? 'New Task' : 'Edit Task' })
    if (!this.isNew) headerText.createEl('span', { text: this.task.id, cls: 'av-modal-task-id' })

    const tabBar = contentEl.createDiv({ cls: 'av-tab-bar' })
    const detailsTab = tabBar.createEl('button', { cls: 'av-tab active', text: 'Details' })
    const briefTab = tabBar.createEl('button', { cls: 'av-tab', text: 'Brief' })
    const reviewTab = tabBar.createEl('button', { cls: 'av-tab', text: 'Review' })

    const commentCount = (this.task.comments || []).length
    if (!this.isNew && commentCount > 0) {
      reviewTab.createEl('span', { cls: 'av-tab-badge', text: String(commentCount) })
    }

    const detailsContainer = contentEl.createDiv({ cls: 'av-tab-content' })
    const briefContainer = contentEl.createDiv({ cls: 'av-tab-content av-hidden' })
    const reviewContainer = contentEl.createDiv({ cls: 'av-tab-content av-hidden' })

    const activateTab = (idx: number) => {
      ;[detailsTab, briefTab, reviewTab].forEach((t, i) => i === idx ? t.addClass('active') : t.removeClass('active'))
      ;[detailsContainer, briefContainer, reviewContainer].forEach((c, i) => i === idx ? c.removeClass('av-hidden') : c.addClass('av-hidden'))
    }

    detailsTab.addEventListener('click', () => activateTab(0))

    let briefLoaded = false
    briefTab.addEventListener('click', async () => {
      activateTab(1)
      if (!briefLoaded && this.onLoadBrief && !this.isNew) {
        briefLoaded = true
        this.briefContent = await this.onLoadBrief(this.task.id)
        this.renderBriefTab(briefContainer)
      }
    })

    reviewTab.addEventListener('click', () => { activateTab(2); this.renderReviewTab(reviewContainer) })

    this.renderDetailsTab(detailsContainer)

    const actions = contentEl.createDiv({ cls: 'av-modal-actions' })
    const saveBtn = actions.createEl('button', { text: this.isNew ? 'Create' : 'Save', cls: 'mod-cta' })
    saveBtn.addEventListener('click', async () => {
      this.onSave(this.task)
      if (this.briefContent && this.onSaveBrief && !this.isNew) {
        await this.onSaveBrief(this.task.id, this.briefContent)
      }
      this.close()
    })

    if (!this.isNew && this.onDelete) {
      const deleteBtn = actions.createEl('button', { text: 'Delete', cls: 'mod-warning' })
      deleteBtn.addEventListener('click', () => { this.onDelete!(this.task.id); this.close() })
    }

    actions.createEl('button', { text: 'Cancel' }).addEventListener('click', () => this.close())
  }

  private renderDetailsTab(container: HTMLElement) {
    container.empty()

    new Setting(container).setName('Title').addText((t: TextComponent) => {
      t.setValue(this.task.title).onChange((v: string) => { this.task.title = v })
      t.inputEl.style.width = '100%'
    })

    new Setting(container).setName('Column').addDropdown((dd: DropdownComponent) => {
      for (const col of this.columns) dd.addOption(col, col)
      dd.setValue(this.task.column).onChange((v: string) => { this.task.column = v })
    })

    new Setting(container).setName('Priority').addDropdown((dd: DropdownComponent) => {
      dd.addOption('low', 'Low').addOption('medium', 'Medium').addOption('high', 'High')
      dd.setValue(this.task.priority).onChange((v: string) => { this.task.priority = v as 'high' | 'medium' | 'low' })
    })

    new Setting(container).setName('Assignee').addText((t: TextComponent) => {
      t.setValue(this.task.assignee || '').onChange((v: string) => { this.task.assignee = v || undefined })
    })

    new Setting(container).setName('Milestone').addText((t: TextComponent) => {
      t.setValue(this.task.milestone || '').onChange((v: string) => { this.task.milestone = v || undefined })
    })

    new Setting(container).setName('Deadline').addText((t: TextComponent) => {
      t.setValue(this.task.deadline || '').setPlaceholder('YYYY-MM-DD').onChange((v: string) => { this.task.deadline = v || undefined })
    })

    new Setting(container).setName('Dependencies').setDesc('Comma-separated task IDs').addText((t: TextComponent) => {
      t.setValue((this.task.depends || []).join(', ')).onChange((v: string) => {
        this.task.depends = v.split(',').map((s: string) => s.trim()).filter(Boolean)
        if (!this.task.depends.length) this.task.depends = undefined
      })
    })

    const descSetting = new Setting(container).setName('Description')
    const descArea = descSetting.controlEl.createEl('textarea', { cls: 'av-textarea', attr: { rows: '3' } }) as HTMLTextAreaElement
    descArea.value = this.task.description
    descArea.style.width = '100%'
    descArea.addEventListener('input', () => { this.task.description = descArea.value })

    const subtaskSection = container.createDiv({ cls: 'av-subtask-section' })
    subtaskSection.createEl('h4', { text: 'Subtasks' })
    this.renderSubtasks(subtaskSection)
  }

  private renderSubtasks(container: HTMLElement) {
    const h4 = container.querySelector('h4')
    container.empty()
    if (h4) container.appendChild(h4)

    for (let i = 0; i < this.task.subtasks.length; i++) {
      const sub = this.task.subtasks[i]
      const row = container.createDiv({ cls: 'av-subtask-row' })
      const cb = row.createEl('input', { attr: { type: 'checkbox' } }) as HTMLInputElement
      cb.checked = sub.done
      cb.addEventListener('change', () => { sub.done = cb.checked })
      const input = row.createEl('input', { attr: { type: 'text', value: sub.text }, cls: 'av-subtask-input' }) as HTMLInputElement
      input.addEventListener('input', () => { sub.text = input.value })
      const removeBtn = row.createEl('button', { cls: 'av-subtask-remove', text: '×' })
      removeBtn.addEventListener('click', () => { this.task.subtasks.splice(i, 1); this.renderSubtasks(container) })
    }

    const addBtn = container.createEl('button', { cls: 'av-add-subtask-btn', text: '+ Add subtask' })
    addBtn.addEventListener('click', () => { this.task.subtasks.push({ text: '', done: false }); this.renderSubtasks(container) })
  }

  private renderBriefTab(container: HTMLElement) {
    container.empty()
    if (this.isNew) { container.createDiv({ cls: 'av-brief-hint', text: 'Brief will be available after saving the task.' }); return }
    if (!this.briefContent) this.briefContent = { context: '', expectedOutput: '', acceptanceCriteria: '', technicalNotes: '', rulesFormat: '' }

    container.createDiv({ cls: 'av-brief-hint', text: 'Write a brief to help AI agents understand the task context and expected output.' })

    const sections: { key: keyof BriefContent; label: string; desc: string }[] = [
      { key: 'context', label: '🧠 Context', desc: 'Why does this task exist?' },
      { key: 'expectedOutput', label: '📤 Expected Output', desc: 'What should the result look like?' },
      { key: 'acceptanceCriteria', label: '✅ Acceptance Criteria', desc: 'When is this task done?' },
      { key: 'technicalNotes', label: '⚙️ Technical Notes', desc: 'Constraints, dependencies, gotchas' },
      { key: 'rulesFormat', label: '📏 Rules & Format', desc: 'Coding standards, patterns to follow' },
    ]

    for (const sec of sections) {
      const brief = this.briefContent!
      const section = container.createDiv({ cls: 'av-brief-section' })
      section.createEl('h4', { text: sec.label })
      section.createEl('p', { text: sec.desc, cls: 'av-brief-desc' })
      const area = section.createEl('textarea', { cls: 'av-textarea', attr: { rows: '3' } }) as HTMLTextAreaElement
      area.value = brief[sec.key]
      area.style.width = '100%'
      area.addEventListener('input', () => { brief[sec.key] = area.value })
    }
  }

  private renderReviewTab(container: HTMLElement) {
    container.empty()
    if (!this.task.comments) this.task.comments = []

    // Rework prompt section (only for existing tasks)
    if (!this.isNew && this.onTriggerRework) {
      const reworkSection = container.createDiv({ cls: 'av-rework-section' })
      reworkSection.createEl('h4', { text: '🔄 Generate Rework Prompt' })
      reworkSection.createEl('p', { text: 'Generate a rework prompt file from the review comments below. The file will be saved to rework/{taskId}.rework.md.', cls: 'av-brief-hint' })

      const reworkActions = reworkSection.createDiv({ cls: 'av-rework-actions' })
      const reworkBtn = reworkActions.createEl('button', { cls: 'mod-cta av-rework-btn', text: '📝 Generate Rework Prompt' })
      reworkBtn.addEventListener('click', async () => {
        reworkBtn.disabled = true
        reworkBtn.textContent = 'Generating...'
        try {
          await this.onTriggerRework!(this.task)
          reworkBtn.textContent = '✅ Prompt saved'
          setTimeout(() => { reworkBtn.textContent = '📝 Generate Rework Prompt'; reworkBtn.disabled = false }, 3000)
        } catch {
          reworkBtn.textContent = '❌ Failed'
          reworkBtn.disabled = false
        }
      })

      container.createEl('hr', { cls: 'av-review-separator' })
    }

    const inputSection = container.createDiv({ cls: 'av-review-input' })
    inputSection.createDiv({ cls: 'av-brief-hint', text: 'Add review feedback. "Review" comments will be included in AI rework prompts.' })

    const typeRow = inputSection.createDiv({ cls: 'av-review-type-row' })
    typeRow.createEl('label', { text: 'Type: ' })
    const typeSelect = typeRow.createEl('select', { cls: 'av-review-type-select' }) as HTMLSelectElement
    typeSelect.createEl('option', { text: '🔍 Review', attr: { value: 'review' } })
    typeSelect.createEl('option', { text: '📝 Note', attr: { value: 'note' } })
    typeSelect.createEl('option', { text: '🔄 Rework', attr: { value: 'rework' } })

    const authorRow = inputSection.createDiv({ cls: 'av-review-type-row' })
    authorRow.createEl('label', { text: 'Author: ' })
    const authorInput = authorRow.createEl('input', { attr: { type: 'text', placeholder: 'Your name' }, cls: 'av-review-author' }) as HTMLInputElement
    authorInput.value = this.task.assignee?.replace('@', '') || ''

    const commentArea = inputSection.createEl('textarea', { cls: 'av-textarea av-review-textarea', attr: { rows: '3', placeholder: 'Write your review comment...' } }) as HTMLTextAreaElement
    commentArea.style.width = '100%'

    const addBtn = inputSection.createEl('button', { cls: 'mod-cta av-review-add-btn', text: '+ Add Comment' })
    addBtn.addEventListener('click', () => {
      const text = commentArea.value.trim()
      if (!text) return
      const comment: TaskComment = {
        author: authorInput.value.trim() || 'Anonymous',
        text,
        timestamp: new Date().toISOString(),
        type: typeSelect.value as TaskComment['type'],
      }
      this.task.comments!.push(comment)
      commentArea.value = ''
      this.renderReviewTab(container)
    })

    container.createEl('hr', { cls: 'av-review-separator' })

    const commentsSection = container.createDiv({ cls: 'av-review-comments' })
    const comments = [...(this.task.comments || [])].reverse()
    if (!comments.length) {
      commentsSection.createDiv({ cls: 'av-review-empty', text: 'No comments yet.' })
    } else {
      for (let ci = 0; ci < comments.length; ci++) {
        const c = comments[ci]
        const origIdx = (this.task.comments?.length || 0) - 1 - ci
        const commentEl = commentsSection.createDiv({ cls: `av-review-comment av-review-type-${c.type}` })
        const hdr = commentEl.createDiv({ cls: 'av-review-comment-header' })
        const typeEmoji = c.type === 'review' ? '🔍' : c.type === 'rework' ? '🔄' : '📝'
        hdr.createEl('span', { cls: 'av-review-comment-author', text: `${typeEmoji} ${c.author}` })
        const d = new Date(c.timestamp)
        hdr.createEl('span', { cls: 'av-review-comment-time', text: `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` })
        commentEl.createEl('p', { cls: 'av-review-comment-text', text: c.text })
        const delBtn = commentEl.createEl('button', { cls: 'av-review-comment-delete', text: '×' })
        delBtn.addEventListener('click', () => { this.task.comments!.splice(origIdx, 1); this.renderReviewTab(container) })
      }
    }
  }

  onClose() { this.contentEl.empty() }
}

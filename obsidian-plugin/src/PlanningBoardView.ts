import { App, ItemView, WorkspaceLeaf, TFile, Notice, Menu } from 'obsidian'
import { parsePlanFile } from './planFileParser'
import { serializePlanFile, generateTaskId } from './planFileSerializer'
import { TaskCard, PlanBoard, BriefContent, TaskComment } from './types'
import { TaskModal } from './TaskModal'
import { ClickUpSyncService } from './ClickUpSyncService'
import type ArchVisualizerPlanningPlugin from './main'

export const PLANNING_VIEW_TYPE = 'arch-visualizer-planning-board'

const PRIORITY_COLORS: Record<string, string> = {
  high: '#ef5350',
  medium: '#ffb74d',
  low: '#42a5f5',
}

const COLUMN_COLORS: Record<string, string> = {
  'todo': '#9e9e9e',
  'in progress': '#42a5f5',
  'review': '#ffb74d',
  'done': '#4caf50',
}

export class PlanningBoardView extends ItemView {
  private board: PlanBoard | null = null
  private currentFile: TFile | null = null
  private selfWriteFlag = false
  private selfWriteTimeout: ReturnType<typeof setTimeout> | null = null
  private dragTask: TaskCard | null = null
  private graphMode = false

  constructor(leaf: WorkspaceLeaf, private readonly obsApp: App, private readonly plugin: ArchVisualizerPlanningPlugin) {
    super(leaf)
  }

  getViewType() { return PLANNING_VIEW_TYPE }
  getDisplayText() { return 'Planning Board' }
  getIcon() { return 'kanban' }

  isSelfWrite() { return this.selfWriteFlag }

  async onOpen() { await this.autoLoad() }
  async onClose() { }

  async autoLoad() {
    const files = this.obsApp.vault.getFiles().filter(
      f => f.path.endsWith('.plan.md') && f.path.startsWith('planning/')
    )
    if (!files.length) { this.renderEmpty(); return }
    files.sort((a, b) => b.stat.mtime - a.stat.mtime)
    await this.loadFile(files[0])
  }

  async loadFile(file: TFile) {
    const content = await this.obsApp.vault.read(file)
    this.board = parsePlanFile(content)
    this.currentFile = file
    this.render()
  }

  async writeToDisk() {
    if (!this.currentFile || !this.board) return
    const content = serializePlanFile(this.board)
    this.selfWriteFlag = true
    if (this.selfWriteTimeout) clearTimeout(this.selfWriteTimeout)
    this.selfWriteTimeout = setTimeout(() => { this.selfWriteFlag = false }, 2000)
    await this.obsApp.vault.modify(this.currentFile, content)
  }

  async handleExternalChange(file: TFile) {
    if (file !== this.currentFile) return
    const content = await this.obsApp.vault.read(file)
    this.board = parsePlanFile(content)
    this.render()
  }

  async createNewPlanFile() {
    try { await this.obsApp.vault.createFolder('planning') } catch { }
    try { await this.obsApp.vault.createFolder('planning/briefs') } catch { }

    const defaultBoard: PlanBoard = {
      title: 'Sprint 1',
      columns: ['Todo', 'In Progress', 'Review', 'Done'],
      tasks: [],
    }
    const content = serializePlanFile(defaultBoard)
    const filePath = 'planning/sprint.plan.md'
    let file = this.obsApp.vault.getAbstractFileByPath(filePath)
    if (file instanceof TFile) {
      await this.loadFile(file)
    } else {
      const newFile = await this.obsApp.vault.create(filePath, content)
      await this.loadFile(newFile)
      await this.generateConventionFiles()
    }
  }

  private async generateConventionFiles() {
    const baseInstructions = `# Planning Board — AI Instructions

This vault uses a kanban-style planning board system managed by the Arch Visualizer plugin.

## File Format

Plan files are stored as \`planning/*.plan.md\` with YAML frontmatter + markdown sections:

\`\`\`
---
title: Sprint Name
columns:
  - Todo
  - In Progress
  - Review
  - Done
---

## Column Name

### [task-1] Task Title
- assignee: @username
- milestone: v1.0
- deadline: YYYY-MM-DD
- priority: high|medium|low
- depends: task-2, task-3
- output: briefs/task-1.md
- comments: [{"author":"Name","text":"...","timestamp":"ISO","type":"review|note|rework"}]

Task description paragraph.

- [ ] subtask 1
- [x] subtask 2
\`\`\`

## Brief Files

Extended task context is stored in \`planning/briefs/{taskId}.md\`:
- \`## Context\` — Why this task exists
- \`## Expected Output\` — What the result should look like
- \`## Acceptance Criteria\` — When is this task done
- \`## Technical Notes\` — Constraints, dependencies
- \`## Rules & Format\` — Coding standards to follow

## Rework Files

When a task is sent back for rework, a prompt is saved to \`rework/{taskId}.rework.md\`.

## Task ID Format

Tasks use sequential IDs: \`task-1\`, \`task-2\`, etc.
ClickUp-imported tasks use \`cu-{clickupId}\`.

## Priority Levels

- \`high\` — Critical path, must be done ASAP
- \`medium\` — Normal priority (default)
- \`low\` — Nice to have

## Workflow

1. Create tasks in **Todo**
2. Move to **In Progress** when starting work
3. Move to **Review** when ready for review
4. Move to **Done** when accepted
5. If rejected, move back to **In Progress/Todo** — triggers rework detection
`

    const claudeMd = `# Planning Board — Quick Reference (Claude)

- Plan file: \`planning/sprint.plan.md\` (or any \`*.plan.md\`)
- Task format: \`### [task-1] Title\` with metadata lines and description
- Briefs: \`planning/briefs/{taskId}.md\`
- Rework prompts: \`rework/{taskId}.rework.md\`
- Priorities: high | medium | low
- Status columns: Todo → In Progress → Review → Done

When asked to work on a task, read the brief file first if it exists.
When generating code, check for existing patterns in the codebase first.
`

    const copilotInstructions = `# Arch Visualizer Planning Board

This repository uses a kanban planning system. Task specs live in \`planning/briefs/{taskId}.md\`.
Check the brief for context, expected output, and acceptance criteria before starting work.
Rework context is in \`rework/{taskId}.rework.md\` when a task has been reviewed.
`

    const cursorRules = `---
description: Planning board task context
globs: ["planning/**", "rework/**"]
alwaysApply: false
---

# Planning Board Rules

- Read brief files from \`planning/briefs/{taskId}.md\` for task context
- Rework prompts in \`rework/{taskId}.rework.md\` contain reviewer feedback
- Task IDs follow pattern \`task-N\` or \`cu-{clickupId}\`
- Check acceptance criteria before marking work complete
`

    const writes: [string, string][] = [
      ['.instructions.md', baseInstructions],
      ['CLAUDE.md', claudeMd],
      ['.github/copilot-instructions.md', copilotInstructions],
      ['.cursor/rules/planning.mdc', cursorRules],
    ]

    for (const [path, content] of writes) {
      try {
        const dir = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : null
        if (dir) { try { await this.obsApp.vault.createFolder(dir) } catch { } }
        const existing = this.obsApp.vault.getAbstractFileByPath(path)
        if (!existing) await this.obsApp.vault.create(path, content)
      } catch { }
    }
    new Notice('✅ Created plan file + AI convention files (.instructions.md, CLAUDE.md, etc.)')
  }

  refresh() { void this.autoLoad() }

  async openCurrentPlanFile() {
    if (!this.currentFile) { new Notice('No plan file loaded.'); return }
    await this.obsApp.workspace.openLinkText(this.currentFile.basename, this.currentFile.path)
  }

  async syncClickUp() {
    if (!this.board) { new Notice('No plan loaded.'); return }
    const { clickupToken, clickupListId } = this.plugin.settings
    if (!clickupToken || !clickupListId) {
      new Notice('⚙️ Configure ClickUp token and list ID in Settings → Arch Visualizer.')
      return
    }
    new Notice('🔄 Syncing with ClickUp...')
    const svc = new ClickUpSyncService(clickupToken, clickupListId, this.obsApp.vault)
    try {
      const { board, added, updated, briefs } = await svc.pullFromClickUp(this.board)
      this.board = board
      await this.writeToDisk()
      this.render()
      new Notice(`✅ ClickUp sync done: +${added} new, ~${updated} updated, ${briefs} briefs written.`)
    } catch (e) {
      new Notice(`❌ Sync failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async generateReworkPrompt(task: TaskCard) {
    try { await this.obsApp.vault.createFolder('rework') } catch { }
    const reviewComments = (task.comments || []).filter(c => c.type === 'review' || c.type === 'rework')
    const commentBlock = reviewComments.length
      ? reviewComments.map(c => `### ${c.author} (${new Date(c.timestamp).toLocaleString()})\n${c.text}`).join('\n\n')
      : '_No review comments yet._'

    let briefSection = ''
    const briefFile = this.obsApp.vault.getAbstractFileByPath(`planning/briefs/${task.id}.md`)
    if (briefFile instanceof TFile) {
      const briefContent = await this.obsApp.vault.read(briefFile)
      briefSection = `\n## Original Brief\n\n${briefContent}\n`
    }

    const content = `# Rework Prompt: ${task.title}

**Task ID:** ${task.id}
**Priority:** ${task.priority}
**Assignee:** ${task.assignee || '_unassigned_'}

## Task Description

${task.description || '_No description._'}
${briefSection}
## Review Feedback

${commentBlock}

## Instructions for AI Agent

Based on the review feedback above, please:
1. Review the original task description and brief
2. Address each piece of feedback
3. Implement the requested changes
4. Ensure all acceptance criteria are met before marking as complete

`
    const path = `rework/${task.id}.rework.md`
    const existing = this.obsApp.vault.getAbstractFileByPath(path)
    if (existing instanceof TFile) await this.obsApp.vault.modify(existing, content)
    else await this.obsApp.vault.create(path, content)

    const notice = new Notice(`🔄 Rework prompt saved: rework/${task.id}.rework.md`, 8000)
    // Add clickable "Open" action via notice
    void this.obsApp.workspace.openLinkText(`${task.id}.rework`, path)
    return path
  }

  private render() {
    const container = this.containerEl.children[1] as HTMLElement
    container.empty()
    container.addClass('av-planning-root')

    if (!this.board) { this.renderEmpty(); return }

    // Header
    const header = container.createDiv({ cls: 'av-planning-header' })
    const left = header.createDiv({ cls: 'av-planning-header-left' })
    left.createEl('span', { cls: 'av-planning-logo', text: '⊞' })
    left.createEl('span', { cls: 'av-planning-title', text: this.board.title })
    if (this.currentFile) {
      header.createEl('span', { cls: 'av-planning-filepath', text: this.currentFile.name, attr: { title: this.currentFile.path } })
    }

    // Header action buttons
    const headerRight = header.createDiv({ cls: 'av-planning-header-right' })
    const graphBtn = headerRight.createEl('button', {
      cls: 'av-header-btn av-graph-toggle-btn',
      text: this.graphMode ? '📋 Board' : '📊 Graph',
      attr: { title: this.graphMode ? 'Switch to Board view' : 'Switch to Dependency Graph' }
    })
    graphBtn.addEventListener('click', () => { this.graphMode = !this.graphMode; this.render() })
    const openBtn = headerRight.createEl('button', { cls: 'av-header-btn', text: '📄 Open File', attr: { title: 'Open plan file in editor' } })
    openBtn.addEventListener('click', () => void this.openCurrentPlanFile())
    const syncBtn = headerRight.createEl('button', { cls: 'av-header-btn av-sync-btn', text: '☁ Sync ClickUp', attr: { title: 'Sync with ClickUp' } })
    syncBtn.addEventListener('click', () => void this.syncClickUp())

    if (this.graphMode) {
      this.renderGraphView(container)
      return
    }

    // Board
    const boardEl = container.createDiv({ cls: 'av-kanban-board' })
    for (const column of this.board.columns) {
      const tasks = this.board.tasks.filter(t => t.column === column)
      this.renderColumn(boardEl, column, tasks)
    }

    // Add column
    const addColBtn = boardEl.createDiv({ cls: 'av-add-column-btn', text: '+ Add Column' })
    addColBtn.addEventListener('click', () => void this.promptAddColumn())
  }

  private renderGraphView(container: HTMLElement) {
    if (!this.board) return

    const NODE_W = 200
    const NODE_H = 105
    const H_GAP  = 72
    const V_GAP  = 16
    const PAD_TOP = 52
    const PAD_LEFT = 16

    // Group tasks per column
    const grouped: Map<string, TaskCard[]> = new Map()
    for (const col of this.board.columns) grouped.set(col, [])
    for (const task of this.board.tasks) {
      const arr = grouped.get(task.column)
      if (arr) arr.push(task)
      else grouped.set(task.column, [task])
    }

    // Calculate positions
    const pos: Record<string, { x: number; y: number }> = {}
    let colIdx = 0
    for (const col of this.board.columns) {
      const tasks = grouped.get(col) || []
      tasks.forEach((task, rowIdx) => {
        pos[task.id] = {
          x: PAD_LEFT + colIdx * (NODE_W + H_GAP),
          y: PAD_TOP + rowIdx * (NODE_H + V_GAP),
        }
      })
      colIdx++
    }

    const totalCols = this.board.columns.length
    const maxRows = Math.max(...Array.from(grouped.values()).map(a => a.length), 1)
    const canvasW = PAD_LEFT * 2 + totalCols * (NODE_W + H_GAP)
    const canvasH = PAD_TOP + maxRows * (NODE_H + V_GAP) + 24

    const wrapper = container.createDiv({ cls: 'av-graph-wrapper' })
    const canvas = wrapper.createDiv({ cls: 'av-graph-canvas' })
    canvas.style.width = `${canvasW}px`
    canvas.style.height = `${canvasH}px`

    // SVG edge layer
    const svgNS = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(svgNS, 'svg')
    svg.setAttribute('class', 'av-graph-svg')
    svg.setAttribute('width', String(canvasW))
    svg.setAttribute('height', String(canvasH))
    svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;overflow:visible;'

    // Arrowhead marker
    const defs = document.createElementNS(svgNS, 'defs')
    const marker = document.createElementNS(svgNS, 'marker')
    marker.setAttribute('id', 'av-arrow')
    marker.setAttribute('markerWidth', '9')
    marker.setAttribute('markerHeight', '7')
    marker.setAttribute('refX', '9')
    marker.setAttribute('refY', '3.5')
    marker.setAttribute('orient', 'auto')
    const poly = document.createElementNS(svgNS, 'polygon')
    poly.setAttribute('points', '0 0, 9 3.5, 0 7')
    poly.setAttribute('fill', 'rgba(167,139,250,0.75)')
    marker.appendChild(poly)
    defs.appendChild(marker)
    svg.appendChild(defs)

    // Draw edges
    for (const task of this.board.tasks) {
      for (const depId of (task.depends || [])) {
        const from = pos[depId]
        const to = pos[task.id]
        if (!from || !to) continue
        const x1 = from.x + NODE_W
        const y1 = from.y + NODE_H / 2
        const x2 = to.x
        const y2 = to.y + NODE_H / 2
        const cx = (x1 + x2) / 2
        const path = document.createElementNS(svgNS, 'path')
        path.setAttribute('d', `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`)
        path.setAttribute('stroke', 'rgba(167,139,250,0.5)')
        path.setAttribute('stroke-width', '1.5')
        path.setAttribute('fill', 'none')
        path.setAttribute('marker-end', 'url(#av-arrow)')
        svg.appendChild(path)
      }
    }
    canvas.appendChild(svg)

    // Column labels row
    for (const [colName, _tasks] of grouped.entries()) {
      const idx = this.board.columns.indexOf(colName)
      if (idx === -1) continue
      const colColor = COLUMN_COLORS[colName.toLowerCase()] || '#9e9e9e'
      const label = canvas.createDiv({ cls: 'av-graph-col-label' })
      label.style.cssText = `position:absolute;top:10px;left:${PAD_LEFT + idx * (NODE_W + H_GAP)}px;width:${NODE_W}px;`
      const dot = label.createDiv({ cls: 'av-graph-col-dot' })
      dot.style.cssText = `background:${colColor};box-shadow:0 0 6px ${colColor};`
      label.createEl('span', { text: `${colName} (${(_tasks).length})` })
      label.style.color = colColor
    }

    // Task nodes
    for (const task of this.board.tasks) {
      const p = pos[task.id]
      if (!p) continue
      const colColor = COLUMN_COLORS[task.column.toLowerCase()] || '#9e9e9e'
      const priorityColor = PRIORITY_COLORS[task.priority] || '#475569'

      const node = canvas.createDiv({ cls: 'av-graph-node' })
      node.style.cssText = `position:absolute;left:${p.x}px;top:${p.y}px;width:${NODE_W}px;`
      node.style.setProperty('--col-color', colColor)
      node.style.setProperty('--priority-color', priorityColor)
      node.addEventListener('click', () => void this.openEditTask(task))

      const inner = node.createDiv({ cls: 'av-graph-node-inner' })

      // Top row
      const topRow = inner.createDiv({ cls: 'av-graph-node-top' })
      topRow.createEl('span', { cls: 'av-task-id', text: task.id })
      topRow.createEl('span', { cls: `av-task-tag av-priority-tag av-priority-${task.priority}`, text: task.priority })

      inner.createEl('div', { cls: 'av-graph-node-title', text: task.title })

      // Description preview
      if (task.description?.trim()) {
        inner.createEl('div', { cls: 'av-graph-node-desc', text: task.description.slice(0, 80) + (task.description.length > 80 ? '…' : '') })
      }

      // Bottom row: column badge + assignee
      const bottom = inner.createDiv({ cls: 'av-graph-node-bottom' })
      const badge = bottom.createEl('span', { cls: 'av-graph-col-badge', text: task.column })
      badge.style.cssText = `color:${colColor};background:${colColor}1a;border:1px solid ${colColor}33;`
      if (task.assignee) {
        const avatar = bottom.createDiv({ cls: 'av-graph-node-avatar' })
        avatar.textContent = task.assignee.replace('@', '').charAt(0).toUpperCase()
        avatar.title = task.assignee
      }

      // Dependency count badge
      const depCount = (task.depends || []).length
      const depOf = this.board.tasks.filter(t => (t.depends || []).includes(task.id)).length
      if (depCount || depOf) {
        const depBadge = inner.createEl('div', { cls: 'av-graph-node-deps' })
        if (depCount) depBadge.createEl('span', { text: `↑${depCount} dep` })
        if (depOf) depBadge.createEl('span', { text: `↓${depOf} blocked` })
      }
    }

    // Empty state
    if (!this.board.tasks.length) {
      wrapper.createDiv({ cls: 'av-graph-empty', text: 'No tasks yet. Add tasks from the Board view.' })
    }
  }

  private renderColumn(parent: HTMLElement, column: string, tasks: TaskCard[]) {
    if (!this.board) return
    const colLower = column.toLowerCase()
    const color = COLUMN_COLORS[colLower] || '#9e9e9e'

    const col = parent.createDiv({ cls: `av-kanban-column av-column-${colLower.replace(/\s+/g, '')}` })
    col.style.setProperty('--column-color', color)

    // Header
    const header = col.createDiv({ cls: 'av-column-header' })
    const headerLeft = header.createDiv({ cls: 'av-column-header-left' })
    const dot = headerLeft.createDiv({ cls: 'av-column-dot' })
    dot.style.background = color
    headerLeft.createEl('span', { cls: 'av-column-name', text: column })
    headerLeft.createEl('span', { cls: 'av-column-count', text: String(tasks.length) })

    const headerRight = header.createDiv({ cls: 'av-column-header-right' })
    const addBtn = headerRight.createEl('button', { cls: 'av-column-add-btn', text: '+' })
    addBtn.title = 'Add task'
    addBtn.addEventListener('click', (e) => { e.stopPropagation(); void this.openNewTaskModal(column) })

    const menuBtn = headerRight.createEl('button', { cls: 'av-column-menu-btn', text: '⋯' })
    menuBtn.addEventListener('click', (e) => {
      const menu = new Menu()
      menu.addItem(i => i.setTitle('Rename').setIcon('pencil').onClick(() => void this.promptRenameColumn(column)))
      menu.addItem(i => i.setTitle('Delete').setIcon('trash').onClick(() => void this.deleteColumn(column)))
      menu.showAtMouseEvent(e)
    })

    // Task list
    const taskList = col.createDiv({ cls: 'av-column-body' })

    taskList.addEventListener('dragover', (e) => { e.preventDefault(); taskList.addClass('av-column-drag-over') })
    taskList.addEventListener('dragleave', (e) => {
      if (!taskList.contains(e.relatedTarget as Node)) taskList.removeClass('av-column-drag-over')
    })
    taskList.addEventListener('drop', (e) => {
      e.preventDefault()
      taskList.removeClass('av-column-drag-over')
      if (!this.dragTask || !this.board) return
      const idx = this.getDropIndex(taskList, e.clientY, this.dragTask.id, column)
      void this.moveTask(this.dragTask, column, idx)
    })

    if (!tasks.length) {
      taskList.createDiv({ cls: 'av-column-empty', text: 'Drop tasks here' })
    }

    for (const task of tasks) {
      this.renderTaskCard(taskList, task)
    }
  }

  private renderTaskCard(parent: HTMLElement, task: TaskCard) {
    const isOverdue = task.deadline && new Date(task.deadline) < new Date()
    const subtasksDone = task.subtasks.filter(s => s.done).length
    const subtasksTotal = task.subtasks.length

    const card = parent.createDiv({ cls: 'av-task-card' })
    card.style.setProperty('--priority-color', PRIORITY_COLORS[task.priority] || '#475569')
    card.draggable = true

    card.addEventListener('dragstart', (e) => {
      this.dragTask = task
      card.addClass('av-task-dragging')
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
    })
    card.addEventListener('dragend', () => {
      this.dragTask = null
      card.removeClass('av-task-dragging')
    })
    card.addEventListener('click', () => void this.openEditTask(task))

    card.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      const menu = new Menu()
      if (this.board) {
        for (const col of this.board.columns) {
          if (col !== task.column) {
            menu.addItem(i => i.setTitle(`Move to ${col}`).onClick(() => {
              const colTasks = this.board!.tasks.filter(t => t.column === col)
              void this.moveTask(task, col, colTasks.length)
            }))
          }
        }
        menu.addSeparator()
      }
      menu.addItem(i => i.setTitle('Edit').setIcon('pencil').onClick(() => void this.openEditTask(task)))
      menu.addItem(i => i.setTitle('Delete').setIcon('trash').onClick(() => void this.deleteTask(task.id)))
      menu.showAtMouseEvent(e)
    })

    // Priority bar
    const bar = card.createDiv({ cls: 'av-task-priority-bar' })
    bar.style.background = PRIORITY_COLORS[task.priority] || '#475569'

    const content = card.createDiv({ cls: 'av-task-content' })
    const top = content.createDiv({ cls: 'av-task-top' })
    top.createEl('span', { cls: 'av-task-id', text: task.id })
    top.createEl('span', { cls: `av-task-tag av-priority-tag av-priority-${task.priority}`, text: task.priority })

    content.createEl('div', { cls: 'av-task-title', text: task.title })

    if (task.assignee) {
      const infoRow = content.createDiv({ cls: 'av-task-info-row' })
      const avatar = infoRow.createDiv({ cls: 'av-task-avatar' })
      avatar.title = task.assignee
      avatar.textContent = task.assignee.replace('@', '').charAt(0).toUpperCase()
      infoRow.createEl('span', { cls: 'av-assignee-name', text: task.assignee })
    }

    if (subtasksTotal > 0) {
      const progress = content.createDiv({ cls: 'av-task-progress' })
      const barEl = progress.createDiv({ cls: 'av-progress-bar' })
      const fill = barEl.createDiv({ cls: 'av-progress-fill' })
      fill.style.width = `${Math.round((subtasksDone / subtasksTotal) * 100)}%`
      progress.createEl('span', { cls: 'av-progress-text', text: `${subtasksDone}/${subtasksTotal}` })
    }

    const meta = content.createDiv({ cls: 'av-task-meta' })
    if (task.output) meta.createEl('span', { cls: 'av-task-tag av-brief-tag', text: 'brief' })
    if (task.milestone) meta.createEl('span', { cls: 'av-task-tag av-milestone-tag', text: task.milestone })
    if (task.deadline) {
      meta.createEl('span', { cls: `av-task-tag av-deadline-tag${isOverdue ? ' av-overdue' : ''}`, text: task.deadline })
    }
    if (task.depends?.length) meta.createEl('span', { cls: 'av-task-tag av-depends-tag', text: `↳${task.depends.length}` })
    if (task.comments?.length) meta.createEl('span', { cls: 'av-task-tag av-comments-tag', text: `💬${task.comments.length}` })
  }

  private getDropIndex(taskList: HTMLElement, mouseY: number, draggedId: string, column: string): number {
    if (!this.board) return 0
    const cards = Array.from(taskList.querySelectorAll('.av-task-card:not(.av-task-dragging)'))
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect()
      if (mouseY < rect.top + rect.height / 2) return i
    }
    return this.board.tasks.filter(t => t.column === column && t.id !== draggedId).length
  }

  private async moveTask(task: TaskCard, toColumn: string, insertIndex: number) {
    if (!this.board) return
    const fromColumn = task.column
    const fromLower = fromColumn.toLowerCase()
    const toLower = toColumn.toLowerCase()
    const isRework = (fromLower === 'review' || fromLower === 'done') && (toLower === 'in progress' || toLower === 'todo')

    const taskIdx = this.board.tasks.findIndex(t => t.id === task.id)
    if (taskIdx === -1) return
    this.board.tasks[taskIdx].column = toColumn

    if (isRework) {
      const comment: TaskComment = {
        author: 'System',
        text: `Task moved from "${fromColumn}" back to "${toColumn}" for rework.`,
        timestamp: new Date().toISOString(),
        type: 'rework',
      }
      if (!this.board.tasks[taskIdx].comments) this.board.tasks[taskIdx].comments = []
      this.board.tasks[taskIdx].comments!.push(comment)
      new Notice(`🔄 Rework: "${task.title}" moved back for revision.`)
      // Generate rework prompt file (non-blocking)
      void this.generateReworkPrompt(this.board.tasks[taskIdx])
    }

    // Push status to ClickUp if task has clickupId
    if (task.clickupId && this.plugin.settings.clickupToken) {
      const svc = new ClickUpSyncService(this.plugin.settings.clickupToken, this.plugin.settings.clickupListId, this.obsApp.vault)
      void svc.pushTaskToClickUp({ ...task, column: toColumn })
    }

    const moved = this.board.tasks.splice(taskIdx, 1)[0]
    const toColTasks = this.board.tasks.filter(t => t.column === toColumn)
    const otherTasks = this.board.tasks.filter(t => t.column !== toColumn)
    toColTasks.splice(insertIndex, 0, moved)

    const ordered: TaskCard[] = []
    for (const col of this.board.columns) {
      if (col === toColumn) ordered.push(...toColTasks)
      else ordered.push(...otherTasks.filter(t => t.column === col))
    }
    this.board.tasks = ordered

    await this.writeToDisk()
    this.render()
  }

  private async deleteTask(taskId: string) {
    if (!this.board) return
    this.board.tasks = this.board.tasks.filter(t => t.id !== taskId)
    await this.writeToDisk()
    this.render()
  }

  private async deleteColumn(column: string) {
    if (!this.board || this.board.columns.length <= 1) {
      new Notice('Cannot delete the last column.')
      return
    }
    const fallback = this.board.columns.find(c => c !== column)!
    this.board.columns = this.board.columns.filter(c => c !== column)
    for (const t of this.board.tasks) { if (t.column === column) t.column = fallback }
    await this.writeToDisk()
    this.render()
  }

  private async promptAddColumn() {
    const name = window.prompt('New column name:')
    if (!name?.trim() || !this.board) return
    if (!this.board.columns.includes(name.trim())) {
      this.board.columns.push(name.trim())
      await this.writeToDisk()
      this.render()
    }
  }

  private async promptRenameColumn(oldName: string) {
    const newName = window.prompt('Rename column:', oldName)
    if (!newName?.trim() || !this.board || newName.trim() === oldName) return
    const idx = this.board.columns.indexOf(oldName)
    if (idx === -1) return
    this.board.columns[idx] = newName.trim()
    for (const t of this.board.tasks) { if (t.column === oldName) t.column = newName.trim() }
    await this.writeToDisk()
    this.render()
  }

  private async generateBriefTemplate(task: TaskCard) {
    const briefPath = `planning/briefs/${task.id}.md`
    if (this.obsApp.vault.getAbstractFileByPath(briefPath) instanceof TFile) return
    try { await this.obsApp.vault.createFolder('planning/briefs') } catch { }
    const brief = `# ${task.title}\n\n## Context\n\n\n## Expected Output\n\n\n## Acceptance Criteria\n- [ ] \n\n## Technical Notes\n\n\n## Rules & Format\n\n`
    try { await this.obsApp.vault.create(briefPath, brief) } catch { }
  }

  async readBrief(taskId: string): Promise<BriefContent> {
    const empty: BriefContent = { context: '', expectedOutput: '', acceptanceCriteria: '', technicalNotes: '', rulesFormat: '' }
    const file = this.obsApp.vault.getAbstractFileByPath(`planning/briefs/${taskId}.md`)
    if (!(file instanceof TFile)) return empty
    const content = await this.obsApp.vault.read(file)
    return this.parseBriefContent(content)
  }

  private parseBriefContent(content: string): BriefContent {
    const map: Record<string, keyof BriefContent> = {
      'context': 'context', 'expected output': 'expectedOutput',
      'acceptance criteria': 'acceptanceCriteria', 'technical notes': 'technicalNotes',
      'rules & format': 'rulesFormat',
    }
    const sections: Partial<BriefContent> = {}
    let key: keyof BriefContent | null = null
    for (const line of content.split('\n')) {
      const h2 = line.match(/^## (.+)/)
      if (h2) { key = map[h2[1].trim().toLowerCase()] || null; if (key) sections[key] = ''; continue }
      if (line.startsWith('---')) { key = null; continue }
      if (key) sections[key] = (sections[key] || '') + line + '\n'
    }
    return {
      context: (sections.context || '').trim(),
      expectedOutput: (sections.expectedOutput || '').trim(),
      acceptanceCriteria: (sections.acceptanceCriteria || '').trim(),
      technicalNotes: (sections.technicalNotes || '').trim(),
      rulesFormat: (sections.rulesFormat || '').trim(),
    }
  }

  async writeBrief(taskId: string, brief: BriefContent) {
    const task = this.board?.tasks.find(t => t.id === taskId)
    const content = `# ${task?.title || taskId}\n\n## Context\n${brief.context}\n\n## Expected Output\n${brief.expectedOutput}\n\n## Acceptance Criteria\n${brief.acceptanceCriteria}\n\n## Technical Notes\n${brief.technicalNotes}\n\n## Rules & Format\n${brief.rulesFormat}\n`
    try { await this.obsApp.vault.createFolder('planning/briefs') } catch { }
    const path = `planning/briefs/${taskId}.md`
    const existing = this.obsApp.vault.getAbstractFileByPath(path)
    if (existing instanceof TFile) await this.obsApp.vault.modify(existing, content)
    else await this.obsApp.vault.create(path, content)
  }

  private async openNewTaskModal(column: string) {
    if (!this.board) return
    const newTask: TaskCard = {
      id: generateTaskId(this.board.tasks),
      title: '',
      description: '',
      priority: 'medium',
      column,
      subtasks: [],
    }
    new TaskModal(this.obsApp, newTask, this.board.columns, true, async (task) => {
      if (!task.title.trim() || !this.board) return
      this.board.tasks.push(task)
      await this.writeToDisk()
      await this.generateBriefTemplate(task)
      this.render()
    }).open()
  }

  private async openEditTask(task: TaskCard) {
    if (!this.board) return
    new TaskModal(
      this.obsApp, task, this.board.columns, false,
      async (updated) => {
        if (!this.board) return
        const idx = this.board.tasks.findIndex(t => t.id === updated.id)
        if (idx !== -1) this.board.tasks[idx] = updated
        await this.writeToDisk()
        this.render()
      },
      async (taskId) => {
        if (!this.board) return
        this.board.tasks = this.board.tasks.filter(t => t.id !== taskId)
        await this.writeToDisk()
        this.render()
      },
      (taskId) => this.readBrief(taskId),
      (taskId, brief) => this.writeBrief(taskId, brief),
      (t) => this.generateReworkPrompt(t),
    ).open()
  }

  private renderEmpty() {
    const container = this.containerEl.children[1] as HTMLElement
    container.empty()
    container.addClass('av-planning-root')
    const empty = container.createDiv({ cls: 'av-empty-state' })
    empty.createEl('div', { cls: 'av-empty-icon', text: '⊞' })
    empty.createEl('p', { cls: 'av-empty-title', text: 'Planning Board' })
    empty.createEl('p', { cls: 'av-empty-desc', text: 'Create or open a .plan.md file in your planning/ folder to get started.' })
    const actions = empty.createDiv({ cls: 'av-empty-actions' })
    actions.createEl('button', { cls: 'mod-cta', text: '+ Create New Plan' }).addEventListener('click', () => void this.createNewPlanFile())
    actions.createEl('button', { text: 'Open Existing' }).addEventListener('click', () => void this.openExistingPlan())
  }

  private async openExistingPlan() {
    const files = this.obsApp.vault.getFiles().filter(f => f.path.endsWith('.plan.md'))
    if (!files.length) { new Notice('No .plan.md files found.'); return }
    files.sort((a, b) => b.stat.mtime - a.stat.mtime)
    await this.loadFile(files[0])
  }
}

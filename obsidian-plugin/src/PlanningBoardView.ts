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
  private pendingSelfWrites = 0
  private selfWriteGraceUntil = 0
  private writeQueue: Promise<void> = Promise.resolve()
  private recentSelfSnapshots: string[] = []
  private dragTask: TaskCard | null = null
  private graphMode = false
  private lastPinnedNodeId: string | null = null
  private lastPinnedTooltipNodeId: string | null = null

  constructor(leaf: WorkspaceLeaf, private readonly obsApp: App, private readonly plugin: ArchVisualizerPlanningPlugin) {
    super(leaf)
  }

  getViewType() { return PLANNING_VIEW_TYPE }
  getDisplayText() { return 'Planning Board' }
  getIcon() { return 'kanban' }

  isSelfWrite() {
    return this.pendingSelfWrites > 0 || Date.now() < this.selfWriteGraceUntil
  }

  hasCurrentFile() {
    return Boolean(this.currentFile)
  }

  isCurrentFile(file: TFile) {
    return this.currentFile?.path === file.path
  }

  async onOpen() { await this.autoLoad() }
  async onClose() { }

  async autoLoad() {
    const rememberedPath = this.plugin.settings.lastPlanFilePath?.trim()
    if (rememberedPath) {
      const remembered = this.obsApp.vault.getAbstractFileByPath(rememberedPath)
      if (remembered instanceof TFile) {
        await this.loadFile(remembered)
        return
      }
    }

    let files = this.obsApp.vault.getFiles().filter((f) => f.path.endsWith('.plan.md') && f.path.startsWith('planning/'))
    if (!files.length) {
      files = this.obsApp.vault.getFiles().filter((f) => f.path.endsWith('.plan.md'))
    }
    if (!files.length) {
      this.renderEmpty()
      return
    }

    files.sort((a, b) => b.stat.mtime - a.stat.mtime)
    await this.loadFile(files[0])
  }

  async loadFile(file: TFile) {
    const content = await this.obsApp.vault.read(file)
    this.board = parsePlanFile(content)
    this.normalizeBoardIntegrity()
    this.currentFile = file
    await this.rememberCurrentFilePath()
    this.synchronizeFeatureRelations()
    this.render()
  }

  private async rememberCurrentFilePath() {
    if (!this.currentFile) return
    if (this.plugin.settings.lastPlanFilePath === this.currentFile.path) return
    this.plugin.settings.lastPlanFilePath = this.currentFile.path
    await this.plugin.saveSettings()
  }

  async writeToDisk() {
    if (!this.currentFile || !this.board) return
    this.synchronizeFeatureRelations()
    const file = this.currentFile
    const content = serializePlanFile(this.board)

    this.writeQueue = this.writeQueue
      .catch(() => {
        // Keep queue alive even if a previous write failed.
      })
      .then(async () => {
        this.pendingSelfWrites += 1
        this.trackSelfSnapshot(content)
        try {
          await this.obsApp.vault.modify(file, content)
        } finally {
          this.pendingSelfWrites = Math.max(0, this.pendingSelfWrites - 1)
          // Give modify event listeners a short window to observe this as a self-write.
          this.selfWriteGraceUntil = Date.now() + 1500
        }
      })

    await this.writeQueue
  }

  private trackSelfSnapshot(content: string) {
    this.recentSelfSnapshots.push(content)
    if (this.recentSelfSnapshots.length > 20) {
      this.recentSelfSnapshots.splice(0, this.recentSelfSnapshots.length - 20)
    }
  }

  private isKnownSelfSnapshot(content: string): boolean {
    const idx = this.recentSelfSnapshots.lastIndexOf(content)
    if (idx === -1) return false
    this.recentSelfSnapshots.splice(idx, 1)
    return true
  }

  async handleExternalChange(file: TFile) {
    if (file !== this.currentFile) return
    const content = await this.obsApp.vault.read(file)
    if (this.isKnownSelfSnapshot(content)) return
    this.board = parsePlanFile(content)
    this.normalizeBoardIntegrity()
    this.synchronizeFeatureRelations()
    this.render()
  }

  private normalizeBoardIntegrity() {
    if (!this.board) return
    const idCount = new Map<string, number>()
    const seen = new Set<string>()
    const fallbackColumn = this.board.columns[0] || 'Todo'

    for (const task of this.board.tasks) {
      // Keep column in a valid state.
      if (!this.board.columns.includes(task.column)) task.column = fallbackColumn

      if (!seen.has(task.id)) {
        seen.add(task.id)
        idCount.set(task.id, 1)
        continue
      }

      const base = task.clickupId ? `cu-${task.clickupId}` : task.id
      let n = idCount.get(base) || 1
      let next = base
      while (seen.has(next)) {
        n += 1
        next = `${base}-${n}`
      }
      task.id = next
      seen.add(next)
      idCount.set(base, n)
    }
  }

  private synchronizeFeatureRelations() {
    if (!this.board) return
    const knownIds = new Set(this.board.tasks.map(t => t.id))
    for (const task of this.board.tasks) {
      const inferred = this.extractSubtaskDependencies(task)
      const merged = [...(task.depends || []), ...inferred]
      const unique = Array.from(new Set(merged.filter(id => id !== task.id && knownIds.has(id))))
      task.depends = unique.length ? unique : undefined
    }
  }

  private extractSubtaskDependencies(task: TaskCard): string[] {
    const refs = new Set<string>()
    const patterns = [
      /(?:->|=>|@|\[\[)(task-[\w-]+|cu-[\w-]+)/gi,
      /\b(task-[\w-]+|cu-[\w-]+)\b/gi,
    ]
    for (const sub of task.subtasks || []) {
      const text = sub.text || ''
      for (const pattern of patterns) {
        while (true) {
          const m = pattern.exec(text)
          if (!m) break
          if (m[1]) refs.add(m[1])
        }
      }
    }
    return Array.from(refs)
  }

  private getGraphMemory() {
    const key = this.currentFile?.path
    if (!key) return undefined
    return this.plugin.settings.graphStateByFile?.[key]
  }

  private async saveGraphMemory(state: { scale: number; tx: number; ty: number; pinnedNodeId?: string; pinnedTooltipNodeId?: string }) {
    const key = this.currentFile?.path
    if (!key) return
    if (!this.plugin.settings.graphStateByFile) this.plugin.settings.graphStateByFile = {}
    this.plugin.settings.graphStateByFile[key] = state
    await this.plugin.saveSettings()
  }

  async createNewPlanFile() {
    try { await this.obsApp.vault.createFolder('planning') } catch { /* folder may already exist */ }
    try { await this.obsApp.vault.createFolder('planning/briefs') } catch { /* folder may already exist */ }

    const defaultBoard: PlanBoard = {
      title: 'Sprint 1',
      columns: ['Todo', 'In Progress', 'Review', 'Done'],
      tasks: [],
    }
    const content = serializePlanFile(defaultBoard)
    const filePath = 'planning/sprint.plan.md'
    const file = this.obsApp.vault.getAbstractFileByPath(filePath)
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
        if (dir) {
          try { await this.obsApp.vault.createFolder(dir) } catch { /* folder may already exist */ }
        }
        const existing = this.obsApp.vault.getAbstractFileByPath(path)
        if (!existing) await this.obsApp.vault.create(path, content)
      } catch {
        // Ignore convention-file write errors to keep plan creation non-blocking.
      }
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
    if (!clickupToken) {
      new Notice('⚙️ Configure ClickUp token in Settings → Arch Visualizer.')
      return
    }

    let resolvedListId = clickupListId || this.board.tasks.find(t => t.clickupListId)?.clickupListId
    if (!resolvedListId) {
      const anyMappedTaskId = this.board.tasks.find(t => t.clickupId)?.clickupId
      if (anyMappedTaskId) {
        const discoverSvc = new ClickUpSyncService(clickupToken, undefined, this.obsApp.vault)
        resolvedListId = await discoverSvc.inferListIdFromTask(anyMappedTaskId)
      }
    }

    if (!clickupListId && resolvedListId) {
      this.plugin.settings.clickupListId = resolvedListId
      await this.plugin.saveSettings()
    }

    new Notice('🔄 Syncing with ClickUp...')
    const svc = new ClickUpSyncService(clickupToken, resolvedListId, this.obsApp.vault)
    try {
      const { board, added, updated, removed, briefs, errors } = await svc.pullFromClickUp(this.board)
      if (errors.length) {
        new Notice(`❌ Sync failed: ${errors[0]}`)
        return
      }
      this.board = board
      this.normalizeBoardIntegrity()
      await this.writeToDisk()
      this.render()
      new Notice(`✅ ClickUp sync done: +${added} new, ~${updated} updated, -${removed} removed, ${briefs} briefs written.`)
    } catch (e) {
      new Notice(`❌ Sync failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async syncUpClickUp() {
    if (!this.board) { new Notice('No plan loaded.'); return }
    const { clickupToken, clickupListId } = this.plugin.settings
    if (!clickupToken) {
      new Notice('⚙️ Configure ClickUp token in Settings → Arch Visualizer.')
      return
    }

    let resolvedListId = clickupListId || this.board.tasks.find(t => t.clickupListId)?.clickupListId
    if (!resolvedListId) {
      const anyMappedTaskId = this.board.tasks.find(t => t.clickupId)?.clickupId
      if (anyMappedTaskId) {
        const discoverSvc = new ClickUpSyncService(clickupToken, undefined, this.obsApp.vault)
        resolvedListId = await discoverSvc.inferListIdFromTask(anyMappedTaskId)
      }
    }

    if (!clickupListId && resolvedListId) {
      this.plugin.settings.clickupListId = resolvedListId
      await this.plugin.saveSettings()
    }

    const hasMappedTask = this.board.tasks.some(t => Boolean(t.clickupId))
    if (!resolvedListId && !hasMappedTask) {
      new Notice('❌ Sync Up aborted: missing ClickUp List ID. Configure clickupListId in settings or sync down once to map list.')
      return
    }

    const total = this.board.tasks.length
    if (total === 0) {
      new Notice('No tickets to sync.')
      return
    }

    new Notice(`⬆️ Sync Up ${total} tickets to ClickUp...`)
    const svc = new ClickUpSyncService(clickupToken, resolvedListId, this.obsApp.vault)
    try {
      const { created, updated, failed, commentsSynced, errorSamples } = await svc.pushAllTasksToClickUp(this.board.tasks)
      await this.writeToDisk()
      this.render()
      const msg = `✅ Sync Up done: +${created} created, ~${updated} updated, ${commentsSynced} comments synced, ${failed} failed.`
      if (failed > 0 && errorSamples.length > 0) {
        new Notice(`${msg}\nFirst error: ${errorSamples[0]}`, 12000)
      } else {
        new Notice(msg)
      }
    } catch (e) {
      new Notice(`❌ Sync Up failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async generateReworkPrompt(task: TaskCard) {
    try { await this.obsApp.vault.createFolder('rework') } catch { /* folder may already exist */ }
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

    new Notice(`🔄 Rework prompt saved: rework/${task.id}.rework.md`, 8000)
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
    const syncDownBtn = headerRight.createEl('button', {
      cls: 'av-header-btn av-sync-btn',
      text: '⬇ Sync Down',
      attr: { title: 'Pull tickets from ClickUp' }
    })
    syncDownBtn.addEventListener('click', () => void this.syncClickUp())
    const syncUpBtn = headerRight.createEl('button', {
      cls: 'av-header-btn av-sync-btn',
      text: '⬆ Sync Up',
      attr: { title: 'Push all board tickets to ClickUp' }
    })
    syncUpBtn.addEventListener('click', () => void this.syncUpClickUp())

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
    this.synchronizeFeatureRelations()

    const PAD_TOP = 36
    const PAD_LEFT = 24
    const PAD_RIGHT = 24
    const PAD_BOTTOM = 24
    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(n, max))

    // Group tasks per column
    const grouped: Map<string, TaskCard[]> = new Map()
    for (const col of this.board.columns) grouped.set(col, [])
    for (const task of this.board.tasks) {
      const arr = grouped.get(task.column)
      if (arr) arr.push(task)
      else grouped.set(task.column, [task])
    }

    const nodeSize: Record<string, number> = {}
    for (const task of this.board.tasks) {
      const textLength = `${task.title} ${task.description || ''} ${task.assignee || ''}`.trim().length
      const density = Math.ceil(textLength / 28)
      nodeSize[task.id] = clamp(76 + density * 6, 82, 126)
    }

    const totalCols = this.board.columns.length
    const viewportW = Math.max(container.clientWidth - 20, 980)
    const viewportH = Math.max(container.clientHeight - 56, 640)
    const canvasW = Math.max(viewportW, PAD_LEFT + PAD_RIGHT + totalCols * 220)

    const ROW_GAP = 24
    let requiredCanvasH = viewportH
    for (const col of this.board.columns) {
      const tasks = grouped.get(col) || []
      let cursor = PAD_TOP
      for (const task of tasks) {
        const size = nodeSize[task.id] || 96
        cursor += size + ROW_GAP
      }
      requiredCanvasH = Math.max(requiredCanvasH, cursor + PAD_BOTTOM)
    }
    const canvasH = Math.max(viewportH, requiredCanvasH)

    const pos: Record<string, { x: number; y: number }> = {}
    const colSpan = Math.max(canvasW - PAD_LEFT - PAD_RIGHT, 1)
    for (let i = 0; i < this.board.columns.length; i++) {
      const col = this.board.columns[i]
      const tasks = grouped.get(col) || []
      const colCenterX = this.board.columns.length === 1
        ? canvasW / 2
        : PAD_LEFT + (colSpan * i) / (this.board.columns.length - 1)

      let cursorY = PAD_TOP
      tasks.forEach((task, rowIdx) => {
        const size = nodeSize[task.id] || 96
        const y = cursorY + size / 2
        const jitterX = ((rowIdx % 2) * 2 - 1) * 16
        pos[task.id] = { x: colCenterX, y }
        pos[task.id].x = clamp(colCenterX + jitterX, PAD_LEFT + 90, canvasW - PAD_RIGHT - 90)
        cursorY += size + ROW_GAP
      })
    }

    // Prevent heavy overlap by applying a lightweight collision relaxation pass.
    const taskIds = this.board.tasks.map(t => t.id)
    for (let iter = 0; iter < 120; iter++) {
      let moved = false
      for (let i = 0; i < taskIds.length; i++) {
        for (let j = i + 1; j < taskIds.length; j++) {
          const aId = taskIds[i]
          const bId = taskIds[j]
          const a = pos[aId]
          const b = pos[bId]
          if (!a || !b) continue
          const ra = (nodeSize[aId] || 220) / 2
          const rb = (nodeSize[bId] || 220) / 2
          const minDist = ra + rb + 18
          const dx = b.x - a.x
          const dy = b.y - a.y
          const dist = Math.hypot(dx, dy) || 0.001
          if (dist >= minDist) continue
          const push = (minDist - dist) / 2
          const ux = dx / dist
          const uy = dy / dist

          a.x -= ux * push
          a.y -= uy * push
          b.x += ux * push
          b.y += uy * push

          const aPad = (nodeSize[aId] || 220) / 2
          const bPad = (nodeSize[bId] || 220) / 2
          a.x = clamp(a.x, PAD_LEFT + aPad, canvasW - PAD_RIGHT - aPad)
          a.y = clamp(a.y, PAD_TOP + aPad, canvasH - PAD_BOTTOM - aPad)
          b.x = clamp(b.x, PAD_LEFT + bPad, canvasW - PAD_RIGHT - bPad)
          b.y = clamp(b.y, PAD_TOP + bPad, canvasH - PAD_BOTTOM - bPad)
          moved = true
        }
      }
      if (!moved) break
    }

    const wrapper = container.createDiv({ cls: 'av-graph-wrapper av-graph-minimal' })
    const viewport = wrapper.createDiv({ cls: 'av-graph-viewport' })

    const canvas = viewport.createDiv({ cls: 'av-graph-canvas' })
    canvas.style.width = `${canvasW}px`
    canvas.style.height = `${canvasH}px`
    canvas.style.transformOrigin = '0 0'

    const stored = this.getGraphMemory()
    if (stored?.pinnedNodeId) this.lastPinnedNodeId = stored.pinnedNodeId
    if (stored?.pinnedTooltipNodeId) this.lastPinnedTooltipNodeId = stored.pinnedTooltipNodeId
    const viewState = {
      scale: stored?.scale ?? 1,
      tx: stored?.tx ?? 0,
      ty: stored?.ty ?? 0,
      isPanning: false,
      panStartX: 0,
      panStartY: 0,
      startTx: 0,
      startTy: 0,
    }

    const clampView = () => {
      const vw = viewport.clientWidth || 1
      const vh = viewport.clientHeight || 1
      const scaledW = canvasW * viewState.scale
      const scaledH = canvasH * viewState.scale
      const minTx = Math.min(0, vw - scaledW - 20)
      const minTy = Math.min(0, vh - scaledH - 20)
      const maxTx = Math.max(20, vw - scaledW + 20)
      const maxTy = Math.max(20, vh - scaledH + 20)
      viewState.tx = Math.max(minTx, Math.min(maxTx, viewState.tx))
      viewState.ty = Math.max(minTy, Math.min(maxTy, viewState.ty))
    }

    const applyViewTransform = () => {
      clampView()
      canvas.style.transform = `translate(${viewState.tx}px, ${viewState.ty}px) scale(${viewState.scale})`
    }

    const centerOnNode = (taskId: string | null, animate = true) => {
      if (!taskId) return
      const p = pos[taskId]
      if (!p) return
      const targetTx = viewport.clientWidth / 2 - p.x * viewState.scale
      const targetTy = viewport.clientHeight / 2 - p.y * viewState.scale
      viewState.tx = targetTx
      viewState.ty = targetTy
      canvas.style.transition = animate ? 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1)' : ''
      applyViewTransform()
      if (animate) setTimeout(() => { canvas.style.transition = '' }, 420)
    }

    viewport.addEventListener('wheel', (ev: WheelEvent) => {
      ev.preventDefault()
      const rect = viewport.getBoundingClientRect()
      const px = ev.clientX - rect.left
      const py = ev.clientY - rect.top
      const beforeX = (px - viewState.tx) / viewState.scale
      const beforeY = (py - viewState.ty) / viewState.scale
      const zoomFactor = ev.deltaY < 0 ? 1.12 : 0.89
      viewState.scale = clamp(viewState.scale * zoomFactor, 0.35, 2.8)
      viewState.tx = px - beforeX * viewState.scale
      viewState.ty = py - beforeY * viewState.scale
      applyViewTransform()
      void this.saveGraphMemory({
        scale: viewState.scale,
        tx: viewState.tx,
        ty: viewState.ty,
        pinnedNodeId: pinnedNodeId || undefined,
        pinnedTooltipNodeId: this.lastPinnedTooltipNodeId || undefined,
      })
    }, { passive: false })

    viewport.addEventListener('pointerdown', (ev: PointerEvent) => {
      const target = ev.target as HTMLElement
      if (target.closest('.av-graph-node')) return
      viewState.isPanning = true
      viewState.panStartX = ev.clientX
      viewState.panStartY = ev.clientY
      viewState.startTx = viewState.tx
      viewState.startTy = viewState.ty
      viewport.classList.add('is-panning')
      viewport.setPointerCapture(ev.pointerId)
    })

    viewport.addEventListener('pointermove', (ev: PointerEvent) => {
      if (!viewState.isPanning) return
      viewState.tx = viewState.startTx + (ev.clientX - viewState.panStartX)
      viewState.ty = viewState.startTy + (ev.clientY - viewState.panStartY)
      applyViewTransform()
    })

    viewport.addEventListener('pointerup', (ev: PointerEvent) => {
      if (!viewState.isPanning) return
      viewState.isPanning = false
      viewport.classList.remove('is-panning')
      if (viewport.hasPointerCapture(ev.pointerId)) viewport.releasePointerCapture(ev.pointerId)
      void this.saveGraphMemory({
        scale: viewState.scale,
        tx: viewState.tx,
        ty: viewState.ty,
        pinnedNodeId: pinnedNodeId || undefined,
        pinnedTooltipNodeId: this.lastPinnedTooltipNodeId || undefined,
      })
    })

    viewport.addEventListener('dblclick', () => {
      viewState.scale = 1
      viewState.tx = 0
      viewState.ty = 0
      applyViewTransform()
    })

    // SVG edge layer
    const svgNS = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(svgNS, 'svg')
    svg.setAttribute('class', 'av-graph-svg')
    svg.setAttribute('width', String(canvasW))
    svg.setAttribute('height', String(canvasH))
    svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;overflow:visible;'

    // Arrowhead marker
    const defs = document.createElementNS(svgNS, 'defs')
    const glow = document.createElementNS(svgNS, 'filter')
    glow.setAttribute('id', 'av-edge-glow')
    const blur = document.createElementNS(svgNS, 'feGaussianBlur')
    blur.setAttribute('stdDeviation', '1.8')
    blur.setAttribute('result', 'coloredBlur')
    glow.appendChild(blur)
    defs.appendChild(glow)

    const marker = document.createElementNS(svgNS, 'marker')
    marker.setAttribute('id', 'av-arrow')
    marker.setAttribute('markerWidth', '9')
    marker.setAttribute('markerHeight', '7')
    marker.setAttribute('refX', '9')
    marker.setAttribute('refY', '3.5')
    marker.setAttribute('orient', 'auto')
    const poly = document.createElementNS(svgNS, 'polygon')
    poly.setAttribute('points', '0 0, 9 3.5, 0 7')
    poly.setAttribute('fill', 'rgba(203, 231, 255, 0.82)')
    marker.appendChild(poly)
    defs.appendChild(marker)
    svg.appendChild(defs)

    const edgeLayer = document.createElementNS(svgNS, 'g')
    svg.appendChild(edgeLayer)
    const nodeById = new Map<string, HTMLElement>()
    let focusNodeId: string | null = this.lastPinnedNodeId
    let pinnedNodeId: string | null = this.lastPinnedNodeId

    const edges: Array<{ fromId: string; toId: string }> = []
    for (const task of this.board.tasks) {
      for (const depId of (task.depends || [])) edges.push({ fromId: depId, toId: task.id })
    }

    // If no explicit dependencies exist, infer lightweight flow links across adjacent columns.
    if (edges.length === 0) {
      for (let i = 0; i < this.board.columns.length - 1; i++) {
        const fromTasks = grouped.get(this.board.columns[i]) || []
        const toTasks = grouped.get(this.board.columns[i + 1]) || []
        const count = Math.min(fromTasks.length, toTasks.length)
        for (let j = 0; j < count; j++) {
          edges.push({ fromId: fromTasks[j].id, toId: toTasks[j].id })
        }
      }
      if (edges.length === 0 && this.board.tasks.length > 1) {
        for (let i = 0; i < this.board.tasks.length - 1; i++) {
          edges.push({ fromId: this.board.tasks[i].id, toId: this.board.tasks[i + 1].id })
        }
      }
    }

    const redrawEdges = () => {
      edgeLayer.replaceChildren()
      for (const edge of edges) {
        const from = pos[edge.fromId]
        const to = pos[edge.toId]
        if (!from || !to) continue
        const x1 = from.x
        const y1 = from.y
        const x2 = to.x
        const y2 = to.y
        const cx = (x1 + x2) / 2
        const cy = (y1 + y2) / 2 - (Math.abs(x1 - x2) > 80 ? 24 : 10)

        const glowPath = document.createElementNS(svgNS, 'path')
        glowPath.setAttribute('d', `M ${x1} ${y1} Q ${cx} ${cy}, ${x2} ${y2}`)
        glowPath.setAttribute('stroke', 'rgba(180,230,255,0.28)')
        glowPath.setAttribute('stroke-width', '3')
        glowPath.setAttribute('fill', 'none')
        glowPath.setAttribute('filter', 'url(#av-edge-glow)')
        glowPath.setAttribute('class', 'av-graph-edge av-graph-edge-glow')
        edgeLayer.appendChild(glowPath)

        const path = document.createElementNS(svgNS, 'path')
        path.setAttribute('d', `M ${x1} ${y1} Q ${cx} ${cy}, ${x2} ${y2}`)
        path.setAttribute('stroke', 'rgba(164, 178, 201, 0.45)')
        path.setAttribute('stroke-width', '1')
        path.setAttribute('fill', 'none')
        path.setAttribute('marker-end', 'url(#av-arrow)')
        path.setAttribute('class', 'av-graph-edge av-graph-edge-line')

        const isRelated = !!focusNodeId && (edge.fromId === focusNodeId || edge.toId === focusNodeId)
        if (focusNodeId) {
          path.classList.toggle('is-active', isRelated)
          glowPath.classList.toggle('is-active', isRelated)
          path.classList.toggle('is-muted', !isRelated)
          glowPath.classList.toggle('is-muted', !isRelated)
        }

        edgeLayer.appendChild(path)
      }
    }

    const refreshNodeFocus = () => {
      nodeById.forEach((nodeEl, taskId) => {
        const active = !!focusNodeId && taskId === focusNodeId
        const related = !!focusNodeId && edges.some(e => (e.fromId === focusNodeId && e.toId === taskId) || (e.toId === focusNodeId && e.fromId === taskId))
        nodeEl.classList.toggle('is-focus', active)
        nodeEl.classList.toggle('is-related', related)
        nodeEl.classList.toggle('is-muted', !!focusNodeId && !active && !related)
      })
    }

    const applyFocus = (nodeId: string | null, opts?: { center?: boolean }) => {
      focusNodeId = nodeId
      redrawEdges()
      refreshNodeFocus()
      if (nodeId && opts?.center) centerOnNode(nodeId)
      this.lastPinnedNodeId = pinnedNodeId
      void this.saveGraphMemory({
        scale: viewState.scale,
        tx: viewState.tx,
        ty: viewState.ty,
        pinnedNodeId: pinnedNodeId || undefined,
        pinnedTooltipNodeId: this.lastPinnedTooltipNodeId || undefined,
      })
    }

    redrawEdges()
    canvas.appendChild(svg)

    // Task nodes
    for (const task of this.board.tasks) {
      const p = pos[task.id]
      if (!p) continue
      const colColor = COLUMN_COLORS[task.column.toLowerCase()] || '#9e9e9e'
      const size = nodeSize[task.id] || 160

      const node = canvas.createDiv({ cls: 'av-graph-node av-graph-node-circle av-graph-node-mini' })
      node.style.cssText = `position:absolute;left:${p.x - size / 2}px;top:${p.y - size / 2}px;width:${size}px;height:${size}px;`
      node.style.setProperty('--col-color', colColor)
      node.style.setProperty('--node-accent', `${colColor}66`)
      node.style.setProperty('--node-fill', `${colColor}22`)
      node.style.setProperty('--node-border', `${colColor}99`)
      node.style.setProperty('--node-ring', `${colColor}33`)
      nodeById.set(task.id, node)

      const inner = node.createDiv({ cls: 'av-graph-node-inner av-graph-node-glass' })
      inner.style.borderRadius = '999px'

      const info = inner.createDiv({ cls: 'av-graph-node-info' })
      info.createEl('div', { cls: 'av-graph-node-idonly', text: task.id })
      info.createEl('div', { cls: 'av-graph-node-title', text: task.title })

      const details = node.createDiv({ cls: 'av-graph-node-tooltip' })
      if (p.x > canvasW * 0.62) details.addClass('av-graph-node-tooltip-left')
      if (this.lastPinnedTooltipNodeId === task.id) node.addClass('is-tooltip-pinned')
      details.createEl('div', { cls: 'av-graph-tooltip-title', text: `${task.id} — ${task.title}` })
      const fields = details.createDiv({ cls: 'av-graph-tooltip-fields' })
      const addField = (label: string, value?: string) => {
        const row = fields.createDiv({ cls: 'av-graph-tooltip-row' })
        row.createEl('span', { cls: 'av-graph-tooltip-key', text: label })
        row.createEl('span', { cls: 'av-graph-tooltip-value', text: value && value.trim() ? value : '-' })
      }

      addField('Column', task.column)
      addField('Priority', task.priority)
      addField('Assignee', task.assignee)
      addField('Deadline', task.deadline)
      addField('Depends On', (task.depends || []).join(', '))
      const depOf = this.board.tasks.filter(t => (t.depends || []).includes(task.id)).length
      addField('Blocked By Count', String(depOf))
      addField('Subtasks', `${task.subtasks.filter(s => s.done).length}/${task.subtasks.length}`)
      addField('Comments', String(task.comments?.length || 0))
      addField('Output', task.output)
      addField('ClickUp ID', task.clickupId)

      const descBlock = details.createDiv({ cls: 'av-graph-tooltip-desc' })
      descBlock.createEl('div', { cls: 'av-graph-tooltip-key', text: 'Description' })
      descBlock.createEl('div', { cls: 'av-graph-tooltip-value av-graph-tooltip-pre', text: task.description || '-' })

      const dragState = { moved: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0 }
      node.addEventListener('pointerdown', (ev: PointerEvent) => {
        ev.preventDefault()
        dragState.moved = false
        dragState.startX = ev.clientX
        dragState.startY = ev.clientY
        dragState.offsetX = ev.clientX - (p.x - size / 2)
        dragState.offsetY = ev.clientY - (p.y - size / 2)
        node.classList.add('av-graph-node-dragging')
        node.setPointerCapture(ev.pointerId)
        if (!pinnedNodeId) applyFocus(task.id)
      })

      node.addEventListener('mouseenter', () => {
        if (!pinnedNodeId) applyFocus(task.id)
      })

      node.addEventListener('mouseleave', () => {
        if (!pinnedNodeId) applyFocus(null)
      })

      details.addEventListener('mouseenter', () => {
        node.classList.add('is-tooltip-pinned')
        this.lastPinnedTooltipNodeId = task.id
      })

      details.addEventListener('mouseleave', () => {
        if (this.lastPinnedTooltipNodeId === task.id) {
          node.classList.remove('is-tooltip-pinned')
          this.lastPinnedTooltipNodeId = null
          void this.saveGraphMemory({
            scale: viewState.scale,
            tx: viewState.tx,
            ty: viewState.ty,
            pinnedNodeId: pinnedNodeId || undefined,
            pinnedTooltipNodeId: undefined,
          })
        }
      })

      node.addEventListener('pointermove', (ev: PointerEvent) => {
        if (!node.hasPointerCapture(ev.pointerId)) return
        const nextX = ev.clientX - dragState.offsetX
        const nextY = ev.clientY - dragState.offsetY
        if (Math.abs(ev.clientX - dragState.startX) > 3 || Math.abs(ev.clientY - dragState.startY) > 3) {
          dragState.moved = true
        }
        const left = Math.max(0, Math.min(nextX, canvasW - size))
        const top = Math.max(0, Math.min(nextY, canvasH - size))
        p.x = left + size / 2
        p.y = top + size / 2
        node.style.left = `${left}px`
        node.style.top = `${top}px`
        redrawEdges()
      })

      node.addEventListener('pointerup', (ev: PointerEvent) => {
        if (node.hasPointerCapture(ev.pointerId)) node.releasePointerCapture(ev.pointerId)
        node.classList.remove('av-graph-node-dragging')
        if (!dragState.moved) {
          pinnedNodeId = pinnedNodeId === task.id ? null : task.id
          applyFocus(pinnedNodeId, { center: !!pinnedNodeId })
          void this.openEditTask(task)
        }
        void this.saveGraphMemory({
          scale: viewState.scale,
          tx: viewState.tx,
          ty: viewState.ty,
          pinnedNodeId: pinnedNodeId || undefined,
          pinnedTooltipNodeId: this.lastPinnedTooltipNodeId || undefined,
        })
      })
    }

    applyFocus(pinnedNodeId, { center: !!pinnedNodeId })
    applyViewTransform()

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
    try { await this.obsApp.vault.createFolder('planning/briefs') } catch { /* folder may already exist */ }
    const brief = `# ${task.title}\n\n## Context\n\n\n## Expected Output\n\n\n## Acceptance Criteria\n- [ ] \n\n## Technical Notes\n\n\n## Rules & Format\n\n`
    try { await this.obsApp.vault.create(briefPath, brief) } catch { /* file may already exist */ }
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
    try { await this.obsApp.vault.createFolder('planning/briefs') } catch { /* folder may already exist */ }
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
    let target: TFile
    const rememberedPath = this.plugin.settings.lastPlanFilePath?.trim()
    if (rememberedPath) {
      const remembered = this.obsApp.vault.getAbstractFileByPath(rememberedPath)
      if (remembered instanceof TFile && remembered.path.endsWith('.plan.md')) {
        target = remembered
      } else {
        files.sort((a, b) => b.stat.mtime - a.stat.mtime)
        target = files[0]
      }
    } else {
      files.sort((a, b) => b.stat.mtime - a.stat.mtime)
      target = files[0]
    }
    await this.loadFile(target)
  }
}

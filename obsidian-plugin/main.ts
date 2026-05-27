import { App, FileSystemAdapter, ItemView, Notice, Plugin, WorkspaceLeaf } from 'obsidian'
import * as fs from 'fs'
import * as path from 'path'

const VIEW_TYPE = 'arch-visualizer'

// ── Type mirrors ───────────────────────────────────────────────────────────
interface Subtask { text: string; done: boolean }
interface BriefContent {
  context: string; expectedOutput: string; acceptanceCriteria: string
  technicalNotes: string; rulesFormat: string
}
interface TaskCard {
  id: string; title: string; description: string; milestone?: string
  deadline?: string; priority: 'high' | 'medium' | 'low'; column: string
  assignee?: string; depends?: string[]; subtasks: Subtask[]; output?: string
}
interface PlanBoard { title: string; columns: string[]; tasks: TaskCard[] }
type Action = { type: string } & Record<string, unknown>

// ── Obsidian ItemView ──────────────────────────────────────────────────────
class ArchVisualizerView extends ItemView {
  private iframe: HTMLIFrameElement | null = null
  private planFilePath: string | null = null
  private messageHandler: ((e: MessageEvent) => void) | null = null

  constructor(leaf: WorkspaceLeaf, private plugin: ArchVisualizerPlugin) {
    super(leaf)
  }

  getViewType(): string { return VIEW_TYPE }
  getDisplayText(): string { return 'Arch Visualizer' }
  getIcon(): string { return 'layout-dashboard' }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement
    container.empty()
    container.style.cssText = 'padding:0;overflow:hidden;height:100%;'

    const adapter = this.app.vault.adapter
    if (!(adapter instanceof FileSystemAdapter)) {
      container.innerHTML = this.errorHtml('Arch Visualizer requires the desktop app (FileSystemAdapter).')
      return
    }

    const basePath = adapter.getBasePath()
    const webviewIndex = path.join(
      basePath, '.obsidian', 'plugins', this.plugin.manifest.id, 'webview', 'index.html',
    )

    if (!fs.existsSync(webviewIndex)) {
      container.innerHTML = this.errorHtml(
        'Webview assets not found. Make sure to use the full release build that includes the <code>webview/</code> folder.',
      )
      return
    }

    this.planFilePath = path.join(basePath, 'arch-plan.json')

    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'width:100%;height:100%;border:none;background:#0a0a0f;display:block;'

    // file:// path (works in Electron)
    const fileUrl = 'file://' + (process.platform === 'win32'
      ? '/' + webviewIndex.replace(/\\/g, '/')
      : webviewIndex)
    iframe.src = fileUrl

    this.messageHandler = (e: MessageEvent) => void this.handleMessage(e, iframe)
    window.addEventListener('message', this.messageHandler)

    iframe.onload = () => this.autoLoadPlan(iframe)

    container.appendChild(iframe)
    this.iframe = iframe
  }

  async onClose(): Promise<void> {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler)
      this.messageHandler = null
    }
    this.iframe = null
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  private autoLoadPlan(iframe: HTMLIFrameElement): void {
    if (!this.planFilePath) return
    if (fs.existsSync(this.planFilePath)) {
      try {
        const board = JSON.parse(fs.readFileSync(this.planFilePath, 'utf8')) as PlanBoard
        iframe.contentWindow?.postMessage(
          { type: 'loadBoard', board, filePath: this.planFilePath }, '*',
        )
      } catch { /* silently skip malformed JSON */ }
    } else {
      iframe.contentWindow?.postMessage({ type: 'noFile' }, '*')
    }
  }

  private async handleMessage(event: MessageEvent, iframe: HTMLIFrameElement): Promise<void> {
    if (event.source !== iframe.contentWindow) return
    const msg = event.data as Action

    switch (msg.type) {
      case 'ready':
        this.autoLoadPlan(iframe)
        break

      case 'openPlanFile':
        this.autoLoadPlan(iframe)
        break

      case 'createPlanFile': {
        if (!this.planFilePath) break
        const board: PlanBoard = {
          title: 'Sprint 1',
          columns: ['Todo', 'In Progress', 'Review', 'Done'],
          tasks: [],
        }
        this.writeJson(this.planFilePath, board)
        iframe.contentWindow?.postMessage(
          { type: 'loadBoard', board, filePath: this.planFilePath }, '*',
        )
        new Notice('arch-plan.json created in vault root')
        break
      }

      case 'loadBrief': {
        const basePath = (this.app.vault.adapter as FileSystemAdapter).getBasePath()
        const brief = this.readBrief(basePath, msg.taskId as string)
        iframe.contentWindow?.postMessage({ type: 'briefLoaded', taskId: msg.taskId, brief }, '*')
        break
      }

      case 'saveBrief': {
        const basePath = (this.app.vault.adapter as FileSystemAdapter).getBasePath()
        this.saveBrief(basePath, msg.taskId as string, msg.brief as BriefContent)
        break
      }

      default:
        if (this.planFilePath && fs.existsSync(this.planFilePath)) {
          try {
            const board = JSON.parse(fs.readFileSync(this.planFilePath, 'utf8')) as PlanBoard
            const updated = mutate(board, msg)
            this.writeJson(this.planFilePath, updated)
            iframe.contentWindow?.postMessage({ type: 'boardUpdated', board: updated }, '*')
          } catch (err) {
            iframe.contentWindow?.postMessage({ type: 'error', message: String(err) }, '*')
          }
        }
        break
    }
  }

  private writeJson(filePath: string, data: unknown): void {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
  }

  private readBrief(root: string, taskId: string): BriefContent | null {
    const p = path.join(root, '.obsidian', 'plugins', this.plugin.manifest.id, 'briefs', `${taskId}.json`)
    if (!fs.existsSync(p)) return null
    try { return JSON.parse(fs.readFileSync(p, 'utf8')) as BriefContent } catch { return null }
  }

  private saveBrief(root: string, taskId: string, brief: BriefContent): void {
    const dir = path.join(root, '.obsidian', 'plugins', this.plugin.manifest.id, 'briefs')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    this.writeJson(path.join(dir, `${taskId}.json`), brief)
  }

  private errorHtml(msg: string): string {
    return `<div style="padding:24px;font-family:system-ui;background:#0a0a0f;color:#e2e8f0;height:100%;">
      <h2 style="color:#f87171">Arch Visualizer</h2>
      <p>${msg}</p>
    </div>`
  }
}

// ── Plugin entry point ─────────────────────────────────────────────────────
export default class ArchVisualizerPlugin extends Plugin {
  async onload(): Promise<void> {
    this.registerView(VIEW_TYPE, (leaf) => new ArchVisualizerView(leaf, this))

    this.addRibbonIcon('layout-dashboard', 'Arch Visualizer', () => void this.activateView())

    this.addCommand({
      id: 'open-arch-visualizer',
      name: 'Open Arch Visualizer',
      callback: () => void this.activateView(),
    })
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0]
    if (!leaf) {
      leaf = workspace.getLeaf('tab')
      await leaf.setViewState({ type: VIEW_TYPE, active: true })
    }
    workspace.revealLeaf(leaf)
  }

  onunload(): void {}
}

// ── Board mutation (pure, mirrors extension.ts) ────────────────────────────
function mutate(board: PlanBoard, action: Action): PlanBoard {
  switch (action.type) {
    case 'moveTask': {
      const taskId = action.taskId as string
      const toColumn = action.toColumn as string
      const insertIndex = action.insertIndex as number
      const task = board.tasks.find((t) => t.id === taskId)
      if (!task) return board
      const moved = { ...task, column: toColumn }
      const colTasks = board.tasks.filter((t) => t.column === toColumn && t.id !== taskId)
      const others = board.tasks.filter((t) => t.column !== toColumn && t.id !== taskId)
      colTasks.splice(insertIndex, 0, moved)
      return { ...board, tasks: reorderByColumns(board.columns, [...others, ...colTasks]) }
    }
    case 'reorderTask': {
      const taskId = action.taskId as string
      const insertIndex = action.insertIndex as number
      const task = board.tasks.find((t) => t.id === taskId)
      if (!task) return board
      const colTasks = board.tasks.filter((t) => t.column === task.column && t.id !== taskId)
      const others = board.tasks.filter((t) => t.column !== task.column)
      colTasks.splice(insertIndex, 0, task)
      return { ...board, tasks: reorderByColumns(board.columns, [...others, ...colTasks]) }
    }
    case 'createTask': {
      const taskData = action.task as Omit<TaskCard, 'id'>
      const newId = nextTaskId(board.tasks)
      return {
        ...board,
        tasks: [...board.tasks, {
          id: newId, ...taskData,
          output: `.obsidian/plugins/arch-visualizer/briefs/${newId}.json`,
        }],
      }
    }
    case 'updateTask': {
      const updated = action.task as TaskCard
      return { ...board, tasks: board.tasks.map((t) => (t.id === updated.id ? updated : t)) }
    }
    case 'deleteTask':
      return { ...board, tasks: board.tasks.filter((t) => t.id !== (action.taskId as string)) }
    case 'toggleSubtask': {
      const taskId = action.taskId as string
      const idx = action.subtaskIndex as number
      return {
        ...board,
        tasks: board.tasks.map((t) => {
          if (t.id !== taskId || !t.subtasks[idx]) return t
          const subtasks = [...t.subtasks]
          subtasks[idx] = { ...subtasks[idx], done: !subtasks[idx].done }
          return { ...t, subtasks }
        }),
      }
    }
    default:
      return board
  }
}

function reorderByColumns(columns: string[], tasks: TaskCard[]): TaskCard[] {
  const result: TaskCard[] = []
  for (const col of columns) result.push(...tasks.filter((t) => t.column === col))
  return result
}

function nextTaskId(tasks: TaskCard[]): string {
  let max = 0
  for (const t of tasks) {
    const m = /^task-(\d+)$/.exec(t.id)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `task-${max + 1}`
}

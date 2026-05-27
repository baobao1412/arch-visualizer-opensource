import { FileSystemAdapter, ItemView, Notice, Plugin, WorkspaceLeaf } from 'obsidian'
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
  private planFilePath: string | null = null
  private bridgeReceiver: ((msg: unknown) => void) | null = null
  private mountedStyleEl: HTMLStyleElement | null = null
  private mountedScriptEl: HTMLScriptElement | null = null
  private mountedRootEl: HTMLDivElement | null = null

  constructor(leaf: WorkspaceLeaf, private plugin: ArchVisualizerPlugin) {
    super(leaf)
  }

  getViewType(): string { return VIEW_TYPE }
  getDisplayText(): string { return 'Arch Visualizer' }
  getIcon(): string { return 'layout-dashboard' }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement
    container.empty()
    container.style.cssText = 'padding:0;overflow:hidden;height:100%;position:relative;'

    const adapter = this.app.vault.adapter
    if (!(adapter instanceof FileSystemAdapter)) {
      container.innerHTML = this.errorHtml('Arch Visualizer requires the desktop app.')
      return
    }

    const basePath = adapter.getBasePath()
    const pluginDir = path.join(basePath, '.obsidian', 'plugins', this.plugin.manifest.id)
    const webviewDir = path.join(pluginDir, 'webview')
    const jsFile = path.join(webviewDir, 'app.js')
    const cssFile = path.join(webviewDir, 'app.css')

    if (!fs.existsSync(jsFile)) {
      container.innerHTML = this.errorHtml('Webview assets not found (<code>webview/app.js</code>).')
      return
    }

    this.planFilePath = path.join(basePath, 'arch-plan.json')

    // ── Install bridge on window so React app can communicate ──────────────
    const bridge = {
      send: (msg: unknown) => void this.handleFromApp(msg as Action),
      setReceiver: (fn: (msg: unknown) => void) => { this.bridgeReceiver = fn },
    };
    (window as Window & { __archVizBridge?: typeof bridge }).__archVizBridge = bridge

    // ── Mount CSS ──────────────────────────────────────────────────────────
    if (fs.existsSync(cssFile)) {
      const css = fs.readFileSync(cssFile, 'utf8')
      const style = document.createElement('style')
      style.setAttribute('data-arch-viz', 'true')
      style.textContent = css
      document.head.appendChild(style)
      this.mountedStyleEl = style
    }

    // ── Mount root div ─────────────────────────────────────────────────────
    const rootEl = document.createElement('div')
    rootEl.style.cssText = 'width:100%;height:100%;overflow:hidden;'
    container.appendChild(rootEl)
    this.mountedRootEl = rootEl

    // Tell React where to mount (must be set BEFORE the script runs)
    ;(window as Window & { __archVizContainer?: HTMLDivElement }).__archVizContainer = rootEl

    // ── Inject JS ─────────────────────────────────────────────────────────
    const js = fs.readFileSync(jsFile, 'utf8')
    const script = document.createElement('script')
    script.textContent = js
    document.body.appendChild(script)
    this.mountedScriptEl = script

    // Send initial plan after React mounts
    setTimeout(() => this.sendPlanToApp(), 400)
  }

  async onClose(): Promise<void> {
    // Remove injected elements
    this.mountedStyleEl?.remove()
    this.mountedScriptEl?.remove()
    this.mountedRootEl?.remove()
    this.mountedStyleEl = null
    this.mountedScriptEl = null
    this.mountedRootEl = null
    this.bridgeReceiver = null
    delete (window as Window & { __archVizBridge?: unknown }).__archVizBridge
    delete (window as Window & { __archVizContainer?: unknown }).__archVizContainer
  }

  // ── Send message into the React app ────────────────────────────────────
  private post(msg: unknown): void {
    this.bridgeReceiver?.(msg)
  }

  private sendPlanToApp(): void {
    if (!this.planFilePath) return
    if (fs.existsSync(this.planFilePath)) {
      try {
        const board = JSON.parse(fs.readFileSync(this.planFilePath, 'utf8')) as PlanBoard
        this.post({ type: 'loadBoard', board, filePath: this.planFilePath })
      } catch { /* skip malformed */ }
    } else {
      this.post({ type: 'noFile' })
    }
  }

  // ── Handle messages FROM the React app ────────────────────────────────
  private async handleFromApp(msg: Action): Promise<void> {
    const adapter = this.app.vault.adapter as FileSystemAdapter
    const basePath = adapter.getBasePath()

    switch (msg.type) {
      case 'ready':
        this.sendPlanToApp()
        break

      case 'openPlanFile':
        this.sendPlanToApp()
        break

      case 'createPlanFile': {
        if (!this.planFilePath) break
        const board: PlanBoard = {
          title: 'Sprint 1',
          columns: ['Todo', 'In Progress', 'Review', 'Done'],
          tasks: [],
        }
        this.writeJson(this.planFilePath, board)
        this.post({ type: 'loadBoard', board, filePath: this.planFilePath })
        new Notice('arch-plan.json created in vault root')
        break
      }

      case 'loadBrief': {
        const brief = this.readBrief(basePath, msg.taskId as string)
        this.post({ type: 'briefLoaded', taskId: msg.taskId, brief })
        break
      }

      case 'saveBrief':
        this.saveBrief(basePath, msg.taskId as string, msg.brief as BriefContent)
        break

      default:
        if (this.planFilePath && fs.existsSync(this.planFilePath)) {
          try {
            const board = JSON.parse(fs.readFileSync(this.planFilePath, 'utf8')) as PlanBoard
            const updated = mutate(board, msg)
            this.writeJson(this.planFilePath, updated)
            this.post({ type: 'boardUpdated', board: updated })
          } catch (err) {
            this.post({ type: 'error', message: String(err) })
          }
        }
        break
    }
  }

  // ── File helpers ──────────────────────────────────────────────────────
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
      <h2 style="color:#f87171">Arch Visualizer</h2><p>${msg}</p></div>`
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

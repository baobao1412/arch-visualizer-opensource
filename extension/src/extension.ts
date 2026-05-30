import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'

// ── Type mirrors from src/planning/types.ts ────────────────────────────────
interface Subtask {
  text: string
  done: boolean
}

interface BriefContent {
  context: string
  expectedOutput: string
  acceptanceCriteria: string
  technicalNotes: string
  rulesFormat: string
}

interface TaskCard {
  id: string
  title: string
  description: string
  milestone?: string
  deadline?: string
  priority: 'high' | 'medium' | 'low'
  column: string
  assignee?: string
  depends?: string[]
  subtasks: Subtask[]
  output?: string
}

interface PlanBoard {
  title: string
  columns: string[]
  tasks: TaskCard[]
}

type Action = { type: string } & Record<string, unknown>

// ── Webview panel manager ──────────────────────────────────────────────────
class ArchVisualizerPanel {
  private static instance: ArchVisualizerPanel | undefined
  private static readonly LAST_PLAN_PATH_KEY = 'archVisualizer.lastPlanFilePath'

  private planFilePath: string | null = null

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    private readonly context: vscode.ExtensionContext,
    subscriptions: vscode.Disposable[],
  ) {
    panel.webview.html = this.buildHtml()
    panel.webview.onDidReceiveMessage(
      (msg: unknown) => void this.onMessage(msg as Action),
      null,
      subscriptions,
    )
    panel.onDidDispose(() => {
      ArchVisualizerPanel.instance = undefined
    }, null, subscriptions)
  }

  static open(context: vscode.ExtensionContext): void {
    if (ArchVisualizerPanel.instance) {
      ArchVisualizerPanel.instance.panel.reveal(vscode.ViewColumn.One)
      return
    }

    const panel = vscode.window.createWebviewPanel(
      'archVisualizer',
      'Arch Visualizer',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'webview')],
        retainContextWhenHidden: true,
      },
    )

    ArchVisualizerPanel.instance = new ArchVisualizerPanel(
      panel,
      context.extensionUri,
      context,
      context.subscriptions,
    )
  }

  private buildHtml(): string {
    const webviewDir = vscode.Uri.joinPath(this.extensionUri, 'webview')
    const htmlPath = vscode.Uri.joinPath(webviewDir, 'index.html').fsPath

    if (!fs.existsSync(htmlPath)) {
      return notBuiltHtml()
    }

    let html = fs.readFileSync(htmlPath, 'utf8')

    // Remap relative asset paths to webview resource URIs
    const baseUri = this.panel.webview.asWebviewUri(webviewDir).toString()
    html = html.replace(/(src|href)="(\.\/[^"]+)"/g, (_match, attr: string, rel: string) => {
      return `${attr}="${baseUri}/${rel.slice(2)}"`
    })

    // Inject Content-Security-Policy
    const csp = buildCsp(this.panel.webview)
    html = html.replace(
      '<head>',
      `<head>\n  <meta http-equiv="Content-Security-Policy" content="${csp}">`,
    )

    return html
  }

  private post(msg: unknown): void {
    void this.panel.webview.postMessage(msg)
  }

  private async onMessage(msg: Action): Promise<void> {
    const root = workspaceRoot()

    switch (msg.type) {
      case 'ready':
        await this.autoLoad(root)
        break

      case 'openPlanFile': {
        const uris = await vscode.window.showOpenDialog({
          filters: { 'Arch Plan': ['json'] },
          canSelectMany: false,
          title: 'Open Arch Plan',
        })
        if (uris?.[0]) this.loadBoard(uris[0].fsPath)
        break
      }

      case 'createPlanFile': {
        const defaultUri = root
          ? vscode.Uri.file(path.join(root, '.vscode', 'arch-plan.json'))
          : undefined
        const uri = await vscode.window.showSaveDialog({
          defaultUri,
          filters: { 'Arch Plan': ['json'] },
          title: 'Create Arch Plan',
        })
        if (uri) {
          const board: PlanBoard = {
            title: 'Sprint 1',
            columns: ['Todo', 'In Progress', 'Review', 'Done'],
            tasks: [],
          }
          writeJson(uri.fsPath, board)
          this.loadBoard(uri.fsPath)
        }
        break
      }

      case 'loadBrief': {
        const taskId = msg.taskId as string
        const brief = root ? readBrief(root, taskId) : null
        this.post({ type: 'briefLoaded', taskId, brief })
        break
      }

      case 'saveBrief': {
        if (root) saveBrief(root, msg.taskId as string, msg.brief as BriefContent)
        break
      }

      default:
        if (this.planFilePath) this.applyMutation(msg)
        break
    }
  }

  private async autoLoad(root: string | null): Promise<void> {
    const remembered = this.getRememberedPlanPath(root)
    if (remembered) {
      this.loadBoard(remembered)
      return
    }

    const fallback = root ? path.join(root, '.vscode', 'arch-plan.json') : null
    if (fallback && fs.existsSync(fallback)) {
      this.loadBoard(fallback)
    } else {
      this.post({ type: 'noFile' })
    }
  }

  private loadBoard(filePath: string): void {
    try {
      const board = readJson<PlanBoard>(filePath)
      this.planFilePath = filePath
      this.rememberPlanPath(filePath)
      this.post({ type: 'loadBoard', board, filePath })
    } catch (err) {
      this.post({ type: 'error', message: `Cannot load plan: ${String(err)}` })
    }
  }

  private getRememberedPlanPath(root: string | null): string | null {
    const remembered = this.context.workspaceState.get<string>(ArchVisualizerPanel.LAST_PLAN_PATH_KEY)
    if (!remembered || !fs.existsSync(remembered)) return null
    if (!root) return remembered
    return remembered.startsWith(root + path.sep) || remembered === root ? remembered : null
  }

  private rememberPlanPath(filePath: string): void {
    void this.context.workspaceState.update(ArchVisualizerPanel.LAST_PLAN_PATH_KEY, filePath)
  }

  private applyMutation(action: Action): void {
    if (!this.planFilePath) return
    try {
      const board = readJson<PlanBoard>(this.planFilePath)
      const updated = mutate(board, action)
      writeJson(this.planFilePath, updated)
      this.post({ type: 'boardUpdated', board: updated })
    } catch (err) {
      this.post({ type: 'error', message: `Cannot save plan: ${String(err)}` })
    }
  }
}

// ── Extension entry points ─────────────────────────────────────────────────
export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('arch-visualizer.open', () => {
      ArchVisualizerPanel.open(context)
    }),
  )
}

export function deactivate(): void {}

// ── Helpers ────────────────────────────────────────────────────────────────
function workspaceRoot(): string | null {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null
}

function buildCsp(webview: vscode.Webview): string {
  return [
    `default-src 'none'`,
    `script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `img-src ${webview.cspSource} data: https:`,
    `font-src ${webview.cspSource} data:`,
    `connect-src https://cdn.jsdelivr.net https://raw.githubusercontent.com`,
    `worker-src blob:`,
  ].join('; ')
}

function notBuiltHtml(): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="padding:24px;font-family:system-ui;background:#0a0a0f;color:#e2e8f0">
  <h2 style="color:#f87171">Webview not built</h2>
  <p>Run the following in the project root, then reopen the panel:</p>
  <pre style="background:#1e293b;padding:12px;border-radius:6px">npm run build:webview</pre>
</body>
</html>`
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

function writeJson(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
}

function readBrief(root: string, taskId: string): BriefContent | null {
  const p = path.join(root, '.vscode', 'arch-briefs', `${taskId}.json`)
  if (!fs.existsSync(p)) return null
  try {
    return readJson<BriefContent>(p)
  } catch {
    return null
  }
}

function saveBrief(root: string, taskId: string, brief: BriefContent): void {
  const dir = path.join(root, '.vscode', 'arch-briefs')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  writeJson(path.join(dir, `${taskId}.json`), brief)
}

// ── Board mutation (mirrors useBoard.ts local dispatch logic) ──────────────
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
      const created: TaskCard = {
        id: newId,
        ...taskData,
        output: `.vscode/arch-briefs/${newId}.json`,
      }
      return { ...board, tasks: [...board.tasks, created] }
    }

    case 'updateTask': {
      const updated = action.task as TaskCard
      return {
        ...board,
        tasks: board.tasks.map((t) => (t.id === updated.id ? updated : t)),
      }
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

import { Plugin, TFile, WorkspaceLeaf } from 'obsidian'
import { PlanningBoardView, PLANNING_VIEW_TYPE } from './PlanningBoardView'

export default class ArchVisualizerPlanningPlugin extends Plugin {
  private planningView: PlanningBoardView | null = null

  async onload() {
    this.registerView(PLANNING_VIEW_TYPE, (leaf: WorkspaceLeaf) => {
      this.planningView = new PlanningBoardView(leaf, this.app)
      return this.planningView
    })

    this.addRibbonIcon('kanban', 'Planning Board', () => {
      void this.activateView()
    })

    this.addCommand({
      id: 'open-planning-board',
      name: 'Open Planning Board',
      callback: () => { void this.activateView() },
    })

    this.addCommand({
      id: 'create-plan-file',
      name: 'Create new .plan.md file',
      callback: () => {
        if (this.planningView) void this.planningView.createNewPlanFile()
        else void this.activateView().then(() => this.planningView?.createNewPlanFile())
      },
    })

    this.addCommand({
      id: 'refresh-planning-board',
      name: 'Refresh Planning Board',
      callback: () => { this.planningView?.refresh() },
    })

    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file instanceof TFile && file.path.endsWith('.plan.md') && file.path.startsWith('planning/')) {
          if (this.planningView && !this.planningView.isSelfWrite()) {
            setTimeout(() => this.planningView?.handleExternalChange(file), 300)
          }
        }
      })
    )

    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if (file instanceof TFile && file.path.endsWith('.plan.md')) this.planningView?.refresh()
      })
    )

    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        if (file instanceof TFile && file.path.endsWith('.plan.md')) this.planningView?.refresh()
      })
    )
  }

  onunload() { this.planningView = null }

  async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(PLANNING_VIEW_TYPE)
    if (existing.length > 0) { this.app.workspace.revealLeaf(existing[0]); return }
    const leaf = this.app.workspace.getRightLeaf(false)
    if (leaf) {
      await leaf.setViewState({ type: PLANNING_VIEW_TYPE, active: true })
      this.app.workspace.revealLeaf(leaf)
    }
  }
}

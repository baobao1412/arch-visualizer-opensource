import { Plugin, TFile, WorkspaceLeaf } from 'obsidian'
import { PlanningBoardView, PLANNING_VIEW_TYPE } from './PlanningBoardView'
import { ArchVisualizerSettingsTab, ArchVisualizerSettings, DEFAULT_SETTINGS } from './SettingsTab'

export default class ArchVisualizerPlanningPlugin extends Plugin {
  private planningView: PlanningBoardView | null = null
  settings: ArchVisualizerSettings = { ...DEFAULT_SETTINGS }

  async onload() {
    await this.loadSettings()
    this.addSettingTab(new ArchVisualizerSettingsTab(this.app, this))

    this.registerView(PLANNING_VIEW_TYPE, (leaf: WorkspaceLeaf) => {
      this.planningView = new PlanningBoardView(leaf, this.app, this)
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

    this.addCommand({
      id: 'open-plan-file',
      name: 'Open current plan file in editor',
      callback: () => { void this.planningView?.openCurrentPlanFile() },
    })

    this.addCommand({
      id: 'sync-clickup',
      name: 'Sync with ClickUp',
      callback: () => { void this.planningView?.syncClickUp() },
    })

    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file instanceof TFile && file.path.endsWith('.plan.md')) {
          if (this.planningView && !this.planningView.isSelfWrite()) {
            setTimeout(() => this.planningView?.handleExternalChange(file), 300)
          }
        }
      })
    )

    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if (!(file instanceof TFile) || !file.path.endsWith('.plan.md')) return
        if (!this.planningView) return
        // Avoid jumping to a newly created default file while user is editing another board.
        if (!this.planningView.hasCurrentFile()) this.planningView.refresh()
      })
    )

    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        if (!(file instanceof TFile) || !file.path.endsWith('.plan.md')) return
        if (!this.planningView) return
        // Only reload if the currently opened plan file was deleted.
        if (this.planningView.isCurrentFile(file)) this.planningView.refresh()
      })
    )
  }

  onunload() { this.planningView = null }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings() {
    await this.saveData(this.settings)
  }

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

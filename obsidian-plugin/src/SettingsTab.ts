import { App, PluginSettingTab, Setting } from 'obsidian'
import type ArchVisualizerPlanningPlugin from './main'

export interface ArchVisualizerSettings {
  clickupToken: string
  clickupListId: string
}

export const DEFAULT_SETTINGS: ArchVisualizerSettings = {
  clickupToken: '',
  clickupListId: '',
}

export class ArchVisualizerSettingsTab extends PluginSettingTab {
  constructor(app: App, private plugin: ArchVisualizerPlanningPlugin) {
    super(app, plugin)
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()
    containerEl.createEl('h2', { text: 'Arch Visualizer — Planning Board' })

    new Setting(containerEl)
      .setName('ClickUp API Token')
      .setDesc('Personal API token from ClickUp → Settings → Apps → API Token')
      .addText(t => {
        t.setPlaceholder('pk_...')
          .setValue(this.plugin.settings.clickupToken)
          .onChange(async (value) => {
            this.plugin.settings.clickupToken = value.trim()
            await this.plugin.saveSettings()
          })
        t.inputEl.type = 'password'
        t.inputEl.style.width = '100%'
      })

    new Setting(containerEl)
      .setName('ClickUp List ID')
      .setDesc('Numeric list ID from the ClickUp list URL (e.g. 901818090675)')
      .addText(t => {
        t.setPlaceholder('901818090675')
          .setValue(this.plugin.settings.clickupListId)
          .onChange(async (value) => {
            this.plugin.settings.clickupListId = value.trim()
            await this.plugin.saveSettings()
          })
        t.inputEl.style.width = '100%'
      })
  }
}

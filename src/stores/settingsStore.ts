import { create } from 'zustand'
import type { AppSettings } from '@/types'
import { settingsRepository } from '@/database/repositories'
import { DEFAULT_SETTINGS } from '@/database/mapping'

interface SettingsState {
  settings: AppSettings
  loaded: boolean
  load: () => Promise<void>
  update: (patch: Partial<AppSettings>) => Promise<void>
  reset: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    try {
      const settings = await settingsRepository.load()
      set({ settings, loaded: true })
    } catch {
      set({ settings: DEFAULT_SETTINGS, loaded: true })
    }
  },

  update: async (patch) => {
    const settings = { ...get().settings, ...patch }
    await settingsRepository.save(settings)
    set({ settings })
  },

  reset: async () => {
    await settingsRepository.save(DEFAULT_SETTINGS)
    set({ settings: DEFAULT_SETTINGS })
  },
}))
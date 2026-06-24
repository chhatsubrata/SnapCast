/**
 * Settings store. Mirrors the persisted {@link AppSettings} from main and is the
 * single source of truth for the renderer. Updates are optimistic: we send the
 * patch to main and trust the `settings:changed` push (and the resolved return)
 * to reconcile.
 */

import { create } from 'zustand'
import { type AppSettings, DEFAULT_SETTINGS } from '@shared/types'

interface SettingsState {
  settings: AppSettings
  loaded: boolean
  load: () => Promise<void>
  update: (patch: Partial<AppSettings>) => Promise<void>
  reset: () => Promise<void>
  /** Apply a server-pushed settings object without re-invoking main. */
  applyExternal: (settings: AppSettings) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  load: async () => {
    const settings = await window.api.invoke('settings:get')
    set({ settings, loaded: true })
  },
  update: async (patch) => {
    const settings = await window.api.invoke('settings:update', patch)
    set({ settings })
  },
  reset: async () => {
    const settings = await window.api.invoke('settings:reset')
    set({ settings })
  },
  applyExternal: (settings) => set({ settings })
}))

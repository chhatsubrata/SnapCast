/**
 * Live fixed-interval timer state. Fed by the `timer:tick` push (1 Hz) from
 * main, which is the authoritative owner of the timer (so hide/show keeps
 * working even while the window is hidden).
 */

import { create } from 'zustand'
import type { TimerState } from '@shared/types'

const EMPTY: TimerState = {
  running: false,
  elapsedSeconds: 0
}

interface TimerStore {
  state: TimerState
  setState: (state: TimerState) => void
  load: () => Promise<void>
  start: () => Promise<void>
  stop: () => Promise<void>
}

export const useTimerStore = create<TimerStore>((set) => ({
  state: EMPTY,
  setState: (state) => set({ state }),
  load: async () => set({ state: await window.api.invoke('timer:get-state') }),
  start: async () => set({ state: await window.api.invoke('timer:start') }),
  stop: async () => set({ state: await window.api.invoke('timer:stop') })
}))

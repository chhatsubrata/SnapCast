/**
 * UI/navigation store: which view is showing, expanded vs compact, and the
 * resolved (concrete) theme after applying the user's dark/light/system choice.
 *
 * Navigation also drives the OS window size. To avoid a flicker where the new
 * content is painted into a still-too-small window (or empty space lingers in a
 * still-too-big one), we order the resize relative to the content swap:
 *   - growing  -> resize the window FIRST, then swap content in
 *   - shrinking -> swap content FIRST, then shrink the window after the exit anim
 */

import { create } from 'zustand'
import type { WidgetMode } from '@shared/types'

export type View = 'widget' | 'analytics' | 'settings' | 'wizard' | 'events'
export type ResolvedTheme = 'dark' | 'light'

/** A surface is "big" for any full page, or for the expanded widget. */
function isBig(view: View, mode: WidgetMode): boolean {
  return view !== 'widget' || mode === 'expanded'
}

/** Resize the OS window to the big (expanded) or small (compact) footprint. */
function resizeWindow(big: boolean): Promise<void> {
  return window.api.invoke('window:resize-for-mode', big ? 'expanded' : 'compact')
}

/** Ms to let the content exit animation play before shrinking the window. */
const SHRINK_DELAY_MS = 200

interface WidgetState {
  view: View
  mode: WidgetMode
  resolvedTheme: ResolvedTheme
  setView: (view: View) => void
  setMode: (mode: WidgetMode) => void
  toggleMode: () => void
  setResolvedTheme: (theme: ResolvedTheme) => void
}

export const useWidgetStore = create<WidgetState>((set, get) => {
  /** Apply a navigation change, ordering the window resize to avoid flicker. */
  const navigate = (next: { view?: View; mode?: WidgetMode }): void => {
    const { view, mode } = get()
    const nextView = next.view ?? view
    const nextMode = next.mode ?? mode
    const wasBig = isBig(view, mode)
    const willBig = isBig(nextView, nextMode)

    if (willBig && !wasBig) {
      // Grow: enlarge the window first so the new content paints into full size.
      void resizeWindow(true).then(() => set(next))
    } else if (!willBig && wasBig) {
      // Shrink: swap content now, shrink after the exit animation finishes.
      set(next)
      window.setTimeout(() => void resizeWindow(false), SHRINK_DELAY_MS)
    } else {
      set(next)
      void resizeWindow(willBig)
    }
  }

  return {
    view: 'widget',
    mode: 'expanded',
    resolvedTheme: 'dark',
    setView: (view) => navigate({ view }),
    setMode: (mode) => navigate({ mode }),
    toggleMode: () => navigate({ mode: get().mode === 'expanded' ? 'compact' : 'expanded' }),
    setResolvedTheme: (resolvedTheme) => set({ resolvedTheme })
  }
})

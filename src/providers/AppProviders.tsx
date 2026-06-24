/**
 * Cross-cutting providers and one-time side effects: bridge wiring, theme
 * resolution, and applying the "start in compact mode" preference once settings
 * have loaded. Kept separate from <App/> so the routing stays declarative.
 */

import { memo, useEffect, useRef } from 'react'
import { useBridge } from '@hooks/useBridge'
import { useTheme } from '@hooks/useTheme'
import { useSettingsStore } from '@store/settingsStore'
import { useWidgetStore } from '@store/widgetStore'

interface AppProvidersProps {
  children: React.ReactNode
}

function AppProvidersBase({ children }: AppProvidersProps): React.JSX.Element {
  useBridge()
  useTheme()

  const loaded = useSettingsStore((s) => s.loaded)
  const compactDefault = useSettingsStore((s) => s.settings.general.compactModeDefault)
  const setMode = useWidgetStore((s) => s.setMode)
  const appliedRef = useRef(false)

  // Apply compact-mode-default exactly once, after settings hydrate. setMode
  // coordinates the OS window resize itself (see widgetStore), so no separate
  // resize effect is needed here.
  useEffect(() => {
    if (loaded && !appliedRef.current) {
      appliedRef.current = true
      setMode(compactDefault ? 'compact' : 'expanded')
    }
  }, [loaded, compactDefault, setMode])

  return <>{children}</>
}

export const AppProviders = memo(AppProvidersBase)

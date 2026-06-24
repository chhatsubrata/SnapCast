/**
 * Wires the renderer to the main process: loads initial state once, then keeps
 * the stores in sync with every push channel. Mount once near the app root.
 *
 * All subscriptions are torn down on unmount to avoid leaks during HMR.
 */

import { useEffect } from 'react'
import { playNotificationSound } from '@utils/sound'
import { useAnalyticsStore } from '@store/analyticsStore'
import { usePredictionStore } from '@store/predictionStore'
import { useSettingsStore } from '@store/settingsStore'
import { useTimerStore } from '@store/timerStore'
import { useWidgetStore } from '@store/widgetStore'

export function useBridge(): void {
  useEffect(() => {
    const { setPrediction, setBadge } = usePredictionStore.getState()
    const { setData } = useAnalyticsStore.getState()
    const { applyExternal } = useSettingsStore.getState()
    const { setView, setMode } = useWidgetStore.getState()

    const setTimer = useTimerStore.getState().setState

    // Initial hydrate.
    void useSettingsStore.getState().load()
    void usePredictionStore.getState().load()
    void useAnalyticsStore.getState().load()
    void useTimerStore.getState().load()

    const unsubs = [
      window.api.on('prediction:update', setPrediction),
      window.api.on('timer:tick', setTimer),
      window.api.on('status:badge', setBadge),
      window.api.on('analytics:update', setData),
      window.api.on('settings:changed', applyExternal),
      window.api.on('widget:mode-changed', setMode),
      window.api.on('navigate', (target) => {
        setView(target)
      }),
      window.api.on('notification:sound', () => playNotificationSound())
    ]

    return () => unsubs.forEach((off) => off())
  }, [])
}

/**
 * Persistence layer backed by electron-store.
 *
 * Two concerns are persisted:
 *  - `settings`: the full {@link AppSettings} tree.
 *  - `events`: the rolling window of observed screenshot events (<= 1000).
 *  - `window`: last-known widget bounds for restore-on-launch.
 *  - `confidenceTrend`: sampled confidence over time for the analytics chart.
 *
 * All reads are defensive: corrupt or partial data falls back to defaults so a
 * bad file never prevents the app from starting (Error Handling requirement).
 */

import Store from 'electron-store'
import {
  AlgorithmType,
  type AppSettings,
  type ConfidenceSample,
  DEFAULT_SETTINGS,
  type ScreenshotEvent
} from '@shared/types'

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

interface PersistShape {
  settings: AppSettings
  events: ScreenshotEvent[]
  window: WindowBounds | null
  confidenceTrend: ConfidenceSample[]
}

const store = new Store<PersistShape>({
  name: 'shot-capture',
  defaults: {
    settings: DEFAULT_SETTINGS,
    events: [],
    window: null,
    confidenceTrend: []
  },
  clearInvalidConfig: true
})

/** Deep-merge persisted settings over defaults so new keys always exist. */
export function loadSettings(): AppSettings {
  const raw = store.get('settings')
  return mergeSettings(DEFAULT_SETTINGS, raw)
}

export function saveSettings(settings: AppSettings): void {
  store.set('settings', settings)
}

export function loadEvents(): ScreenshotEvent[] {
  const events = store.get('events')
  return Array.isArray(events) ? events.slice(-1000) : []
}

export function saveEvents(events: ScreenshotEvent[]): void {
  store.set('events', events.slice(-1000))
}

export function loadWindowBounds(): WindowBounds | null {
  return store.get('window') ?? null
}

export function saveWindowBounds(bounds: WindowBounds): void {
  store.set('window', bounds)
}

export function loadConfidenceTrend(): ConfidenceSample[] {
  const trend = store.get('confidenceTrend')
  return Array.isArray(trend) ? trend.slice(-500) : []
}

export function saveConfidenceTrend(trend: ConfidenceSample[]): void {
  store.set('confidenceTrend', trend.slice(-500))
}

/** Shallow-by-section merge that tolerates missing/partial persisted sections. */
function mergeSettings(base: AppSettings, override: Partial<AppSettings> | undefined): AppSettings {
  if (!override || typeof override !== 'object') return { ...base }
  const prediction = { ...base.prediction, ...override.prediction }
  // Migrate stale/removed algorithms (e.g. 'weighted', 'rolling-average') from
  // older installs to the only supported value, so the countdown keeps working.
  if (!Object.values(AlgorithmType).includes(prediction.algorithm)) {
    prediction.algorithm = AlgorithmType.FIXED_INTERVAL
  }
  return {
    general: { ...base.general, ...override.general },
    appearance: { ...base.appearance, ...override.appearance },
    prediction,
    autoHide: { ...base.autoHide, ...override.autoHide },
    notifications: { ...base.notifications, ...override.notifications },
    source: { ...base.source, ...override.source },
    privacy: { ...base.privacy, ...override.privacy }
  }
}

export { mergeSettings }

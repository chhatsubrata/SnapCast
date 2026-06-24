/**
 * Strongly-typed IPC contract shared by main and renderer.
 *
 * `IpcRequestMap` maps every invoke channel to its argument and return types.
 * The preload bridge and main handlers both derive their signatures from this
 * single source of truth, so a mismatch is a compile error rather than a
 * runtime surprise.
 *
 * `IpcEventMap` maps push channels (main -> renderer) to their payload types.
 */

import type {
  AnalyticsData,
  AppSettings,
  PredictionResult,
  ScreenshotEvent,
  SourceConfig,
  StatusBadge,
  ThemeMode,
  TimerState,
  WidgetMode
} from './types'

/** Request/response channels driven by `ipcRenderer.invoke`. */
export interface IpcRequestMap {
  // Window control
  'window:minimize': { args: void; result: void }
  'window:hide': { args: void; result: void }
  'window:show': { args: void; result: void }
  'window:set-always-on-top': { args: boolean; result: void }
  'window:set-opacity': { args: number; result: void }
  'window:resize-for-mode': { args: WidgetMode; result: void }
  /** X-button close: honours the quit-on-close / reset-timer-on-close settings. */
  'window:close': { args: void; result: void }

  // Settings
  'settings:get': { args: void; result: AppSettings }
  'settings:update': { args: Partial<AppSettings>; result: AppSettings }
  'settings:reset': { args: void; result: AppSettings }

  // Prediction
  'prediction:get-status': { args: void; result: PredictionResult }
  'prediction:get-history': { args: void; result: ScreenshotEvent[] }
  'prediction:record-manual': { args: number | undefined; result: PredictionResult }
  'prediction:restart-learning': { args: void; result: void }

  // Event history management
  'events:list': { args: void; result: ScreenshotEvent[] }
  'events:delete': { args: number; result: ScreenshotEvent[] }
  'events:update': { args: { index: number; timestamp: number }; result: ScreenshotEvent[] }
  'events:add': { args: number; result: ScreenshotEvent[] }
  'events:clear': { args: void; result: ScreenshotEvent[] }

  // Fixed-interval timer
  'timer:start': { args: void; result: TimerState }
  'timer:stop': { args: void; result: TimerState }
  'timer:get-state': { args: void; result: TimerState }

  // Analytics
  'analytics:get-data': { args: void; result: AnalyticsData }

  // Source / detection wizard
  'source:configure': { args: SourceConfig; result: { ok: boolean; message: string } }
  'source:verify': { args: SourceConfig; result: { detected: boolean; sampleCount: number } }
  'source:pick-folder': { args: void; result: string | null }
  'source:pick-file': { args: void; result: string | null }

  // Widget
  'widget:set-compact-mode': { args: WidgetMode; result: void }
  'widget:set-theme': { args: ThemeMode; result: void }

  // App
  'app:get-version': { args: void; result: string }
  'app:open-analytics': { args: void; result: void }
  'app:open-settings': { args: void; result: void }
}

export type IpcRequestChannel = keyof IpcRequestMap

/** Push channels driven by `webContents.send`. */
export interface IpcEventMap {
  'prediction:update': PredictionResult
  'timer:tick': TimerState
  'screenshot:detected': ScreenshotEvent
  'analytics:update': AnalyticsData
  'status:badge': StatusBadge
  'settings:changed': AppSettings
  'widget:mode-changed': WidgetMode
  'navigate': 'widget' | 'analytics' | 'settings' | 'wizard' | 'events'
  /** Asks the renderer to play the custom notification sound. */
  'notification:sound': void
}

export type IpcEventChannel = keyof IpcEventMap

/** All invoke channel names, useful for whitelisting in the preload bridge. */
export const IPC_REQUEST_CHANNELS: IpcRequestChannel[] = [
  'window:minimize',
  'window:hide',
  'window:show',
  'window:set-always-on-top',
  'window:set-opacity',
  'window:resize-for-mode',
  'window:close',
  'settings:get',
  'settings:update',
  'settings:reset',
  'prediction:get-status',
  'prediction:get-history',
  'prediction:record-manual',
  'prediction:restart-learning',
  'events:list',
  'events:delete',
  'events:update',
  'events:add',
  'events:clear',
  'timer:start',
  'timer:stop',
  'timer:get-state',
  'analytics:get-data',
  'source:configure',
  'source:verify',
  'source:pick-folder',
  'source:pick-file',
  'widget:set-compact-mode',
  'widget:set-theme',
  'app:get-version',
  'app:open-analytics',
  'app:open-settings'
]

/** All push channel names, whitelisted by the preload bridge. */
export const IPC_EVENT_CHANNELS: IpcEventChannel[] = [
  'prediction:update',
  'timer:tick',
  'screenshot:detected',
  'analytics:update',
  'status:badge',
  'settings:changed',
  'widget:mode-changed',
  'navigate',
  'notification:sound'
]

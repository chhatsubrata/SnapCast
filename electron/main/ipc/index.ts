/**
 * Centralized, type-safe IPC handler registration.
 *
 * `handle` constrains each handler's argument and return types to the shared
 * {@link IpcRequestMap}, so a handler that returns the wrong shape — or a
 * channel name with no contract — fails to compile.
 */

import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import type { IpcRequestChannel, IpcRequestMap } from '@shared/ipc'
import type { PredictionService } from '../services/PredictionService'
import type { TimerService } from '../services/TimerService'
import type { WindowManager } from '../window-manager'
import { logger } from '../logger'

type Handler<C extends IpcRequestChannel> = (
  args: IpcRequestMap[C]['args']
) => IpcRequestMap[C]['result'] | Promise<IpcRequestMap[C]['result']>

function handle<C extends IpcRequestChannel>(channel: C, handler: Handler<C>): void {
  ipcMain.handle(channel, async (_event, args) => {
    try {
      return await handler(args as IpcRequestMap[C]['args'])
    } catch (err) {
      logger.error('ipc handler failed', { channel, err: String(err) })
      throw err
    }
  })
}

export function registerIpcHandlers(
  service: PredictionService,
  windows: WindowManager,
  timer: TimerService
): void {
  // --- Window control ---
  handle('window:minimize', () => windows.minimize())
  handle('window:hide', () => windows.hide())
  // Programmatic show — never activates, so it can't steal the user's caret.
  handle('window:show', () => windows.showInactive())
  handle('window:set-always-on-top', (value) => windows.setAlwaysOnTop(value))
  handle('window:set-opacity', (value) => windows.setOpacity(value))
  handle('window:resize-for-mode', (mode) => windows.resizeForMode(mode))
  handle('window:reset-size', () => windows.resetSize())
  handle('window:is-oversized', () => windows.isOversized())
  handle('window:drag-start', (p) => windows.dragStart(p))
  handle('window:drag-move', (p) => windows.dragMove(p))
  handle('window:close', async () => {
    const settings = service.getSettings()
    // Reset the timer (stopwatch + sync anchor) without touching other settings.
    if (settings.general.resetTimerOnClose) {
      timer.stop()
      if (settings.prediction.anchorTimestamp !== null) {
        await service.updateSettings({
          prediction: { ...settings.prediction, anchorTimestamp: null }
        })
      }
    }
    // Fully quit, or just hide to the tray.
    if (settings.general.quitOnClose) app.quit()
    else windows.hide()
  })

  // --- Settings ---
  handle('settings:get', () => service.getSettings())
  handle('settings:update', (patch) => service.updateSettings(patch))
  handle('settings:reset', () => service.resetSettings())

  // --- Prediction ---
  handle('prediction:get-status', () => service.getPrediction())
  handle('prediction:get-history', () => service.getHistory())
  handle('prediction:record-manual', (ts) => {
    service.recordManual(ts)
    return service.getPrediction()
  })
  handle('prediction:restart-learning', () => service.restartLearning())
  handle('prediction:set-remaining', ({ seconds }) => service.setRemaining(seconds))

  // --- Event history ---
  handle('events:list', () => service.getHistory())
  handle('events:delete', (index) => service.deleteEvent(index))
  handle('events:update', ({ index, timestamp }) => service.updateEvent(index, timestamp))
  handle('events:add', (timestamp) => service.addEvent(timestamp))
  handle('events:clear', () => service.clearEvents())

  // --- Timer ---
  handle('timer:start', () => timer.start())
  handle('timer:stop', () => timer.stop())
  handle('timer:get-state', () => timer.getState())

  // --- Analytics ---
  handle('analytics:get-data', () => service.getAnalytics())

  // --- Source / wizard ---
  handle('source:configure', async (config) => {
    await service.updateSettings({ source: config })
    return { ok: true, message: 'Source configured.' }
  })
  handle('source:verify', async (config) => {
    const result = await service.verifySource(config)
    return { detected: result.detected, sampleCount: result.sampleCount }
  })
  handle('source:pick-folder', async () => {
    const win = windows.getWindow() ?? BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, { properties: ['openDirectory'] })
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]
  })
  handle('source:pick-file', async () => {
    const win = windows.getWindow() ?? BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openFile'],
      filters: [
        { name: 'Logs', extensions: ['log', 'txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]
  })

  // --- Widget ---
  handle('widget:set-compact-mode', (mode) => {
    windows.send('widget:mode-changed', mode)
  })
  handle('widget:set-theme', (theme) => {
    void service.updateSettings({ appearance: { ...service.getSettings().appearance, theme } })
  })

  // --- App ---
  handle('app:get-version', () => app.getVersion())
  handle('app:open-analytics', () => windows.send('navigate', 'analytics'))
  handle('app:open-settings', () => windows.send('navigate', 'settings'))
}

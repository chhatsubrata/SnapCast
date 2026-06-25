/**
 * Electron main entry point.
 *
 * Responsibilities:
 *  - enforce a single instance,
 *  - apply baseline security (block in-app navigation to remote origins),
 *  - construct the window, tray, prediction service and IPC layer,
 *  - apply launch-on-startup preference,
 *  - tidy up on quit.
 *
 * This application is a standalone productivity overlay. It never injects into,
 * hooks, reads the memory of, or otherwise interferes with any other process or
 * screenshot software — it only models the timing of events it is given.
 */

import { app, BrowserWindow, globalShortcut } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { WindowManager } from './window-manager'
import { TrayManager } from './tray'
import { PredictionService } from './services/PredictionService'
import { TimerService } from './services/TimerService'
import { registerIpcHandlers } from './ipc'
import { logger } from './logger'

const windows = new WindowManager()
const trayManager = new TrayManager()
let service: PredictionService | null = null
let timer: TimerService | null = null

// Single-instance lock: focus the existing widget instead of opening a second.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => windows.show())

  app.whenReady().then(async () => {
    electronApp.setAppUserModelId('com.snapcast.app')

    app.on('browser-window-created', (_event, window) => {
      optimizer.watchWindowShortcuts(window)
      hardenWindow(window)
    })

    windows.create()
    service = new PredictionService(windows)
    timer = new TimerService(windows)
    registerIpcHandlers(service, windows, timer)
    await service.start()
    trayManager.create(service, windows)

    applyLoginItem()
    registerGlobalShortcuts()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) windows.create()
      else windows.show()
    })

    logger.info('app ready')
  })
}

// Keep running in the tray when the widget window is closed.
app.on('window-all-closed', () => {
  // Intentionally do not quit on non-macOS; the tray keeps the app alive.
})

app.on('before-quit', async () => {
  globalShortcut.unregisterAll()
  timer?.dispose()
  await service?.stop()
  trayManager.destroy()
  logger.info('app quitting')
})

/**
 * Global hotkey to toggle widget visibility. This is the manual hide/show used
 * everywhere and the primary fallback on Linux, where OS capture exclusion is
 * unavailable.
 */
function registerGlobalShortcuts(): void {
  const accelerator = 'CommandOrControl+Shift+H'
  const ok = globalShortcut.register(accelerator, () => {
    const win = windows.getWindow()
    if (!win) return
    if (win.isVisible()) windows.hide()
    else windows.show()
  })
  if (ok) logger.info('global hotkey registered', { accelerator })
  else logger.warn('global hotkey registration failed', { accelerator })
}

/** Apply the user's "launch on startup" preference at boot. */
function applyLoginItem(): void {
  if (!service) return
  const { launchOnStartup } = service.getSettings().general
  app.setLoginItemSettings({ openAtLogin: launchOnStartup })
}

/**
 * Defence-in-depth: forbid navigation away from the bundled renderer and deny
 * permission requests we never need (camera, geolocation, etc.).
 */
function hardenWindow(window: BrowserWindow): void {
  window.webContents.on('will-navigate', (event, url) => {
    const allowed = process.env['ELECTRON_RENDERER_URL']
    if (allowed && url.startsWith(allowed)) return
    if (url.startsWith('file://')) return
    event.preventDefault()
    logger.warn('blocked navigation', { url })
  })

  window.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(false)
  })
}

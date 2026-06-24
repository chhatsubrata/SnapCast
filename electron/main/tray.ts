/**
 * System tray integration. Provides quick access to show/hide the widget,
 * open analytics or settings, restart learning, and exit.
 */

import { app, Menu, nativeImage, Tray } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import type { PredictionService } from './services/PredictionService'
import type { WindowManager } from './window-manager'
import { logger } from './logger'

/**
 * 16x16 transparent PNG with a filled rounded square — a dependency-free
 * fallback so the tray always has a visible icon even if no asset ships.
 */
const FALLBACK_ICON_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAW0lEQVR4nO3UMQ6AIAxA0Y+TF/D+R3FzcVITQ0KEpkSjEZ8z89KFAjyM' +
  'q6q2gFIRO4iciYjsq6q2wGZpUuI3MA2YwL4Bu4N3Bq4N3Bq4N3Bq4N3Bq4N3Bq4N3Bq4N3Bq8AAEYIBdkUo9bgAAAABJRU5ErkJggg=='

export class TrayManager {
  private tray: Tray | null = null

  create(service: PredictionService, windows: WindowManager): void {
    const icon = this.resolveIcon()
    this.tray = new Tray(icon)
    this.tray.setToolTip('Shot Capture')

    const menu = Menu.buildFromTemplate([
      { label: 'Show Widget', click: () => windows.show() },
      { label: 'Hide Widget', click: () => windows.hide() },
      { type: 'separator' },
      { label: 'Settings', click: () => {
        windows.show()
        windows.send('navigate', 'settings')
      } },
      { type: 'separator' },
      { label: 'Restart Learning', click: () => service.restartLearning() },
      { type: 'separator' },
      { label: 'Exit', click: () => app.quit() }
    ])
    this.tray.setContextMenu(menu)
    this.tray.on('double-click', () => windows.show())
    logger.info('tray created')
  }

  private resolveIcon(): Electron.NativeImage {
    const candidate = app.isPackaged
      ? join(process.resourcesPath, 'tray.png')
      : join(__dirname, '../../resources/tray.png')
    if (existsSync(candidate)) {
      const img = nativeImage.createFromPath(candidate)
      if (!img.isEmpty()) return img.resize({ width: 16, height: 16 })
    }
    return nativeImage.createFromDataURL(FALLBACK_ICON_DATA_URL)
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }
}

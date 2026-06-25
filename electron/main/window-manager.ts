/**
 * Owns the floating widget BrowserWindow: creation with secure + overlay-style
 * options, multi-monitor-aware position restore, debounced bounds persistence,
 * and typed push helpers to the renderer.
 */

import { BrowserWindow, screen, shell } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'node:path'
import type { IpcEventChannel, IpcEventMap } from '@shared/ipc'
import type { WidgetMode } from '@shared/types'
import { loadSettings, loadWindowBounds, saveWindowBounds, type WindowBounds } from './store'
import { resolveResource } from './assets'
import { logger } from './logger'

/** Per-mode window dimensions. Compact is a tiny live-timer box. */
const WIDGET_SIZES: Record<WidgetMode, { width: number; height: number }> = {
  compact: { width: 272, height: 92 },
  expanded: { width: 344, height: 580 }
}

const DEFAULT_WIDTH = WIDGET_SIZES.compact.width
const DEFAULT_HEIGHT = WIDGET_SIZES.compact.height

export class WindowManager {
  private window: BrowserWindow | null = null
  private saveTimer: NodeJS.Timeout | null = null

  create(): BrowserWindow {
    const bounds = this.resolveInitialBounds()

    this.window = new BrowserWindow({
      ...bounds,
      icon: this.resolveAppIcon(),
      minWidth: 200,
      minHeight: 90,
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      alwaysOnTop: true,
      resizable: true,
      movable: true,
      skipTaskbar: false,
      hasShadow: false,
      // Keep the widget from stealing focus from the user's active work.
      focusable: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true
      }
    })

    // Float above full-screen apps across virtual desktops.
    this.window.setAlwaysOnTop(true, 'screen-saver')
    this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    // Exclude the widget from screen captures/recordings if the user wants it.
    this.setContentProtection(loadSettings().privacy.excludeFromCapture)

    this.window.once('ready-to-show', () => this.window?.show())

    // Open external links in the user's browser, never in-app.
    this.window.webContents.setWindowOpenHandler(({ url }) => {
      void shell.openExternal(url)
      return { action: 'deny' }
    })

    this.window.on('move', () => this.persistBoundsDebounced())
    this.window.on('resize', () => this.persistBoundsDebounced())
    this.window.on('closed', () => {
      this.window = null
    })

    this.loadRenderer()
    return this.window
  }

  private loadRenderer(): void {
    if (!this.window) return
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      void this.window.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      void this.window.loadFile(join(__dirname, '../renderer/index.html'))
    }
  }

  /** App icon for the window/taskbar (packaged builds also get it from build/icon.png). */
  private resolveAppIcon(): string | undefined {
    return resolveResource('icon.png') ?? undefined
  }

  /** Restore the saved bounds if they still sit on a connected display. */
  private resolveInitialBounds(): WindowBounds {
    const saved = loadWindowBounds()
    if (saved && this.isOnSomeDisplay(saved)) return saved

    // Default: top-right of the primary display's work area.
    const { workArea } = screen.getPrimaryDisplay()
    return {
      x: workArea.x + workArea.width - DEFAULT_WIDTH - 24,
      y: workArea.y + 24,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT
    }
  }

  private isOnSomeDisplay(bounds: WindowBounds): boolean {
    return screen.getAllDisplays().some((d) => {
      const a = d.workArea
      return (
        bounds.x < a.x + a.width &&
        bounds.x + bounds.width > a.x &&
        bounds.y < a.y + a.height &&
        bounds.y + bounds.height > a.y
      )
    })
  }

  private persistBoundsDebounced(): void {
    if (!this.window) return
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      if (!this.window) return
      const b = this.window.getBounds()
      saveWindowBounds(b)
    }, 400)
  }

  getWindow(): BrowserWindow | null {
    return this.window
  }

  show(): void {
    this.window?.show()
    this.window?.focus()
  }

  hide(): void {
    this.window?.hide()
  }

  minimize(): void {
    this.window?.minimize()
  }

  setAlwaysOnTop(value: boolean): void {
    this.window?.setAlwaysOnTop(value, 'screen-saver')
  }

  /**
   * Toggle OS-level capture exclusion. On Windows/macOS the window is omitted
   * from screenshots and screen recordings; on Linux this is a no-op, so we log
   * once to make the limitation visible.
   */
  setContentProtection(enabled: boolean): void {
    this.window?.setContentProtection(enabled)
    if (enabled && process.platform === 'linux') {
      logger.warn('content protection unsupported on Linux — use the hide hotkey (Ctrl+Shift+H)')
    } else {
      logger.info('content protection set', { enabled })
    }
  }

  setOpacity(value: number): void {
    // Opacity is applied in the renderer for glassmorphism; on platforms that
    // support window opacity we also nudge it for a consistent feel.
    if (process.platform !== 'linux') this.window?.setOpacity(Math.max(0.3, Math.min(1, value)))
  }

  /** Type-safe push to the renderer. */
  send<C extends IpcEventChannel>(channel: C, payload: IpcEventMap[C]): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(channel, payload)
    }
  }

  /**
   * Resize the window to match the widget mode, keeping the TOP-RIGHT corner
   * pinned so the box grows downward/leftward from where the user placed it.
   */
  resizeForMode(mode: WidgetMode): void {
    if (!this.window) return
    const target = WIDGET_SIZES[mode]
    const current = this.window.getBounds()
    const rightEdge = current.x + current.width
    const x = Math.round(rightEdge - target.width)
    // Resize instantly (no OS animation): the renderer orders the resize around
    // the content swap (see widgetStore), and a lagging macOS resize animation
    // would let full-size content paint into a still-growing window — i.e. flicker.
    this.window.setBounds({ x, y: current.y, width: target.width, height: target.height }, false)
  }

  /** Auto-hide: hide now, re-show after `seconds`. */
  autoHide(seconds: number): void {
    if (!this.window) return
    logger.info('auto-hide triggered', { seconds })
    this.window.hide()
    setTimeout(() => this.window?.show(), seconds * 1000)
  }
}

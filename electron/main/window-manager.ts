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
  compact: { width: 272, height: 132 },
  expanded: { width: 344, height: 580 }
}

const DEFAULT_WIDTH = WIDGET_SIZES.compact.width
const DEFAULT_HEIGHT = WIDGET_SIZES.compact.height

/** Px a window may exceed its mode's size by before it counts as oversized. */
const OVERSIZE_SLACK = 8

/**
 * Stacking level for the overlay. Above ordinary windows, but below the layers
 * the system reserves for itself — an overlay that outranks everything can beat
 * a freshly opened window to the top and leave the user staring at the widget
 * instead of the window they just asked for.
 */
const ALWAYS_ON_TOP_LEVEL = 'floating' as const

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}

export class WindowManager {
  private window: BrowserWindow | null = null
  private saveTimer: NodeJS.Timeout | null = null
  /** Current widget footprint, kept in sync by resizeForMode and used by resetSize. */
  private mode: WidgetMode = 'expanded'
  /** Last oversized flag pushed to the renderer, so we only send on a change. */
  private lastOversized = false
  /** Anchor for a pointer-driven move: pointer + window position at drag start. */
  private dragOrigin: { pointer: { x: number; y: number }; window: { x: number; y: number } } | null =
    null

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
      // Out of the taskbar AND the alt-tab switcher: this is an overlay, not an
      // app the user tabs to. Tray + Ctrl/Cmd+Shift+H are the access paths.
      //
      skipTaskbar: true,
      // Linux: `skipTaskbar` is a no-op under Mutter/X11 with this Electron —
      // verified with xprop, the window kept _NET_WM_STATE_ABOVE and nothing
      // else, so it stayed in the alt-tab switcher. A toolbar window type is
      // what actually sets SKIP_TASKBAR + SKIP_PAGER there. Safe now that
      // dragging goes through setBounds instead of a WM move request.
      ...(process.platform === 'linux' ? { type: 'toolbar' } : {}),
      // Linux: skipTaskbar alone does not stick under Mutter/X11 (verified with
      // xprop — _NET_WM_STATE never gained SKIP_TASKBAR). A utility window type
      // is what actually keeps an overlay out of the window list and the alt-tab
      // switcher. Safe here because dragging no longer depends on the WM
      // honouring a move request — see useWindowDrag.
      hasShadow: false,
      // The widget can be clicked and dragged, but it never *takes* focus on its
      // own — every automatic show path uses showInactive().
      focusable: true,
      // Never let the overlay become a full-screen/maximized window; a
      // double-click on a drag region would otherwise maximize a frameless one.
      maximizable: false,
      fullscreenable: false,
      // Cap manual edge-drag resizing so it cannot balloon to screen size.
      maxWidth: WIDGET_SIZES.expanded.width * 2,
      maxHeight: WIDGET_SIZES.expanded.height * 2,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true
      }
    })

    // Float above full-screen apps across virtual desktops.
    //
    // Level is 'floating', not 'screen-saver': the screen-saver layer outranks
    // every ordinary window, so a newly opened window (e.g. picking a Chrome
    // profile) could come up behind the overlay and lose the raise/activate
    // race. 'floating' still keeps the widget above normal windows.
    this.window.setAlwaysOnTop(true, ALWAYS_ON_TOP_LEVEL)
    this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    // MUST come after the two calls above: on X11 they re-map the window, which
    // drops _NET_WM_STATE_SKIP_TASKBAR and puts the widget back in the alt-tab
    // switcher (verified with xprop — the live window kept only _ABOVE).
    this.applySkipTaskbar()

    // Exclude the widget from screen captures/recordings if the user wants it.
    this.setContentProtection(loadSettings().privacy.excludeFromCapture)

    // Show without activating: launching (often at login) must not pull focus
    // away from whatever the user is doing.
    this.window.once('ready-to-show', () => this.showInactive())

    // Every map/unmap is another chance for the WM to forget the hint.
    this.window.on('show', () => this.applySkipTaskbar())
    this.window.on('restore', () => this.applySkipTaskbar())

    // Belt and braces: some window managers maximize regardless of
    // `maximizable: false`, so bounce straight back out of it.
    this.window.on('maximize', () => {
      this.window?.unmaximize()
      this.publishOversized()
    })
    this.window.on('enter-full-screen', () => {
      this.window?.setFullScreen(false)
      this.publishOversized()
    })

    // Open external links in the user's browser, never in-app.
    this.window.webContents.setWindowOpenHandler(({ url }) => {
      void shell.openExternal(url)
      return { action: 'deny' }
    })

    this.window.on('move', () => this.persistBoundsDebounced())
    this.window.on('resize', () => {
      this.persistBoundsDebounced()
      this.publishOversized()
    })
    this.window.on('unmaximize', () => this.publishOversized())
    this.window.on('leave-full-screen', () => this.publishOversized())
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

    // Default: bottom-right of the primary display's work area.
    return this.defaultBoundsFor(
      { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
      screen.getPrimaryDisplay().workArea
    )
  }

  /** Bottom-right placement of `size` inside `workArea`, with a 24px inset. */
  private defaultBoundsFor(
    size: { width: number; height: number },
    workArea: Electron.Rectangle
  ): WindowBounds {
    return {
      x: workArea.x + workArea.width - size.width - 24,
      y: workArea.y + workArea.height - size.height - 24,
      width: size.width,
      height: size.height
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

  /**
   * Show AND activate. Reserved for explicit user intent (tray click, hotkey,
   * second-instance launch) — never for automatic paths.
   */
  show(): void {
    this.window?.show()
    this.window?.focus()
    this.applySkipTaskbar()
  }

  /**
   * Show without taking focus. Used by every automatic path (startup, auto-hide
   * re-show, programmatic `window:show`), so the widget reappearing never steals
   * the caret from whatever the user is typing in.
   */
  showInactive(): void {
    if (!this.window || this.window.isDestroyed()) return
    this.window.showInactive()
    this.applySkipTaskbar()
  }

  /**
   * Keep the widget out of the taskbar and the alt-tab switcher.
   *
   * Re-applied rather than set once: on X11 the hint is attached to the mapped
   * window, so anything that re-maps it (always-on-top level changes, workspace
   * visibility, hide/show) silently clears it.
   */
  private applySkipTaskbar(): void {
    if (!this.window || this.window.isDestroyed()) return
    this.window.setSkipTaskbar(true)
    // Showing a window without focusing it makes Mutter mark it
    // _NET_WM_STATE_DEMANDS_ATTENTION, which is what shoves the widget to the
    // front of the switcher and highlights it. The WM sets that as it maps the
    // window — i.e. after this call — so clear it now and again once the map
    // has settled.
    this.clearAttention()
    setTimeout(() => this.clearAttention(), 250)
  }

  /** Drop the "this window wants you" flag the WM adds on an unfocused show. */
  private clearAttention(): void {
    if (!this.window || this.window.isDestroyed()) return
    this.window.flashFrame(false)
  }

  hide(): void {
    this.window?.hide()
  }

  minimize(): void {
    this.window?.minimize()
  }

  setAlwaysOnTop(value: boolean): void {
    this.window?.setAlwaysOnTop(value, ALWAYS_ON_TOP_LEVEL)
    // Changing the level re-maps the window on X11, clearing the skip hint.
    this.applySkipTaskbar()
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
   * Resize the window to match the widget mode, keeping the BOTTOM-RIGHT corner
   * pinned so the box grows upward/leftward. The widget sits near the bottom of
   * the screen by default, so growing downward would push it off-screen.
   *
   * The result is clamped to the current display's work area, so expanding from
   * a spot near an edge can never leave the panel partly off-screen.
   */
  resizeForMode(mode: WidgetMode): void {
    if (!this.window) return
    this.mode = mode
    // A stuck maximized/full-screen window ignores setBounds, so clear those
    // states first — an ordinary collapse/expand then un-sticks it.
    this.unstick()
    const target = WIDGET_SIZES[mode]
    const current = this.window.getBounds()
    const { workArea } = screen.getDisplayMatching(current)
    const rightEdge = current.x + current.width
    const bottomEdge = current.y + current.height
    const x = clamp(
      Math.round(rightEdge - target.width),
      workArea.x,
      workArea.x + workArea.width - target.width
    )
    const y = clamp(
      Math.round(bottomEdge - target.height),
      workArea.y,
      workArea.y + workArea.height - target.height
    )
    // Resize instantly (no OS animation): the renderer orders the resize around
    // the content swap (see widgetStore), and a lagging macOS resize animation
    // would let full-size content paint into a still-growing window — i.e. flicker.
    this.window.setBounds({ x, y, width: target.width, height: target.height }, false)
    // The target size changed with the mode, so re-evaluate against the new one.
    this.publishOversized()
  }

  /**
   * Is the window bigger than the footprint its mode asks for? True while it is
   * maximized or full-screen, or once a manual edge-drag has grown it past its
   * size by more than a rounding wobble. Drives the reset-size button, which
   * only appears when there is actually something to reset.
   */
  isOversized(): boolean {
    if (!this.window || this.window.isDestroyed()) return false
    if (this.window.isMaximized() || this.window.isFullScreen()) return true
    const target = WIDGET_SIZES[this.mode]
    const { width, height } = this.window.getBounds()
    return width > target.width + OVERSIZE_SLACK || height > target.height + OVERSIZE_SLACK
  }

  /** Push the oversized flag to the renderer, but only when it actually flips. */
  private publishOversized(): void {
    const oversized = this.isOversized()
    if (oversized === this.lastOversized) return
    this.lastOversized = oversized
    this.send('window:oversized', oversized)
  }

  /** Anchor a pointer drag: remember where the pointer and the window started. */
  dragStart(pointer: { x: number; y: number }): void {
    if (!this.window || this.window.isDestroyed()) return
    const b = this.window.getBounds()
    this.dragOrigin = { pointer, window: { x: b.x, y: b.y } }
  }

  /** Move the window by the pointer delta since {@link dragStart}. */
  dragMove(pointer: { x: number; y: number }): void {
    if (!this.window || this.window.isDestroyed() || !this.dragOrigin) return
    const { pointer: p0, window: w0 } = this.dragOrigin
    const b = this.window.getBounds()
    this.window.setBounds(
      {
        x: Math.round(w0.x + (pointer.x - p0.x)),
        y: Math.round(w0.y + (pointer.y - p0.y)),
        width: b.width,
        height: b.height
      },
      false
    )
  }

  /** Leave maximized / full-screen / minimized state so setBounds takes effect. */
  private unstick(): void {
    if (!this.window) return
    if (this.window.isFullScreen()) this.window.setFullScreen(false)
    if (this.window.isMaximized()) this.window.unmaximize()
    if (this.window.isMinimized()) this.window.restore()
  }

  /**
   * Escape hatch for a window that has ended up maximized, full-screen or
   * dragged to an unusable size: drop those states and snap back to the current
   * mode's footprint at the top-right of the display the window is on.
   */
  resetSize(): void {
    if (!this.window || this.window.isDestroyed()) return
    this.unstick()
    const { workArea } = screen.getDisplayMatching(this.window.getBounds())
    this.window.setBounds(this.defaultBoundsFor(WIDGET_SIZES[this.mode], workArea), false)
    if (!this.window.isVisible()) this.showInactive()
    this.publishOversized()
    logger.info('window size reset', { mode: this.mode })
  }

  /** Auto-hide: hide now, re-show after `seconds` — without taking focus. */
  autoHide(seconds: number): void {
    if (!this.window) return
    logger.info('auto-hide triggered', { seconds })
    this.window.hide()
    setTimeout(() => this.showInactive(), seconds * 1000)
  }
}

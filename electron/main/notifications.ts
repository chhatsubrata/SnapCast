/**
 * Native notification helper. Honours the user's notification settings and is a
 * no-op when notifications are disabled or unsupported by the OS.
 */

import { Notification } from 'electron'
import type { NotificationSettings } from '@shared/types'
import { logger } from './logger'

export type NotificationKind =
  | 'learning-started'
  | 'learning-completed'
  | 'screenshot-detected'
  | 'high-risk'
  | 'critical-risk'
  | 'confidence-improved'

export class NotificationManager {
  private settings: NotificationSettings
  /** Per-kind cooldown so risk alerts don't spam every tick. */
  private lastShown = new Map<NotificationKind, number>()
  private cooldownMs = 20_000

  /**
   * @param onSound called when a notification is shown and sounds are enabled,
   *   so the renderer can play the bundled custom sound (the native OS sound is
   *   suppressed for a consistent tone across platforms).
   */
  constructor(
    settings: NotificationSettings,
    private readonly onSound?: () => void
  ) {
    this.settings = settings
  }

  updateSettings(settings: NotificationSettings): void {
    this.settings = settings
  }

  notify(kind: NotificationKind, title: string, body: string): void {
    if (!this.settings.enabled) return
    if (!Notification.isSupported()) return

    const now = Date.now()
    const last = this.lastShown.get(kind) ?? 0
    if (now - last < this.cooldownMs) return
    this.lastShown.set(kind, now)

    try {
      // Always silent at the OS level; we play our own sound below when enabled.
      new Notification({ title, body, silent: true }).show()
      if (this.settings.soundsEnabled) this.onSound?.()
      logger.info('notification shown', { kind })
    } catch (err) {
      logger.error('notification failed', { kind, err: String(err) })
    }
  }
}

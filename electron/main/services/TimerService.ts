/**
 * Stopwatch service.
 *
 * Counts UP from 00:00 when started and keeps running until stopped, pushing the
 * elapsed time to the renderer every second. It is the authoritative owner of
 * the timer so the count survives the window being hidden.
 *
 * It performs NO window hiding: keeping the widget out of an external tracker's
 * screenshots is handled deterministically by OS capture exclusion
 * (`WindowManager.setContentProtection`) plus a manual global hotkey — not by
 * timing. This service only measures elapsed time.
 */

import type { TimerState } from '@shared/types'
import type { WindowManager } from '../window-manager'
import { logger } from '../logger'

const TICK_MS = 1000

export class TimerService {
  private running = false
  private startedAt = 0
  private tick: NodeJS.Timeout | null = null

  constructor(private readonly windows: WindowManager) {}

  start(): TimerState {
    this.running = true
    this.startedAt = Date.now()
    if (this.tick) clearInterval(this.tick)
    this.tick = setInterval(() => this.push(), TICK_MS)
    logger.info('stopwatch started')
    return this.push()
  }

  stop(): TimerState {
    this.running = false
    if (this.tick) clearInterval(this.tick)
    this.tick = null
    logger.info('stopwatch stopped')
    return this.push()
  }

  getState(): TimerState {
    const elapsedSeconds = this.running
      ? Math.floor((Date.now() - this.startedAt) / 1000)
      : 0
    return { running: this.running, elapsedSeconds }
  }

  private push(): TimerState {
    const state = this.getState()
    this.windows.send('timer:tick', state)
    return state
  }

  dispose(): void {
    if (this.tick) clearInterval(this.tick)
    this.tick = null
  }
}

/**
 * Manual source: the user records screenshot events themselves (a button in the
 * widget, or the tray). There is nothing to watch, so start/stop are no-ops and
 * recording is driven externally via the IPC handler that calls the engine.
 */

import { SourceType, type SourceConfig } from '@shared/types'
import type { ScreenshotListener, ScreenshotSource, VerifyResult } from './types'

export class ManualSource implements ScreenshotSource {
  readonly config: SourceConfig = { type: SourceType.MANUAL }

  async start(_listener: ScreenshotListener): Promise<void> {
    // No background observation; events arrive through the manual IPC channel.
  }

  async stop(): Promise<void> {
    // Nothing to release.
  }

  async verify(): Promise<VerifyResult> {
    return {
      detected: true,
      sampleCount: 0,
      message: 'Manual mode ready — record screenshots from the widget or tray.'
    }
  }
}

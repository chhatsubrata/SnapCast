/**
 * Source factory + manager. Owns the lifecycle of the currently-active source
 * and lets the rest of the main process stay agnostic about which kind it is.
 */

import { SourceType, type SourceConfig } from '@shared/types'
import { FileWatcherSource } from './FileWatcherSource'
import { FutureSource } from './FutureSource'
import { LogWatcherSource } from './LogWatcherSource'
import { ManualSource } from './ManualSource'
import type { ScreenshotListener, ScreenshotSource, VerifyResult } from './types'

export type { ScreenshotSource, ScreenshotListener, VerifyResult } from './types'

export function createSource(config: SourceConfig): ScreenshotSource {
  switch (config.type) {
    case SourceType.FILE_WATCHER:
      return new FileWatcherSource(config)
    case SourceType.LOG_WATCHER:
      return new LogWatcherSource(config)
    case SourceType.FUTURE:
      return new FutureSource()
    case SourceType.MANUAL:
    default:
      return new ManualSource()
  }
}

/**
 * Holds at most one active source. Swapping sources cleanly stops the old one
 * before starting the new, so OS handles never leak.
 */
export class SourceManager {
  private active: ScreenshotSource | null = null
  private listener: ScreenshotListener | null = null

  setListener(listener: ScreenshotListener): void {
    this.listener = listener
  }

  getActiveConfig(): SourceConfig | null {
    return this.active?.config ?? null
  }

  async activate(config: SourceConfig): Promise<void> {
    await this.deactivate()
    const source = createSource(config)
    if (this.listener) await source.start(this.listener)
    this.active = source
  }

  async deactivate(): Promise<void> {
    if (this.active) {
      await this.active.stop()
      this.active = null
    }
  }

  async verify(config: SourceConfig): Promise<VerifyResult> {
    return createSource(config).verify()
  }
}

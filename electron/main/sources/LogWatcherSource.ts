/**
 * Log-watcher source: tails a user-selected log file and reports a screenshot
 * event when an appended line matches a configurable pattern. Read-only: it
 * opens the file for reading from the last known offset and never writes to it.
 */

import { watch, type FSWatcher } from 'node:fs'
import { open, stat } from 'node:fs/promises'
import { SourceType, type ScreenshotEvent, type SourceConfig } from '@shared/types'
import type { ScreenshotListener, ScreenshotSource, VerifyResult } from './types'

const DEFAULT_PATTERN = '(screenshot|screen[_-]?shot|capture)'

export class LogWatcherSource implements ScreenshotSource {
  readonly config: SourceConfig
  private watcher: FSWatcher | null = null
  private offset = 0
  private pattern: RegExp

  constructor(config: SourceConfig) {
    this.config = config
    this.pattern = new RegExp(config.logPattern || DEFAULT_PATTERN, 'i')
  }

  async start(listener: ScreenshotListener): Promise<void> {
    const file = this.config.path
    if (!file) throw new Error('LogWatcherSource requires a log file path')

    const info = await stat(file)
    // Start from the current end so we only react to NEW lines.
    this.offset = info.size

    this.watcher = watch(file, { persistent: true }, (eventType) => {
      if (eventType === 'change') void this.readAppended(file, listener)
    })
  }

  private async readAppended(file: string, listener: ScreenshotListener): Promise<void> {
    try {
      const info = await stat(file)
      if (info.size < this.offset) {
        // File truncated/rotated — restart from the beginning.
        this.offset = 0
      }
      if (info.size === this.offset) return

      const handle = await open(file, 'r')
      try {
        const length = info.size - this.offset
        const buffer = Buffer.alloc(length)
        await handle.read(buffer, 0, length, this.offset)
        this.offset = info.size

        const text = buffer.toString('utf8')
        for (const line of text.split(/\r?\n/)) {
          if (line && this.pattern.test(line)) {
            const event: ScreenshotEvent = {
              timestamp: Date.now(),
              source: SourceType.LOG_WATCHER,
              detail: line.slice(0, 200)
            }
            listener(event)
          }
        }
      } finally {
        await handle.close()
      }
    } catch {
      // Transient read error — will retry on the next change event.
    }
  }

  async stop(): Promise<void> {
    this.watcher?.close()
    this.watcher = null
  }

  async verify(): Promise<VerifyResult> {
    const file = this.config.path
    if (!file) {
      return { detected: false, sampleCount: 0, message: 'No log file selected.' }
    }
    try {
      const info = await stat(file)
      const handle = await open(file, 'r')
      try {
        // Sample up to the last 64KB to estimate how many lines would match.
        const sampleSize = Math.min(info.size, 64 * 1024)
        const buffer = Buffer.alloc(sampleSize)
        await handle.read(buffer, 0, sampleSize, info.size - sampleSize)
        const matches = buffer
          .toString('utf8')
          .split(/\r?\n/)
          .filter((l) => this.pattern.test(l)).length
        return {
          detected: matches > 0,
          sampleCount: matches,
          message:
            matches > 0
              ? `Log readable. Pattern matched ${matches} recent line(s).`
              : 'Log readable, but no recent lines matched the pattern. Adjust the pattern or wait.'
        }
      } finally {
        await handle.close()
      }
    } catch {
      return { detected: false, sampleCount: 0, message: 'Log file not found or not readable.' }
    }
  }
}

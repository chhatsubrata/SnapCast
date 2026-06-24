/**
 * File-watcher source: watches a user-selected folder and reports a screenshot
 * event when a new image file appears. Uses the built-in `fs.watch` (no native
 * dependency). This is read-only observation of a directory the user chose — it
 * neither opens nor modifies the image contents.
 */

import { watch, type FSWatcher } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { SourceType, type ScreenshotEvent, type SourceConfig } from '@shared/types'
import type { ScreenshotListener, ScreenshotSource, VerifyResult } from './types'

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.bmp', '.gif', '.webp', '.tiff'])

/** Debounce window: ignore repeat events for the same path within this many ms. */
const DEDUPE_MS = 1500

export class FileWatcherSource implements ScreenshotSource {
  readonly config: SourceConfig
  private watcher: FSWatcher | null = null
  private recentlySeen = new Map<string, number>()

  constructor(config: SourceConfig) {
    this.config = config
  }

  async start(listener: ScreenshotListener): Promise<void> {
    const folder = this.config.path
    if (!folder) throw new Error('FileWatcherSource requires a folder path')

    // Throws if the folder is missing/inaccessible — surfaced to the caller.
    await stat(folder)

    this.watcher = watch(folder, { persistent: true }, (eventType, filename) => {
      if (!filename) return
      if (eventType !== 'rename') return // 'rename' fires on create/delete
      void this.handleCandidate(folder, filename.toString(), listener)
    })
  }

  private async handleCandidate(
    folder: string,
    filename: string,
    listener: ScreenshotListener
  ): Promise<void> {
    if (!IMAGE_EXTENSIONS.has(extname(filename).toLowerCase())) return

    const fullPath = join(folder, filename)
    try {
      const info = await stat(fullPath) // throws if it was a delete event
      if (!info.isFile()) return

      const now = Date.now()
      const last = this.recentlySeen.get(fullPath)
      if (last && now - last < DEDUPE_MS) return
      this.recentlySeen.set(fullPath, now)
      this.pruneSeen(now)

      const event: ScreenshotEvent = {
        timestamp: now,
        source: SourceType.FILE_WATCHER,
        detail: fullPath
      }
      listener(event)
    } catch {
      // Delete event or transient FS error — nothing to record.
    }
  }

  private pruneSeen(now: number): void {
    for (const [path, ts] of this.recentlySeen) {
      if (now - ts > DEDUPE_MS * 4) this.recentlySeen.delete(path)
    }
  }

  async stop(): Promise<void> {
    this.watcher?.close()
    this.watcher = null
    this.recentlySeen.clear()
  }

  async verify(): Promise<VerifyResult> {
    const folder = this.config.path
    if (!folder) {
      return { detected: false, sampleCount: 0, message: 'No folder selected.' }
    }
    try {
      const entries = await readdir(folder)
      const images = entries.filter((f) => IMAGE_EXTENSIONS.has(extname(f).toLowerCase()))
      return {
        detected: true,
        sampleCount: images.length,
        message:
          images.length > 0
            ? `Folder accessible. Found ${images.length} existing image(s) to learn cadence from.`
            : 'Folder accessible. Waiting for the first screenshot to appear.'
      }
    } catch {
      return { detected: false, sampleCount: 0, message: 'Folder not found or not readable.' }
    }
  }
}

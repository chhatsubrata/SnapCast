/**
 * Minimal append-only file logger (no native dependency).
 *
 * Writes newline-delimited JSON to `<userData>/logs/app.log`, mirroring to the
 * console in development. Failures to log are swallowed — logging must never
 * crash the app.
 */

import { app } from 'electron'
import { appendFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export type LogLevel = 'info' | 'warn' | 'error' | 'event'

let logDir: string | null = null
let ready: Promise<void> | null = null

async function ensureDir(): Promise<void> {
  if (!logDir) logDir = join(app.getPath('userData'), 'logs')
  await mkdir(logDir, { recursive: true })
}

export function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const line = JSON.stringify({ t: new Date().toISOString(), level, message, ...meta }) + '\n'

  if (!app.isPackaged) {
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    fn(`[${level}] ${message}`, meta ?? '')
  }

  ready = (ready ?? ensureDir())
    .then(() => appendFile(join(logDir!, 'app.log'), line))
    .catch(() => {
      /* logging must never throw */
    })
}

export const logger = {
  info: (m: string, meta?: Record<string, unknown>) => log('info', m, meta),
  warn: (m: string, meta?: Record<string, unknown>) => log('warn', m, meta),
  error: (m: string, meta?: Record<string, unknown>) => log('error', m, meta),
  event: (m: string, meta?: Record<string, unknown>) => log('event', m, meta)
}

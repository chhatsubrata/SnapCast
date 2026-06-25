/**
 * Resolve bundled image assets (app icon, tray icon) to an on-disk path that
 * exists in BOTH dev and packaged builds.
 *
 * In packaged builds `resources/**` is unpacked from the asar (see
 * electron-builder.yml `asarUnpack`), so the files live under
 * `<resourcesPath>/app.asar.unpacked/resources/`, NOT at `<resourcesPath>/`.
 * Pointing at `<resourcesPath>/<name>` silently misses and forces icon
 * fallbacks (e.g. an invisible tray glyph on dark panels). Probe the real
 * candidate locations and return the first that exists.
 */

import { app } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/** Absolute path to a `resources/<name>` asset, or null if none is found. */
export function resolveResource(name: string): string | null {
  const candidates = app.isPackaged
    ? [
        join(process.resourcesPath, 'app.asar.unpacked', 'resources', name),
        join(process.resourcesPath, name)
      ]
    : [join(__dirname, '../../resources', name)]
  return candidates.find(existsSync) ?? null
}

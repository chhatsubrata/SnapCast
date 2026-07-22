/**
 * Exports the Workweek Animals pixel pack as transparent PNGs.
 *
 * Reads the same `src/components/pets/sprites.json` the app renders from, so the
 * exported art can never drift from what ships in the widget. Scaling is pure
 * nearest-neighbour block fill — no interpolation, no anti-aliasing, so the
 * output stays crisp pixel art at every size.
 *
 * Usage:
 *   node scripts/generate-pets.mjs            # one pose per animal + sheet + preview
 *   node scripts/generate-pets.mjs --frames   # also every animation frame
 *
 * Output (resources/pets/):
 *   <id>-32.png / -64.png / -128.png   individual sprites, bottom-centred on a square canvas
 *   sheet-64.png                       horizontal sprite sheet, Mon -> Sun
 *   preview-128.png                    the same seven, side by side, for docs
 *   frames/<id>-<frame>-64.png         with --frames
 */

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { encodePng } from './lib/png.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SPRITES = JSON.parse(readFileSync(join(root, 'src/components/pets/sprites.json'), 'utf8'))
const OUT_DIR = join(root, 'resources/pets')

const GRID_W = 16
const GRID_H = 13
const FRAMES = ['frameA', 'frameB', 'idle', 'wave', 'sleep']
/** Sheet/preview order: Monday first, Sunday last — the workweek reading order. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

function hexToRgba(hex) {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
    255
  ]
}

/** Colour for one grid character, or null for transparent. */
function cellColor(char, palette) {
  if (char === '.') return null
  if (char === '-') return palette['E'] ?? null
  return palette[char] ?? null
}

/** An empty (fully transparent) RGBA canvas. */
function canvas(width, height) {
  return Buffer.alloc(width * height * 4)
}

/**
 * Blit one 16x13 grid onto `buf` at `scale`, with its bottom edge on the canvas
 * bottom and horizontally centred in a `cellW`-wide column starting at `originX`.
 */
function blit(buf, bufWidth, bufHeight, grid, palette, scale, originX, cellW) {
  const artW = GRID_W * scale
  const artH = GRID_H * scale
  const offsetX = originX + Math.round((cellW - artW) / 2)
  const offsetY = bufHeight - artH

  for (let y = 0; y < GRID_H; y++) {
    const row = grid[y]
    for (let x = 0; x < GRID_W; x++) {
      const color = cellColor(row[x], palette)
      if (!color) continue
      const [r, g, b, a] = hexToRgba(color)
      for (let dy = 0; dy < scale; dy++) {
        const py = offsetY + y * scale + dy
        if (py < 0 || py >= bufHeight) continue
        for (let dx = 0; dx < scale; dx++) {
          const px = offsetX + x * scale + dx
          if (px < 0 || px >= bufWidth) continue
          const i = (py * bufWidth + px) * 4
          buf[i] = r
          buf[i + 1] = g
          buf[i + 2] = b
          buf[i + 3] = a
        }
      }
    }
  }
}

function write(relPath, width, height, pixels) {
  const full = join(root, relPath)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, encodePng(width, height, pixels))
  console.log('wrote', relPath, `${width}x${height}`)
}

/** One sprite, bottom-centred on a square `size` canvas. */
function writeSprite(sprite, frame, size, relPath) {
  // The grid is 16 wide, so the scale that fits a square canvas is size/16.
  const scale = Math.max(1, Math.floor(size / GRID_W))
  const buf = canvas(size, size)
  blit(buf, size, size, sprite[frame], sprite.palette, scale, 0, size)
  write(relPath, size, size, buf)
}

mkdirSync(OUT_DIR, { recursive: true })

// Sheet order: the workweek Mon -> Sun first, then the bonus mascots (which have
// no weekday and only show up in the hourly rotation).
const byWeekday = new Map(SPRITES.filter((s) => s.weekday !== null).map((s) => [s.weekday, s]))
const week = WEEK_ORDER.map((d) => byWeekday.get(d))
if (week.some((s) => !s)) {
  throw new Error('sprites.json is missing a weekday (expected 0-6)')
}
const ordered = [...week, ...SPRITES.filter((s) => s.weekday === null)]

// 1. Individual sprites.
for (const sprite of SPRITES) {
  for (const size of [32, 64, 128]) {
    writeSprite(sprite, 'frameA', size, `resources/pets/${sprite.id}-${size}.png`)
  }
}

// 2. Horizontal sprite sheet, one cell per animal.
for (const [name, cell] of [
  ['sheet-64', 64],
  ['preview-128', 128]
]) {
  const scale = Math.max(1, Math.floor(cell / GRID_W))
  const width = cell * ordered.length
  const height = cell
  const buf = canvas(width, height)
  ordered.forEach((sprite, i) => {
    blit(buf, width, height, sprite.frameA, sprite.palette, scale, i * cell, cell)
  })
  write(`resources/pets/${name}.png`, width, height, buf)
}

// 3. Optional: every animation frame, for reference sheets.
if (process.argv.includes('--frames')) {
  for (const sprite of SPRITES) {
    for (const frame of FRAMES) {
      writeSprite(sprite, frame, 64, `resources/pets/frames/${sprite.id}-${frame}-64.png`)
    }
  }
}

console.log(`pets generated (${SPRITES.length} sprites)`)

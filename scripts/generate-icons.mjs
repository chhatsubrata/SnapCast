/**
 * Dependency-free PNG icon generator.
 *
 * Produces the app + tray icons procedurally so the repo needs no binary
 * assets checked in. Run via `pnpm icons`. Draws a rounded-square badge with a
 * sky-blue gradient and a white progress-ring motif (matching the widget).
 */

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePng(size, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  // raw scanlines with filter byte 0
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = deflateSync(raw)
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ])
}

function draw(size) {
  const px = Buffer.alloc(size * size * 4)
  const r = size * 0.22 // corner radius
  const cx = size / 2
  const cy = size / 2
  const ringR = size * 0.3
  const ringW = size * 0.09

  const inRounded = (x, y) => {
    const dx = Math.min(x, size - x)
    const dy = Math.min(y, size - y)
    if (dx >= r && dy >= r) return true
    if (dx >= r || dy >= r) return x >= 0 && y >= 0
    const ddx = r - dx
    const ddy = r - dy
    return ddx * ddx + ddy * ddy <= r * r
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      if (!inRounded(x + 0.5, y + 0.5)) {
        px[i + 3] = 0
        continue
      }
      // vertical gradient sky-500 -> indigo-500
      const t = y / size
      const rC = Math.round(14 + (99 - 14) * t)
      const gC = Math.round(165 + (102 - 165) * t)
      const bC = Math.round(233 + (241 - 233) * t)
      px[i] = rC
      px[i + 1] = gC
      px[i + 2] = bC
      px[i + 3] = 255

      // white ring (270deg arc) overlay
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (Math.abs(dist - ringR) <= ringW / 2) {
        const ang = (Math.atan2(dy, dx) + Math.PI * 2.5) % (Math.PI * 2)
        if (ang < Math.PI * 1.6) {
          px[i] = 255
          px[i + 1] = 255
          px[i + 2] = 255
        }
      }
    }
  }
  return px
}

function write(path, size) {
  const full = join(root, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, encodePng(size, draw(size)))
  console.log('wrote', path, `${size}x${size}`)
}

write('resources/icon.png', 512)
write('resources/tray.png', 32)
write('build/icon.png', 512)

// Linux deb/AppImage need a full set of standard hicolor sizes. Supplying a
// single icon.png makes electron-builder emit only that one resolution, which
// many Linux menus (GNOME/KDE/XFCE) ignore if it's a non-standard size like
// 1024x1024 — leaving the app with a blank/generic icon. Emit the standard set
// into build/icons/ (named <size>x<size>.png) and point linux.icon there.
for (const size of [16, 24, 32, 48, 64, 128, 256, 512]) {
  write(`build/icons/${size}x${size}.png`, size)
}
console.log('icons generated')

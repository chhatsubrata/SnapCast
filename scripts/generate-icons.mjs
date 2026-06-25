/**
 * Dependency-free PNG icon generator.
 *
 * Resizes the master app image (resources/icon-master.png) into every icon
 * size the app + installers need. Pure JS — no native deps (sharp/ImageMagick)
 * so `pnpm install` (postinstall) works on any machine. Decodes the master PNG
 * (inflate + unfilter), area-averages it down to each target size, and
 * re-encodes with the encoder below.
 */

import { deflateSync, inflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const MASTER = join(root, 'resources/icon-master.png')

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

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

/** Decode an 8-bit non-interlaced PNG (color type 2/RGB or 6/RGBA) to RGBA. */
function decodePng(buf) {
  let p = 8 // skip signature
  let width = 0
  let height = 0
  let colorType = 0
  const idat = []
  while (p < buf.length) {
    const len = buf.readUInt32BE(p)
    const type = buf.toString('ascii', p + 4, p + 8)
    const data = buf.subarray(p + 8, p + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      const bitDepth = data[8]
      colorType = data[9]
      const interlace = data[12]
      if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`)
      if (colorType !== 2 && colorType !== 6)
        throw new Error(`unsupported color type ${colorType}`)
      if (interlace !== 0) throw new Error('interlaced PNG unsupported')
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
    p += 12 + len
  }

  const channels = colorType === 6 ? 4 : 3
  const bpp = channels
  const stride = width * bpp
  const raw = inflateSync(Buffer.concat(idat))
  const cur = Buffer.alloc(stride)
  const prev = Buffer.alloc(stride)
  const out = Buffer.alloc(width * height * 4)

  let off = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[off++]
    raw.copy(cur, 0, off, off + stride)
    off += stride
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0
      const b = prev[i]
      const c = i >= bpp ? prev[i - bpp] : 0
      let v = cur[i]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) v += paeth(a, b, c)
      cur[i] = v & 0xff
    }
    for (let x = 0; x < width; x++) {
      const si = x * bpp
      const di = (y * width + x) * 4
      out[di] = cur[si]
      out[di + 1] = cur[si + 1]
      out[di + 2] = cur[si + 2]
      out[di + 3] = channels === 4 ? cur[si + 3] : 255
    }
    cur.copy(prev)
  }
  return { width, height, pixels: out }
}

/** Area-average resize (premultiplied alpha) from src RGBA to size x size. */
function resize(src, size) {
  const { width: sw, height: sh, pixels: sp } = src
  const out = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    const sy0 = Math.floor((y * sh) / size)
    const sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) * sh) / size))
    for (let x = 0; x < size; x++) {
      const sx0 = Math.floor((x * sw) / size)
      const sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) * sw) / size))
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let n = 0
      for (let yy = sy0; yy < sy1; yy++) {
        for (let xx = sx0; xx < sx1; xx++) {
          const si = (yy * sw + xx) * 4
          const al = sp[si + 3]
          r += sp[si] * al
          g += sp[si + 1] * al
          b += sp[si + 2] * al
          a += al
          n++
        }
      }
      const di = (y * size + x) * 4
      if (a > 0) {
        out[di] = Math.round(r / a)
        out[di + 1] = Math.round(g / a)
        out[di + 2] = Math.round(b / a)
        out[di + 3] = Math.round(a / n)
      } else {
        out[di + 3] = 0
      }
    }
  }
  return out
}

const master = decodePng(readFileSync(MASTER))

function write(path, size) {
  const full = join(root, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, encodePng(size, resize(master, size)))
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

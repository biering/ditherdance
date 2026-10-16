// Renders the README gallery to docs/gallery/*.png with the CPU renderer.
// Run after a build: npm run build && node scripts/gallery.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { normalize, renderPixels } from '../dist/gradient/index.js'

const TILES = [
  { file: 'ada', options: { name: 'ada@example.com' } },
  { file: 'grace', options: { name: 'grace' } },
  { file: 'linus', options: { name: 'linus' } },
  { file: 'margaret', options: { name: 'margaret' } },
  { file: 'ember', options: { preset: 'ember' } },
  { file: 'lagoon', options: { preset: 'lagoon' } },
  { file: 'prism', options: { preset: 'prism' } },
  { file: 'newsprint', options: { preset: 'newsprint' } },
]

// One dither cell becomes CELL x CELL pixels, like pixelSize on a 1x screen.
const COLS = 120
const ROWS = 80
const CELL = 3

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

function png(rgba, width, height) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr.set([8, 6, 0, 0, 0], 8) // 8-bit RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // no filter
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function upscale(cells, cols, rows, scale) {
  const w = cols * scale
  const out = Buffer.alloc(w * rows * scale * 4)
  for (let y = 0; y < rows * scale; y++) {
    for (let x = 0; x < w; x++) {
      const src = (((y / scale) | 0) * cols + ((x / scale) | 0)) * 4
      out.set(cells.subarray(src, src + 4), (y * w + x) * 4)
    }
  }
  return out
}

const dir = new URL('../docs/gallery/', import.meta.url)
mkdirSync(dir, { recursive: true })
for (const { file, options } of TILES) {
  const cells = renderPixels(normalize(options), COLS, ROWS)
  const image = upscale(cells, COLS, ROWS, CELL)
  writeFileSync(new URL(`${file}.png`, dir), png(image, COLS * CELL, ROWS * CELL))
  console.log(`docs/gallery/${file}.png`)
}

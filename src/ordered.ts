import { assertPixels, clampByte, grayLookup, type Pixels } from './image.js'
import { BLACK_WHITE, compile, isGray, luma, type Palette } from './palette.js'

export type BayerSize = 2 | 4 | 8 | 16

const cache = new Map<number, Float32Array>()

/**
 * The Bayer threshold matrix of a given size, row by row, as offsets from
 * -0.5 to 0.5. Built by the usual recursion and cached, so asking twice is free.
 */
export function bayer(size: BayerSize): Float32Array {
  const hit = cache.get(size)
  if (hit) return hit
  if (![2, 4, 8, 16].includes(size)) throw new RangeError(`bayer size must be 2, 4, 8 or 16, got ${size}`)
  let m = [0]
  let n = 1
  while (n < size) {
    const next = new Array<number>(4 * n * n)
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = 4 * (m[y * n + x] as number)
        next[y * 2 * n + x] = v
        next[y * 2 * n + x + n] = v + 2
        next[(y + n) * 2 * n + x] = v + 3
        next[(y + n) * 2 * n + x + n] = v + 1
      }
    }
    m = next
    n *= 2
  }
  const area = size * size
  const out = Float32Array.from(m, (v) => (v + 0.5) / area - 0.5)
  cache.set(size, out)
  return out
}

export interface OrderedOptions {
  /** Defaults to black and white. */
  palette?: Palette
  /** The Bayer matrix size. Bigger gives more distinct tones. Defaults to 4. */
  size?: BayerSize
  /**
   * How far the threshold pattern pushes a value, in 0..255 units. Defaults to
   * the gap between palette greys, or 64 for a colour palette.
   */
  spread?: number
}

/**
 * Ordered (Bayer) dithering, in place. Every pixel is decided on its own,
 * with no state carried between pixels, so it is the fastest method here,
 * stable from frame to frame in animation, and the same maths runs per pixel
 * in a GPU shader. Alpha is left untouched. Returns the same image.
 */
export function ordered<T extends Pixels>(image: T, options: OrderedOptions = {}): T {
  assertPixels(image)
  const { data, width, height } = image
  const palette = options.palette ?? BLACK_WHITE
  const size = options.size ?? 4
  const matrix = bayer(size)
  const mask = size - 1
  const compiled = compile(palette)

  if (isGray(palette)) {
    const lut = grayLookup(compiled.r)
    const spread = options.spread ?? 255 / Math.max(1, compiled.size - 1)
    for (let y = 0, p = 0; y < height; y++) {
      const row = (y & mask) * size
      for (let x = 0; x < width; x++, p += 4) {
        const v = luma(data[p] as number, data[p + 1] as number, data[p + 2] as number)
        const next = lut[clampByte(v + (matrix[row + (x & mask)] as number) * spread)] as number
        data[p] = data[p + 1] = data[p + 2] = next
      }
    }
    return image
  }

  const spread = options.spread ?? 64
  for (let y = 0, p = 0; y < height; y++) {
    const row = (y & mask) * size
    for (let x = 0; x < width; x++, p += 4) {
      const t = (matrix[row + (x & mask)] as number) * spread
      const k = compiled.nearest(
        (data[p] as number) + t,
        (data[p + 1] as number) + t,
        (data[p + 2] as number) + t,
      )
      data[p] = compiled.r[k] as number
      data[p + 1] = compiled.g[k] as number
      data[p + 2] = compiled.b[k] as number
    }
  }
  return image
}

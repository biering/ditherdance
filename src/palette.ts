/** An sRGB colour, each channel 0 to 255. */
export type Rgb = readonly [number, number, number]

/** The colours a dithered image may use. */
export type Palette = readonly Rgb[]

/** Black and white. */
export const BLACK_WHITE: Palette = [
  [0, 0, 0],
  [255, 255, 255],
]

/** The four greens of the original Game Boy. */
export const GAME_BOY: Palette = [
  [15, 56, 15],
  [48, 98, 48],
  [139, 172, 15],
  [155, 188, 15],
]

/** `levels` evenly spaced greys from black to white. */
export function grayscale(levels = 2): Palette {
  if (!Number.isInteger(levels) || levels < 2 || levels > 256) {
    throw new RangeError(`grayscale levels must be an integer from 2 to 256, got ${levels}`)
  }
  const out: Rgb[] = []
  for (let i = 0; i < levels; i++) {
    const v = Math.round((i * 255) / (levels - 1))
    out.push([v, v, v])
  }
  return out
}

/** `#0f380f` or `#fff` to `[15, 56, 15]`. */
export function hex(value: string): Rgb {
  let h = value.replace(/^#/, '')
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new SyntaxError(`not a hex colour: ${value}`)
  const n = Number.parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** True when every colour is a grey, which lets dithering run on one channel. */
export function isGray(palette: Palette): boolean {
  return palette.every(([r, g, b]) => r === g && g === b)
}

/** Rec. 709 luma of an sRGB colour, 0 to 255. */
export function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * A palette flattened for the hot loop: one typed array per channel and a
 * nearest-colour search with no allocation.
 */
export interface CompiledPalette {
  readonly size: number
  readonly r: Float32Array
  readonly g: Float32Array
  readonly b: Float32Array
  /** Index of the colour nearest to (r, g, b), by squared distance. */
  nearest(r: number, g: number, b: number): number
}

export function compile(palette: Palette): CompiledPalette {
  if (palette.length === 0) throw new RangeError('a palette needs at least one colour')
  const size = palette.length
  const pr = new Float32Array(size)
  const pg = new Float32Array(size)
  const pb = new Float32Array(size)
  palette.forEach(([r, g, b], i) => {
    pr[i] = r
    pg[i] = g
    pb[i] = b
  })
  return {
    size,
    r: pr,
    g: pg,
    b: pb,
    nearest(r, g, b) {
      let best = 0
      let bestDistance = Number.POSITIVE_INFINITY
      for (let i = 0; i < size; i++) {
        const dr = r - (pr[i] as number)
        const dg = g - (pg[i] as number)
        const db = b - (pb[i] as number)
        const d = dr * dr + dg * dg + db * db
        if (d < bestDistance) {
          bestDistance = d
          best = i
        }
      }
      return best
    },
  }
}

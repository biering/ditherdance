import { describe, expect, it } from 'vitest'
import {
  BLACK_WHITE,
  bayer,
  diffuse,
  dither,
  GAME_BOY,
  grayscale,
  hex,
  KERNELS,
  type Method,
  ordered,
  type Pixels,
} from './index.js'

function flat(width: number, height: number, rgba: [number, number, number, number]): Pixels {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let p = 0; p < data.length; p += 4) data.set(rgba, p)
  return { data, width, height }
}

function gradient(width: number, height: number): Pixels {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4
      const v = Math.round((x / (width - 1)) * 255)
      data.set([v, v, v, 255], p)
    }
  }
  return { data, width, height }
}

function meanRed({ data }: Pixels): number {
  let sum = 0
  for (let p = 0; p < data.length; p += 4) sum += data[p] as number
  return sum / (data.length / 4)
}

function colours({ data }: Pixels): Set<string> {
  const out = new Set<string>()
  for (let p = 0; p < data.length; p += 4) out.add(`${data[p]},${data[p + 1]},${data[p + 2]}`)
  return out
}

const METHODS: Method[] = [...(Object.keys(KERNELS) as Method[]), 'bayer']

describe('palettes', () => {
  it('spaces grey levels evenly from black to white', () => {
    expect(grayscale(3)).toEqual([
      [0, 0, 0],
      [128, 128, 128],
      [255, 255, 255],
    ])
  })

  it('refuses a palette of fewer than two greys', () => {
    expect(() => grayscale(1)).toThrow(RangeError)
  })

  it('reads short and long hex', () => {
    expect(hex('#fff')).toEqual([255, 255, 255])
    expect(hex('0f380f')).toEqual([15, 56, 15])
    expect(() => hex('#ggg')).toThrow(SyntaxError)
  })
})

describe('bayer', () => {
  it('is the textbook 2x2 matrix', () => {
    expect([...bayer(2)]).toEqual([0.5 / 4 - 0.5, 2.5 / 4 - 0.5, 3.5 / 4 - 0.5, 1.5 / 4 - 0.5])
  })

  it('uses every threshold exactly once', () => {
    for (const size of [2, 4, 8, 16] as const) {
      const sorted = [...bayer(size)].sort((a, b) => a - b)
      const area = size * size
      sorted.forEach((v, i) => expect(v).toBeCloseTo((i + 0.5) / area - 0.5))
    }
  })
})

describe('every method', () => {
  it.each(METHODS)('%s keeps a mid grey at about half brightness', (method) => {
    const image = dither(flat(64, 64, [128, 128, 128, 255]), { method })
    expect(meanRed(image)).toBeGreaterThan(128 - 20)
    expect(meanRed(image)).toBeLessThan(128 + 20)
  })

  it.each(METHODS)('%s only ever writes palette colours', (method) => {
    const image = dither(gradient(97, 13), { method, palette: grayscale(4) })
    const allowed = new Set(grayscale(4).map((c) => c.join(',')))
    for (const c of colours(image)) expect(allowed.has(c)).toBe(true)
  })

  it.each(METHODS)('%s leaves alpha alone', (method) => {
    const image = dither(flat(8, 8, [90, 90, 90, 37]), { method })
    for (let p = 3; p < image.data.length; p += 4) expect(image.data[p]).toBe(37)
  })

  it.each(METHODS)('%s maps colour into a colour palette', (method) => {
    const image = dither(flat(16, 16, [100, 160, 40, 255]), { method, palette: GAME_BOY })
    const allowed = new Set(GAME_BOY.map((c) => c.join(',')))
    for (const c of colours(image)) expect(allowed.has(c)).toBe(true)
  })
})

describe('diffuse', () => {
  it('keeps the average tone of a gradient', () => {
    const before = meanRed(gradient(256, 32))
    expect(Math.abs(meanRed(diffuse(gradient(256, 32))) - before)).toBeLessThan(4)
  })

  it('leaves pure black and white untouched', () => {
    const black = diffuse(flat(4, 4, [0, 0, 0, 255]))
    expect(colours(black)).toEqual(new Set(['0,0,0']))
  })

  it('passes on less with a lower strength', () => {
    const full = colours(diffuse(gradient(64, 8), { palette: BLACK_WHITE }))
    const none = diffuse(gradient(64, 8), { strength: 0 })
    // With no error carried, it is a plain threshold: one run of black, one of white.
    const firstRow = [...none.data.slice(0, 64 * 4)].filter((_, i) => i % 4 === 0)
    const flips = firstRow.filter((v, i) => i > 0 && v !== firstRow[i - 1]).length
    expect(flips).toBe(1)
    expect(full.size).toBe(2)
  })

  it('returns the image it was given, for chaining', () => {
    const image = flat(2, 2, [10, 10, 10, 255])
    expect(diffuse(image)).toBe(image)
  })

  it('refuses a buffer that does not match its size', () => {
    expect(() => diffuse({ data: new Uint8ClampedArray(3), width: 1, height: 1 })).toThrow(
      RangeError,
    )
  })
})

describe('ordered', () => {
  it('draws the same pattern for the same input, so animation does not shimmer', () => {
    const a = ordered(gradient(40, 40), { size: 8 })
    const b = ordered(gradient(40, 40), { size: 8 })
    expect(a.data).toEqual(b.data)
  })

  it('tiles the threshold matrix', () => {
    const image = ordered(flat(8, 8, [128, 128, 128, 255]), { size: 4 })
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const at = (yy: number, xx: number) => image.data[(yy * 8 + xx) * 4]
        expect(at(y, x)).toBe(at(y + 4, x + 4))
      }
    }
  })
})

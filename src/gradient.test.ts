import { describe, expect, it } from 'vitest'
import { labToRgb, parseColor, rgbToLab, toHex } from './gradient/color.js'
import { bayer2, bayer4, bayer8, renderPixels } from './gradient/cpu.js'
import { lookFromName, normalizeName, resolveTraits, TRAIT_KEYS } from './gradient/name.js'
import { normalize, resolveOptions } from './gradient/options.js'
import { PRESET_NAMES } from './gradient/presets.js'

describe('color', () => {
  it('parses hex and rgb() without a browser', () => {
    expect(parseColor('#fff')).toEqual([1, 1, 1])
    expect(toHex(parseColor('#ff8000'))).toBe('#ff8000')
    expect(toHex(parseColor('rgb(255, 128, 0)'))).toBe('#ff8000')
  })

  it('round-trips through OKLab', () => {
    for (const hex of ['#000000', '#ffffff', '#3b2bf2', '#ff4b0d', '#2ed8ee']) {
      expect(toHex(labToRgb(rgbToLab(parseColor(hex))))).toBe(hex)
    }
  })
})

describe('bayer', () => {
  // Every threshold appears exactly once per tile, or the pattern is biased.
  it.each([
    [bayer2, 2],
    [bayer4, 4],
    [bayer8, 8],
  ])('%o tiles a permutation of 0..n²-1', (fn, n) => {
    const seen = new Set<number>()
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) seen.add(Math.round(fn(x, y) * n * n))
    expect([...seen].sort((a, b) => a - b)).toEqual([...Array(n * n).keys()])
  })
})

describe('names', () => {
  it('normalizes before hashing', () => {
    expect(normalizeName('  Ada@Example.com ')).toBe('ada@example.com')
    expect(lookFromName('Ada@Example.com')).toEqual(lookFromName('ada@example.com'))
    expect(lookFromName('café')).toEqual(lookFromName('café'))
  })

  it('is deterministic and varies between names', () => {
    expect(lookFromName('ada').options).toEqual(lookFromName('ada').options)
    expect(lookFromName('ada').options.colors).not.toEqual(lookFromName('grace').options.colors)
  })

  it('keeps every trait in 0..1', () => {
    for (const name of ['a', 'ada', '日本語', '🦊', '']) {
      const t = resolveTraits(name)
      for (const key of TRAIT_KEYS) {
        expect(t[key]).toBeGreaterThanOrEqual(0)
        expect(t[key]).toBeLessThan(1)
      }
    }
  })

  it('pins a trait to a value or to a list', () => {
    expect(resolveTraits('ada', { traits: { hue: 0.25 } }).hue).toBe(0.25)
    const picks = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(
        (n) => resolveTraits(n, { traits: { tone: [0.1, 0.9] } }).tone,
      ),
    )
    expect([...picks].every((v) => v === 0.1 || v === 0.9)).toBe(true)
  })

  it('lets explicit options win over the name', () => {
    const o = resolveOptions({ name: 'ada', warp: 0.9, colors: ['#000', '#fff'] })
    expect(o.warp).toBe(0.9)
    expect(o.colors).toEqual(['#000', '#fff'])
  })

  it('makes drips rare', () => {
    let drips = 0
    for (let i = 0; i < 2000; i++) if (lookFromName(`user${i}`).options.streak) drips++
    expect(drips / 2000).toBeGreaterThan(0.12)
    expect(drips / 2000).toBeLessThan(0.28)
  })
})

describe('renderPixels', () => {
  it('renders every preset without NaN', () => {
    for (const preset of PRESET_NAMES) {
      const px = renderPixels(normalize({ preset }), 24, 16)
      expect(px.length).toBe(24 * 16 * 4)
      expect(px.every((v) => Number.isFinite(v))).toBe(true)
    }
  })

  it('quantizes each channel to `levels` steps', () => {
    const px = renderPixels(normalize({ name: 'ada', levels: 3 }), 40, 30)
    const allowed = new Set([0, 128, 255])
    for (let i = 0; i < px.length; i += 4) {
      for (let c = 0; c < 3; c++) expect(allowed.has(px[i + c] ?? -1)).toBe(true)
    }
  })

  it('only emits palette colors in palette mode', () => {
    const px = renderPixels(normalize({ name: 'ada', palette: ['#111111', '#f2efe7'] }), 40, 30)
    const seen = new Set<string>()
    for (let i = 0; i < px.length; i += 4) seen.add(`${px[i]},${px[i + 1]},${px[i + 2]}`)
    expect([...seen].sort()).toEqual(['17,17,17', '242,239,231'])
  })

  it('is the same picture for the same name', () => {
    const a = renderPixels(normalize({ name: 'ada' }), 32, 20)
    const b = renderPixels(normalize({ name: 'ada' }), 32, 20)
    expect(a).toEqual(b)
  })
})

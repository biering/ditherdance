import { labToLinear, labToRgb, type RGB, toHex } from './color.js'
import type { ColorStop, GradientOptions } from './options.js'
import { lerp, mulberry32 } from './util.js'

/**
 * Every axis a name decides. Each is a 0..1 position read through its own range,
 * hashed by key rather than drawn from one stream, so adding a trait later
 * cannot change what existing names look like.
 */
export const TRAIT_KEYS = [
  'hue',
  'scheme',
  'tone',
  'chroma',
  'count',
  'layout',
  'softness',
  'warp',
  'warpScale',
  'streak',
  'streakAngle',
] as const

export type TraitKey = (typeof TRAIT_KEYS)[number]

/** A fixed 0..1 position, or a list the name chooses from. */
export type TraitPin = number | number[]

export interface NameOptions {
  /** Pin traits instead of hashing them. Keys you leave out still come from the name. */
  traits?: Partial<Record<TraitKey, TraitPin>>
  /** NFC-normalize, trim and lowercase before hashing (default true). */
  normalizeName?: boolean
}

const encoder = new TextEncoder()

/** cyrb53 over UTF-8 bytes, so every engine agrees on astral and accented names. */
function hash53(input: string): number {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (const byte of encoder.encode(input)) {
    h1 = Math.imul(h1 ^ byte, 2654435761)
    h2 = Math.imul(h2 ^ byte, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

/** A stable 0..1 value for one trait of one name. */
export function traitValue(name: string, key: string): number {
  return hash53(`${key}\u0001${name}`) / 2 ** 53
}

export function normalizeName(name: string): string {
  return name.normalize('NFC').trim().toLowerCase()
}

export type Traits = Record<TraitKey, number>

/** The 0..1 position of every trait for this name, pins applied. */
export function resolveTraits(name: string, options: NameOptions = {}): Traits {
  const n = options.normalizeName === false ? name : normalizeName(name)
  const out = {} as Traits
  for (const key of TRAIT_KEYS) {
    const pin = options.traits?.[key]
    const hashed = traitValue(n, key)
    if (typeof pin === 'number') out[key] = Math.min(0.999999, Math.max(0, pin))
    else if (Array.isArray(pin) && pin.length > 0) out[key] = pin[Math.floor(hashed * pin.length)] ?? hashed
    else out[key] = hashed
  }
  return out
}

/** Picks from weighted buckets: `[[0.4, 'a'], [1, 'b']]` reads as 40 % a, 60 % b. */
function bucket<T>(v: number, table: [number, T][]): T {
  for (const [edge, value] of table) if (v < edge) return value
  return (table[table.length - 1] as [number, T])[1]
}

export const SCHEMES = ['analogous', 'complementary', 'split', 'mono', 'triad'] as const
export const TONES = ['night', 'dusk', 'day'] as const

export type Scheme = (typeof SCHEMES)[number]
export type Tone = (typeof TONES)[number]

/** Bucket edges, exported so the editor can draw them and tests can pin them. */
export const SCHEME_EDGES: [number, Scheme][] = [
  [0.34, 'analogous'],
  [0.6, 'complementary'],
  [0.78, 'split'],
  [0.9, 'mono'],
  [1, 'triad'],
]
export const TONE_EDGES: [number, Tone][] = [
  [0.42, 'night'],
  [0.76, 'dusk'],
  [1, 'day'],
]

const HUE_OFFSETS: Record<Scheme, number[]> = {
  analogous: [0, 34, -30, 16, -14],
  complementary: [0, 180, 18, 196, -12],
  split: [0, 150, 212, 10, 160],
  mono: [0, 0, 6, -6, 0],
  triad: [0, 120, 240, 12, 132],
}

// Lightness and chroma of each role, in OKLCH. The look depends on a near-black,
// a vivid middle and a pale highlight sharing one field.
const ROLES = {
  ink: [0.13, 0.025],
  deep: [0.34, 0.12],
  vivid: [0.62, 0.22],
  bright: [0.8, 0.15],
  pale: [0.95, 0.035],
} as const
type Role = keyof typeof ROLES

const TONE_ROLES: Record<Tone, Role[]> = {
  night: ['ink', 'vivid', 'deep', 'bright', 'ink'],
  dusk: ['ink', 'vivid', 'pale', 'bright', 'deep'],
  day: ['pale', 'vivid', 'bright', 'pale', 'deep'],
}

/** OKLCH to sRGB, pulling chroma in until the color fits the gamut. */
export function oklch(l: number, c: number, hueDeg: number): RGB {
  const h = (hueDeg * Math.PI) / 180
  const inGamut = (chroma: number) => {
    const rgb = labToLinear([l, chroma * Math.cos(h), chroma * Math.sin(h)])
    return rgb.every((v) => v >= -0.001 && v <= 1.001)
  }
  let lo = 0
  let hi = c
  if (!inGamut(hi)) {
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2
      if (inGamut(mid)) lo = mid
      else hi = mid
    }
    hi = lo
  }
  return labToRgb([l, hi * Math.cos(h), hi * Math.sin(h)])
}

/** What a name reads as, in human terms. Handy for the editor and for tests. */
export interface NameLook {
  traits: Traits
  scheme: Scheme
  tone: Tone
  options: GradientOptions
}

/** Turns a name into the shape-and-color part of the options. */
export function lookFromName(name: string, options: NameOptions = {}): NameLook {
  const t = resolveTraits(name, options)
  const scheme = bucket(t.scheme, SCHEME_EDGES)
  const tone = bucket(t.tone, TONE_EDGES)
  const count = bucket(t.count, [
    [0.3, 3],
    [0.75, 4],
    [1, 5],
  ])
  const hue = t.hue * 360
  const chroma = lerp(0.55, 1.15, t.chroma)

  // Positions come from the layout trait alone, so pinning it fixes the layout
  // for every name while the colors still vary.
  const rand = mulberry32(Math.floor(t.layout * 2 ** 31))
  const colors: ColorStop[] = TONE_ROLES[tone].slice(0, count).map((role, i) => {
    const [l, c] = ROLES[role]
    return {
      color: toHex(oklch(l, c * chroma, hue + (HUE_OFFSETS[scheme][i] ?? 0))),
      x: 0.06 + rand() * 0.88,
      y: 0.06 + rand() * 0.88,
    }
  })

  // Drips are a find, not the norm: four names in five get none.
  const streak = t.streak < 0.8 ? 0 : lerp(0.18, 0.55, (t.streak - 0.8) / 0.2)
  const streakAngle = bucket(t.streakAngle, [
    [0.55, 90],
    [0.75, 270],
    [0.88, 60],
    [1, 120],
  ])

  return {
    traits: t,
    scheme,
    tone,
    options: {
      colors,
      seed: Math.floor(traitValue(normalizeName(name), 'seed') * 1e6),
      softness: lerp(0.2, 0.55, t.softness),
      warp: lerp(0.04, 0.4, t.warp),
      warpScale: lerp(0.5, 1.6, t.warpScale),
      streak,
      streakAngle,
    },
  }
}

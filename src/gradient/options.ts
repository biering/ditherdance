import { type Lab, labToRgb, parseColor, rgbToLab, toHex } from './color.js'
import { lookFromName, type NameOptions } from './name.js'
import { type PresetName, presets } from './presets.js'
import { clamp, mulberry32 } from './util.js'

/** A color, optionally pinned to a spot in the box (0..1, origin top-left). */
export type ColorStop = string | { color: string; x?: number; y?: number }

export type DitherMode = 'bayer2' | 'bayer4' | 'bayer8' | 'noise' | 'none'

export interface GradientOptions extends NameOptions {
  /**
   * Any string: a username, an email, a post slug. The same name always renders
   * the same gradient. Explicit options still win over what the name decides.
   */
  name?: string
  /** Start from a named look; `name` and every other option override it. */
  preset?: PresetName
  /** 2 to 8 colors. Stops without x/y are scattered deterministically by `seed`. */
  colors?: ColorStop[]
  /** Changes the scatter and the noise. Same seed, same picture. */
  seed?: number
  /** How far each color bleeds into its neighbours, as a fraction of the box height. */
  softness?: number
  /** Organic distortion of the color field, 0 to 1. */
  warp?: number
  /** Size of the warp features; higher is busier. */
  warpScale?: number
  /** Drips: displaces the field along `streakAngle`, varying across it. 0 to 1. */
  streak?: number
  /** Direction of the drips in degrees, 90 points down. */
  streakAngle?: number
  /** How many drips fit across the box. */
  streakScale?: number
  /** Size of one dither cell in CSS pixels. */
  pixelSize?: number
  /** The threshold pattern. Bayer gives the woven grid, noise a grainier finish. */
  dither?: DitherMode
  /** Shades per color channel, 2 to 16. Ignored when `palette` is set. */
  levels?: number
  /** Quantize to exactly these colors instead (duotone, 1-bit, brand palettes). */
  palette?: string[]
  /** Let the field drift: always, or only while hovered. Respects prefers-reduced-motion. */
  animate?: boolean | 'hover'
  /** Drift speed multiplier. */
  speed?: number
}

export const MAX_COLORS = 8

export const DITHER_MODES: readonly DitherMode[] = ['none', 'bayer2', 'bayer4', 'bayer8', 'noise']

const DEFAULTS = {
  colors: ['#3b2bf2', '#b9a6ff', '#0b0b1a'],
  seed: 1,
  softness: 0.35,
  warp: 0.3,
  warpScale: 1.6,
  streak: 0,
  streakAngle: 90,
  streakScale: 6,
  pixelSize: 3,
  dither: 'bayer4',
  levels: 7,
  animate: false,
  speed: 1,
} satisfies Omit<
  Required<GradientOptions>,
  'name' | 'preset' | 'palette' | 'traits' | 'normalizeName'
>

/** Everything the renderers need, flattened into typed arrays for the shader. */
export interface RenderParams {
  count: number
  lab: Float32Array
  pos: Float32Array
  softness: number
  warp: number
  warpScale: number
  streak: number
  streakDir: [number, number]
  streakScale: number
  seedOffset: [number, number]
  dither: number
  levels: number
  paletteCount: number
  palette: Float32Array
  pixelSize: number
  animate: boolean | 'hover'
  speed: number
  /** A flat color close to the average, for SSR and the frame before WebGL draws. */
  fallback: string
}

export function resolveOptions(options: GradientOptions = {}): GradientOptions {
  const preset = options.preset ? presets[options.preset] : undefined
  const defined = Object.fromEntries(
    Object.entries(options).filter(([, v]) => v !== undefined),
  ) as GradientOptions
  const fromName = options.name !== undefined ? lookFromName(options.name, options).options : {}
  return { ...DEFAULTS, ...preset, ...fromName, ...defined }
}

export function normalize(options: GradientOptions = {}): RenderParams {
  const o = resolveOptions(options)
  const stops = (o.colors ?? DEFAULTS.colors).slice(0, MAX_COLORS)
  if (stops.length === 0) throw new Error('ditherdance: `colors` needs at least one color')

  const seed = Math.floor(o.seed ?? DEFAULTS.seed)
  const rand = mulberry32(seed * 9973 + 17)
  const lab = new Float32Array(MAX_COLORS * 3)
  const pos = new Float32Array(MAX_COLORS * 2)
  const avg: Lab = [0, 0, 0]
  stops.forEach((stop, i) => {
    const s = typeof stop === 'string' ? { color: stop } : stop
    const c = rgbToLab(parseColor(s.color))
    lab.set(c, i * 3)
    for (let k = 0; k < 3; k++) avg[k] = (avg[k] ?? 0) + (c[k] ?? 0) / stops.length
    // Always draw both numbers so pinning one stop does not reshuffle the rest.
    const rx = 0.08 + rand() * 0.84
    const ry = 0.08 + rand() * 0.84
    pos[i * 2] = s.x ?? rx
    pos[i * 2 + 1] = s.y ?? ry
  })

  const palette = new Float32Array(MAX_COLORS * 3)
  const paletteColors = (o.palette ?? []).slice(0, MAX_COLORS)
  paletteColors.forEach((c, i) => {
    palette.set(rgbToLab(parseColor(c)), i * 3)
  })

  const angle = ((o.streakAngle ?? DEFAULTS.streakAngle) * Math.PI) / 180
  const seedRand = mulberry32(seed)
  const dither = DITHER_MODES.indexOf(o.dither ?? DEFAULTS.dither)

  return {
    count: stops.length,
    lab,
    pos,
    softness: Math.max(0.02, o.softness ?? DEFAULTS.softness),
    warp: clamp(o.warp ?? DEFAULTS.warp, 0, 2),
    warpScale: Math.max(0.01, o.warpScale ?? DEFAULTS.warpScale),
    streak: clamp(o.streak ?? 0, 0, 2),
    streakDir: [Math.cos(angle), Math.sin(angle)],
    streakScale: Math.max(0.01, o.streakScale ?? DEFAULTS.streakScale),
    seedOffset: [seedRand() * 100, seedRand() * 100],
    dither: dither < 0 ? 2 : dither,
    levels: clamp(Math.round(o.levels ?? DEFAULTS.levels), 2, 16),
    paletteCount: paletteColors.length >= 2 ? paletteColors.length : 0,
    palette,
    pixelSize: Math.max(1, o.pixelSize ?? DEFAULTS.pixelSize),
    animate: o.animate ?? false,
    speed: o.speed ?? 1,
    fallback: toHex(labToRgb(avg)),
  }
}

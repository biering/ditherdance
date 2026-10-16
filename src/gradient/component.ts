// Shared by the framework wrappers (react, vue). No framework imports here.
import { type GradientOptions, normalize } from './options.js'

export const OPTION_KEYS = [
  'name',
  'traits',
  'normalizeName',
  'preset',
  'colors',
  'seed',
  'softness',
  'warp',
  'warpScale',
  'streak',
  'streakAngle',
  'streakScale',
  'pixelSize',
  'dither',
  'levels',
  'palette',
  'animate',
  'speed',
] as const satisfies readonly (keyof GradientOptions)[]

// update() merges, so a prop that was removed has to be sent as undefined.
export const CLEARED = Object.fromEntries(OPTION_KEYS.map((k) => [k, undefined])) as GradientOptions

export function fallbackColor(options: GradientOptions): string | undefined {
  try {
    return normalize(options).fallback
  } catch {
    // A color only the browser can parse (oklch(), named): no placeholder on the server.
    return undefined
  }
}

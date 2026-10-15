import { type DiffuseOptions, diffuse, type KernelName } from './diffusion.js'
import type { Pixels } from './image.js'
import { type OrderedOptions, ordered } from './ordered.js'

export { type DiffuseOptions, diffuse, KERNELS, type Kernel, type KernelName } from './diffusion.js'
export type { Pixels } from './image.js'
export { type BayerSize, bayer, type OrderedOptions, ordered } from './ordered.js'
export {
  BLACK_WHITE,
  GAME_BOY,
  grayscale,
  hex,
  isGray,
  luma,
  type Palette,
  type Rgb,
} from './palette.js'

/** Every method `dither` knows: a diffusion kernel, or `bayer` for ordered. */
export type Method = KernelName | 'bayer'

export type DitherOptions = { method?: Method } & DiffuseOptions & OrderedOptions

/**
 * One entry point for every method, in place. Defaults to Floyd-Steinberg in
 * black and white.
 *
 * ```ts
 * const image = ctx.getImageData(0, 0, w, h)
 * dither(image, { method: 'atkinson', palette: grayscale(4) })
 * ctx.putImageData(image, 0, 0)
 * ```
 */
export function dither<T extends Pixels>(image: T, options: DitherOptions = {}): T {
  const { method = 'floyd-steinberg', ...rest } = options
  if (method === 'bayer') return ordered(image, rest)
  return diffuse(image, { ...rest, kernel: method })
}

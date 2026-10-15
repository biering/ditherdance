import { assertPixels, clampByte, grayLookup, type Pixels } from './image.js'
import { BLACK_WHITE, compile, isGray, luma, type Palette } from './palette.js'

/** Where a pixel's error goes: `[dx, dy, weight]`, weights over `divisor`. */
export interface Kernel {
  readonly divisor: number
  readonly taps: readonly (readonly [number, number, number])[]
}

/**
 * The classic error-diffusion kernels. Atkinson passes on only 6/8 of the
 * error, which is what gives it its bright, high-contrast look.
 */
export const KERNELS = {
  'floyd-steinberg': {
    divisor: 16,
    taps: [
      [1, 0, 7],
      [-1, 1, 3],
      [0, 1, 5],
      [1, 1, 1],
    ],
  },
  atkinson: {
    divisor: 8,
    taps: [
      [1, 0, 1],
      [2, 0, 1],
      [-1, 1, 1],
      [0, 1, 1],
      [1, 1, 1],
      [0, 2, 1],
    ],
  },
  'jarvis-judice-ninke': {
    divisor: 48,
    taps: [
      [1, 0, 7],
      [2, 0, 5],
      [-2, 1, 3],
      [-1, 1, 5],
      [0, 1, 7],
      [1, 1, 5],
      [2, 1, 3],
      [-2, 2, 1],
      [-1, 2, 3],
      [0, 2, 5],
      [1, 2, 3],
      [2, 2, 1],
    ],
  },
  stucki: {
    divisor: 42,
    taps: [
      [1, 0, 8],
      [2, 0, 4],
      [-2, 1, 2],
      [-1, 1, 4],
      [0, 1, 8],
      [1, 1, 4],
      [2, 1, 2],
      [-2, 2, 1],
      [-1, 2, 2],
      [0, 2, 4],
      [1, 2, 2],
      [2, 2, 1],
    ],
  },
  burkes: {
    divisor: 32,
    taps: [
      [1, 0, 8],
      [2, 0, 4],
      [-2, 1, 2],
      [-1, 1, 4],
      [0, 1, 8],
      [1, 1, 4],
      [2, 1, 2],
    ],
  },
  sierra: {
    divisor: 32,
    taps: [
      [1, 0, 5],
      [2, 0, 3],
      [-2, 1, 2],
      [-1, 1, 4],
      [0, 1, 5],
      [1, 1, 4],
      [2, 1, 2],
      [-1, 2, 2],
      [0, 2, 3],
      [1, 2, 2],
    ],
  },
  'sierra-lite': {
    divisor: 4,
    taps: [
      [1, 0, 2],
      [-1, 1, 1],
      [0, 1, 1],
    ],
  },
} as const satisfies Record<string, Kernel>

export type KernelName = keyof typeof KERNELS

export interface DiffuseOptions {
  /** Defaults to black and white. An all-grey palette runs on one channel, about 3x faster. */
  palette?: Palette
  /** A name from `KERNELS` or your own. Defaults to Floyd-Steinberg. */
  kernel?: KernelName | Kernel
  /** Alternate row direction, which breaks up the diagonal "worms". Defaults to true. */
  serpentine?: boolean
  /** How much of each pixel's error is passed on, 0 to 1. Defaults to 1. */
  strength?: number
}

/**
 * Error-diffusion dithering, in place. Each pixel snaps to the nearest palette
 * colour and pushes what it got wrong onto neighbours not yet visited. Alpha is
 * left untouched. Returns the same image for chaining.
 */
export function diffuse<T extends Pixels>(image: T, options: DiffuseOptions = {}): T {
  assertPixels(image)
  const palette = options.palette ?? BLACK_WHITE
  const kernel = typeof options.kernel === 'object' ? options.kernel : KERNELS[options.kernel ?? 'floyd-steinberg']
  const serpentine = options.serpentine ?? true
  const strength = (options.strength ?? 1) / kernel.divisor
  if (isGray(palette)) diffuseGray(image, palette, kernel, serpentine, strength)
  else diffuseColor(image, palette, kernel, serpentine, strength)
  return image
}

/** The kernel as typed arrays with the weights pre-scaled, for the hot loop. */
function flatten(kernel: Kernel, scale: number) {
  const count = kernel.taps.length
  const dx = new Int32Array(count)
  const dy = new Int32Array(count)
  const weight = new Float32Array(count)
  kernel.taps.forEach(([x, y, w], t) => {
    dx[t] = x
    dy[t] = y
    weight[t] = w * scale
  })
  return { dx, dy, weight, count }
}

function diffuseGray(
  { data, width, height }: Pixels,
  palette: Palette,
  kernel: Kernel,
  serpentine: boolean,
  scale: number,
): void {
  const lut = grayLookup(compile(palette).r)
  const buf = new Float32Array(width * height)
  for (let i = 0, p = 0; i < buf.length; i++, p += 4) {
    buf[i] = luma(data[p] as number, data[p + 1] as number, data[p + 2] as number)
  }
  const { dx, dy, weight, count } = flatten(kernel, scale)
  for (let y = 0; y < height; y++) {
    const reverse = serpentine && (y & 1) === 1
    for (let step = 0; step < width; step++) {
      const x = reverse ? width - 1 - step : step
      const i = y * width + x
      const old = buf[i] as number
      const next = lut[clampByte(old)] as number
      const error = old - next
      const p = i * 4
      data[p] = data[p + 1] = data[p + 2] = next
      if (error === 0) continue
      for (let t = 0; t < count; t++) {
        const nx = reverse ? x - (dx[t] as number) : x + (dx[t] as number)
        const ny = y + (dy[t] as number)
        if (nx < 0 || nx >= width || ny >= height) continue
        const n = ny * width + nx
        buf[n] = (buf[n] as number) + error * (weight[t] as number)
      }
    }
  }
}

function diffuseColor(
  { data, width, height }: Pixels,
  palette: Palette,
  kernel: Kernel,
  serpentine: boolean,
  scale: number,
): void {
  const compiled = compile(palette)
  const buf = new Float32Array(width * height * 3)
  for (let i = 0, p = 0; i < buf.length; i += 3, p += 4) {
    buf[i] = data[p] as number
    buf[i + 1] = data[p + 1] as number
    buf[i + 2] = data[p + 2] as number
  }
  const { dx, dy, weight, count } = flatten(kernel, scale)
  for (let y = 0; y < height; y++) {
    const reverse = serpentine && (y & 1) === 1
    for (let step = 0; step < width; step++) {
      const x = reverse ? width - 1 - step : step
      const i = (y * width + x) * 3
      const r = buf[i] as number
      const g = buf[i + 1] as number
      const b = buf[i + 2] as number
      const k = compiled.nearest(r, g, b)
      const nr = compiled.r[k] as number
      const ng = compiled.g[k] as number
      const nb = compiled.b[k] as number
      const p = (y * width + x) * 4
      data[p] = nr
      data[p + 1] = ng
      data[p + 2] = nb
      const er = r - nr
      const eg = g - ng
      const eb = b - nb
      for (let t = 0; t < count; t++) {
        const nx = reverse ? x - (dx[t] as number) : x + (dx[t] as number)
        const ny = y + (dy[t] as number)
        if (nx < 0 || nx >= width || ny >= height) continue
        const n = (ny * width + nx) * 3
        const w = weight[t] as number
        buf[n] = (buf[n] as number) + er * w
        buf[n + 1] = (buf[n + 1] as number) + eg * w
        buf[n + 2] = (buf[n + 2] as number) + eb * w
      }
    }
  }
}

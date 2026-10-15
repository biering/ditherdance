import type { RenderParams } from './options.js'

// The shader in plain JS: the fallback without WebGL, and what the tests run
// in Node. Keep it in step with shader.ts.

const fract = (x: number) => x - Math.floor(x)

function hash(x: number, y: number): number {
  let a = fract(x * 0.1031)
  let b = fract(y * 0.1031)
  let c = fract(x * 0.1031)
  const dot = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33)
  a += dot
  b += dot
  c += dot
  return fract((a + b) * c)
}

function vnoise(x: number, y: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const a = hash(ix, iy)
  const b = hash(ix + 1, iy)
  const c = hash(ix, iy + 1)
  const d = hash(ix + 1, iy + 1)
  return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy
}

function fbm(x: number, y: number): number {
  let s = 0
  let a = 0.5
  for (let i = 0; i < 3; i++) {
    s += a * vnoise(x, y)
    x = x * 2.03 + 17.1
    y = y * 2.03 + 9.2
    a *= 0.4
  }
  return s / 0.78
}

export function bayer2(x: number, y: number): number {
  x = Math.floor(x)
  y = Math.floor(y)
  return fract(x * 0.5 + y * y * 0.75)
}
export const bayer4 = (x: number, y: number) => bayer2(x * 0.5, y * 0.5) * 0.25 + bayer2(x, y)
export const bayer8 = (x: number, y: number) => bayer4(x * 0.5, y * 0.5) * 0.25 + bayer2(x, y)

export function threshold(mode: number, x: number, y: number): number {
  if (mode === 1) return bayer2(x, y) + 0.125
  if (mode === 2) return bayer4(x, y) + 0.03125
  if (mode === 3) return bayer8(x, y) + 0.0078125
  if (mode === 4) return fract(52.9829189 * fract(x * 0.06711056 + y * 0.00583715))
  return 0.5
}

function gamma(c: number): number {
  c = Math.min(1, Math.max(0, c))
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
}

function labToSrgb(L: number, a: number, b: number, out: number[]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  out[0] = gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)
  out[1] = gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)
  out[2] = gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
}

/** Renders `cols × rows` cells into RGBA bytes, one pixel per cell. */
export function renderPixels(
  p: RenderParams,
  cols: number,
  rows: number,
  time = 0,
): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(cols * rows * 4)
  const aspect = cols / rows
  const t = time * 0.05
  const [sx, sy] = p.seedOffset
  const [dx, dy] = p.streakDir
  const k = 1 / (p.softness * p.softness)
  const stops: [number, number][] = []
  for (let i = 0; i < p.count; i++) {
    const x = p.pos[i * 2]! + 0.05 * Math.sin(time * 0.31 + i * 1.7)
    const y = p.pos[i * 2 + 1]! + 0.05 * Math.cos(time * 0.23 + i * 2.3)
    stops.push([(x - 0.5) * aspect, y - 0.5])
  }
  const d = new Array<number>(p.count)
  const rgb = [0, 0, 0]

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let qx = ((col + 0.5) / cols - 0.5) * aspect
      let qy = (row + 0.5) / rows - 0.5

      const wx = qx * p.warpScale + sx
      const wy = qy * p.warpScale + sy
      const ox = (fbm(wx + t, wy + t) - 0.5) * 2
      const oy = (fbm(wx + 5.2 - t, wy + 1.3 - t) - 0.5) * 2
      qx += p.warp * ox
      qy += p.warp * oy
      const across = qx * -dy + qy * dx
      const drip = (fbm(across * p.streakScale + sx, sy + t) - 0.5) * 2
      qx += dx * p.streak * drip
      qy += dy * p.streak * drip

      let dmin = Number.POSITIVE_INFINITY
      for (let i = 0; i < p.count; i++) {
        const ex = qx - stops[i]![0]
        const ey = qy - stops[i]![1]
        const di = ex * ex + ey * ey
        d[i] = di
        if (di < dmin) dmin = di
      }
      let L = 0
      let A = 0
      let B = 0
      let wsum = 0
      for (let i = 0; i < p.count; i++) {
        const w = Math.exp(-(d[i]! - dmin) * k)
        L += p.lab[i * 3]! * w
        A += p.lab[i * 3 + 1]! * w
        B += p.lab[i * 3 + 2]! * w
        wsum += w
      }
      L /= wsum
      A /= wsum
      B /= wsum

      const th = threshold(p.dither, col, row)
      if (p.paletteCount >= 2) {
        let d1 = Number.POSITIVE_INFINITY
        let d2 = Number.POSITIVE_INFINITY
        let c1 = 0
        let c2 = 0
        for (let i = 0; i < p.paletteCount; i++) {
          const di = Math.hypot(
            L - p.palette[i * 3]!,
            A - p.palette[i * 3 + 1]!,
            B - p.palette[i * 3 + 2]!,
          )
          if (di < d1) {
            d2 = d1
            c2 = c1
            d1 = di
            c1 = i
          } else if (di < d2) {
            d2 = di
            c2 = i
          }
        }
        const pick = th < d1 / Math.max(d1 + d2, 1e-6) ? c2 : c1
        labToSrgb(p.palette[pick * 3]!, p.palette[pick * 3 + 1]!, p.palette[pick * 3 + 2]!, rgb)
      } else {
        labToSrgb(L, A, B, rgb)
        if (p.dither > 0) {
          const n = p.levels - 1
          for (let c = 0; c < 3; c++) rgb[c] = Math.min(1, Math.floor(rgb[c]! * n + th) / n)
        }
      }

      const o = (row * cols + col) * 4
      out[o] = Math.round(rgb[0]! * 255)
      out[o + 1] = Math.round(rgb[1]! * 255)
      out[o + 2] = Math.round(rgb[2]! * 255)
      out[o + 3] = 255
    }
  }
  return out
}

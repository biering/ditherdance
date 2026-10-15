export type RGB = [number, number, number]
export type Lab = [number, number, number]

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const RGB_FN = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i

let probe: CanvasRenderingContext2D | null | undefined

/**
 * Parses a CSS color into sRGB 0..1. Hex and rgb() are parsed directly, so this
 * works on the server. Anything else (oklch(), named colors, …) is resolved by
 * the browser's own parser through a 1x1 canvas.
 */
export function parseColor(input: string): RGB {
  const value = input.trim()
  const hex = HEX.exec(value)
  if (hex) {
    let h = hex[1] ?? ''
    if (h.length <= 4) h = [...h].map((c) => c + c).join('')
    return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16) / 255) as RGB
  }
  const fn = RGB_FN.exec(value)
  if (fn) return [fn[1], fn[2], fn[3]].map((n) => Math.min(1, Number(n) / 255)) as RGB

  if (probe === undefined) {
    probe =
      typeof document === 'undefined'
        ? null
        : document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  }
  if (probe) {
    probe.clearRect(0, 0, 1, 1)
    probe.fillStyle = '#000'
    probe.fillStyle = value
    probe.fillRect(0, 0, 1, 1)
    const [r = 0, g = 0, b = 0] = probe.getImageData(0, 0, 1, 1).data
    return [r / 255, g / 255, b / 255]
  }
  throw new Error(`ditherdance: cannot parse color "${input}" outside a browser`)
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

/** sRGB (0..1) to OKLab. Blending here keeps midpoints from going grey. */
export function rgbToLab([r, g, b]: RGB): Lab {
  const lr = toLinear(r)
  const lg = toLinear(g)
  const lb = toLinear(b)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** OKLab to linear sRGB, unclamped: values outside 0..1 are out of gamut. */
export function labToLinear([L, a, b]: Lab): RGB {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

/** OKLab to sRGB (0..1), clamped. */
export function labToRgb(lab: Lab): RGB {
  return labToLinear(lab).map((c) => Math.min(1, toGamma(Math.max(0, c)))) as RGB
}

export function toHex([r, g, b]: RGB): string {
  return `#${[r, g, b]
    .map((c) =>
      Math.round(c * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

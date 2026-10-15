/**
 * RGBA pixels, four bytes each, row by row. `ImageData` from a canvas fits, and
 * so does any `{ data, width, height }` you build yourself, which is what lets
 * the same code run on a page, in a worker or in Node.
 */
export interface Pixels {
  readonly data: Uint8ClampedArray | Uint8Array
  readonly width: number
  readonly height: number
}

export function assertPixels(image: Pixels): void {
  const { width, height, data } = image
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 0 || height < 0) {
    throw new RangeError(`width and height must be non-negative integers, got ${width}x${height}`)
  }
  if (data.length !== width * height * 4) {
    throw new RangeError(
      `expected ${width * height * 4} bytes for ${width}x${height} RGBA, got ${data.length}`,
    )
  }
}

/**
 * A lookup from any grey value, error included, to the nearest palette grey.
 * Indexed by the value rounded and clamped to 0..255, so the hot loop is one
 * array read instead of a search.
 */
export function grayLookup(levels: Float32Array): Float32Array {
  const lut = new Float32Array(256)
  for (let v = 0; v < 256; v++) {
    let best = levels[0] as number
    for (let i = 1; i < levels.length; i++) {
      const level = levels[i] as number
      if (Math.abs(v - level) < Math.abs(v - best)) best = level
    }
    lut[v] = best
  }
  return lut
}

export function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v)
}

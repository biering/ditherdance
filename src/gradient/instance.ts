import { draw } from './gl.js'
import { type GradientOptions, normalize, type RenderParams } from './options.js'

export interface GradientInstance {
  /** Merge new options and redraw. */
  update(options: GradientOptions): void
  /** The options as last passed, before presets and names are applied. */
  readonly options: GradientOptions
  /** Re-measure the target. Called for you by a ResizeObserver. */
  resize(): void
  /** PNG of what is on screen, at device resolution. */
  toBlob(): Promise<Blob | null>
  destroy(): void
}

const MAX_DPR = 2

/**
 * Mounts a gradient into `target`, filling it and sitting behind its content.
 * The target becomes `position: relative` if it was static.
 */
export function createGradient(target: HTMLElement, initial: GradientOptions = {}): GradientInstance {
  let options = { ...initial }
  let params: RenderParams = normalize(options)

  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  Object.assign(canvas.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    zIndex: '-1',
    display: 'block',
    pointerEvents: 'none',
    imageRendering: 'pixelated',
  })
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('ditherdance: no 2D context')

  if (getComputedStyle(target).position === 'static') target.style.position = 'relative'
  target.style.isolation = 'isolate'
  target.style.overflow = 'hidden'
  target.style.backgroundColor = params.fallback
  target.prepend(canvas)

  let cols = 0
  let rows = 0
  let time = 0
  let visible = true
  let hovered = false
  let frame = 0
  let last = 0
  const reduced =
    typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null

  function render() {
    if (cols > 0 && rows > 0) draw(ctx as CanvasRenderingContext2D, params, cols, rows, time)
  }

  function resize() {
    const { width, height } = target.getBoundingClientRect()
    const dpr = Math.min(globalThis.devicePixelRatio || 1, MAX_DPR)
    // Whole device pixels per cell, or the grid shimmers between 3 and 4 px.
    const cell = Math.max(1, Math.round(params.pixelSize * dpr))
    const nextCols = Math.max(1, Math.ceil((width * dpr) / cell))
    const nextRows = Math.max(1, Math.ceil((height * dpr) / cell))
    canvas.style.width = `${(nextCols * cell) / dpr}px`
    canvas.style.height = `${(nextRows * cell) / dpr}px`
    if (nextCols !== cols || nextRows !== rows) {
      cols = canvas.width = nextCols
      rows = canvas.height = nextRows
      render()
    }
  }

  function tick(now: number) {
    frame = 0
    time += Math.min(0.1, (now - last) / 1000) * params.speed
    last = now
    render()
    schedule()
  }

  function schedule() {
    const wanted = params.animate === 'hover' ? hovered : params.animate
    const run = wanted && visible && !reduced?.matches
    if (run && !frame) {
      last = performance.now()
      frame = requestAnimationFrame(tick)
    } else if (!run && frame) {
      cancelAnimationFrame(frame)
      frame = 0
    }
  }

  const ro = new ResizeObserver(resize)
  ro.observe(target)
  const io = new IntersectionObserver((entries) => {
    visible = entries.at(-1)?.isIntersecting ?? true
    schedule()
  })
  io.observe(target)
  reduced?.addEventListener('change', schedule)
  const enter = () => {
    hovered = true
    schedule()
  }
  const leave = () => {
    hovered = false
    schedule()
  }
  target.addEventListener('pointerenter', enter)
  target.addEventListener('pointerleave', leave)

  resize()
  render()
  schedule()

  return {
    get options() {
      return options
    },
    update(next) {
      options = { ...options, ...next }
      params = normalize(options)
      target.style.backgroundColor = params.fallback
      cols = 0
      resize()
      schedule()
    },
    resize,
    toBlob() {
      return new Promise((resolve) => {
        const out = document.createElement('canvas')
        const scale = Math.round(params.pixelSize * Math.min(globalThis.devicePixelRatio || 1, 2))
        out.width = cols * scale
        out.height = rows * scale
        const octx = out.getContext('2d')
        if (!octx) return resolve(null)
        octx.imageSmoothingEnabled = false
        octx.drawImage(canvas, 0, 0, out.width, out.height)
        out.toBlob(resolve, 'image/png')
      })
    },
    destroy() {
      if (frame) cancelAnimationFrame(frame)
      ro.disconnect()
      io.disconnect()
      reduced?.removeEventListener('change', schedule)
      target.removeEventListener('pointerenter', enter)
      target.removeEventListener('pointerleave', leave)
      canvas.remove()
    },
  }
}

export interface ExportOptions {
  /** Output width in pixels. */
  width: number
  /** Output height in pixels. */
  height: number
  /** Animation time to freeze, in seconds. */
  time?: number
}

/** Renders a gradient to a standalone canvas at an exact size: OG images, downloads, CSS. */
export function renderToCanvas(options: GradientOptions, size: ExportOptions): HTMLCanvasElement {
  const params = normalize(options)
  const cell = Math.max(1, Math.round(params.pixelSize))
  const cols = Math.ceil(size.width / cell)
  const rows = Math.ceil(size.height / cell)
  const small = document.createElement('canvas')
  small.width = cols
  small.height = rows
  const sctx = small.getContext('2d', { alpha: false })
  const out = document.createElement('canvas')
  out.width = size.width
  out.height = size.height
  const octx = out.getContext('2d', { alpha: false })
  if (!sctx || !octx) throw new Error('ditherdance: no 2D context')
  draw(sctx, params, cols, rows, size.time ?? 0)
  octx.imageSmoothingEnabled = false
  octx.drawImage(small, 0, 0, cols * cell, rows * cell)
  return out
}

/** `renderToCanvas` as a data URL, ready for `background-image` or an `<img>`. */
export function renderToDataURL(
  options: GradientOptions,
  size: ExportOptions,
  type = 'image/png',
): string {
  return renderToCanvas(options, size).toDataURL(type)
}

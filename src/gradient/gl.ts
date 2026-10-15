import { renderPixels } from './cpu.js'
import type { RenderParams } from './options.js'
import { FRAGMENT, VERTEX } from './shader.js'

/**
 * Browsers cap live WebGL contexts at about sixteen per page and silently drop
 * the oldest past that, so a grid of gradients would go blank. Every instance
 * therefore draws through this one context and copies the result into its own
 * 2D canvas.
 */
interface GL {
  canvas: HTMLCanvasElement
  gl: WebGL2RenderingContext
  u: Record<Uniform, WebGLUniformLocation | null>
}

let shared: GL | null | undefined

const UNIFORMS = [
  'uRes',
  'uCount',
  'uLab',
  'uPos',
  'uSoft',
  'uWarp',
  'uWarpScale',
  'uStreak',
  'uStreakDir',
  'uStreakScale',
  'uSeed',
  'uTime',
  'uDither',
  'uLevels',
  'uPaletteCount',
  'uPalette',
] as const
type Uniform = (typeof UNIFORMS)[number]

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('createShader failed')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`ditherdance shader: ${gl.getShaderInfoLog(shader)}`)
  }
  return shader
}

function create(): GL | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
    depth: false,
    preserveDrawingBuffer: true,
  })
  if (!gl) return null
  try {
    const program = gl.createProgram()
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`ditherdance link: ${gl.getProgramInfoLog(program)}`)
    }
    // biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram, not a React hook
    gl.useProgram(program)
    const u = {} as GL['u']
    for (const name of UNIFORMS) u[name] = gl.getUniformLocation(program, name)
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      shared = undefined
    })
    return { canvas, gl, u }
  } catch (error) {
    console.warn(error)
    return null
  }
}

/** Draws the cell image for `params` into `ctx`, which is `cols × rows`. */
export function draw(
  ctx: CanvasRenderingContext2D,
  params: RenderParams,
  cols: number,
  rows: number,
  time: number,
): void {
  if (shared === undefined) shared = create()
  if (!shared) {
    ctx.putImageData(new ImageData(renderPixels(params, cols, rows, time), cols, rows), 0, 0)
    return
  }
  const { canvas, gl, u } = shared
  if (canvas.width < cols) canvas.width = cols
  if (canvas.height < rows) canvas.height = rows
  // GL's origin is bottom-left: draw there, then copy from the bottom of the
  // image, so one large canvas can serve smaller instances too.
  gl.viewport(0, 0, cols, rows)
  gl.uniform2f(u.uRes, cols, rows)
  gl.uniform1i(u.uCount, params.count)
  gl.uniform3fv(u.uLab, params.lab)
  gl.uniform2fv(u.uPos, params.pos)
  gl.uniform1f(u.uSoft, params.softness)
  gl.uniform1f(u.uWarp, params.warp)
  gl.uniform1f(u.uWarpScale, params.warpScale)
  gl.uniform1f(u.uStreak, params.streak)
  gl.uniform2f(u.uStreakDir, params.streakDir[0], params.streakDir[1])
  gl.uniform1f(u.uStreakScale, params.streakScale)
  gl.uniform2f(u.uSeed, params.seedOffset[0], params.seedOffset[1])
  gl.uniform1f(u.uTime, time)
  gl.uniform1i(u.uDither, params.dither)
  gl.uniform1f(u.uLevels, params.levels)
  gl.uniform1i(u.uPaletteCount, params.paletteCount)
  gl.uniform3fv(u.uPalette, params.palette)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
  ctx.drawImage(canvas, 0, canvas.height - rows, cols, rows, 0, 0, cols, rows)
}

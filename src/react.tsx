import {
  type ComponentPropsWithoutRef,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'
import { createGradient, type GradientInstance } from './gradient/instance.js'
import { type GradientOptions, normalize } from './gradient/options.js'

const OPTION_KEYS = [
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
const CLEARED = Object.fromEntries(OPTION_KEYS.map((k) => [k, undefined])) as GradientOptions

export type DitherGradientProps = GradientOptions &
  Omit<ComponentPropsWithoutRef<'div'>, keyof GradientOptions>

export interface DitherGradientHandle {
  toBlob(): Promise<Blob | null>
}

function fallbackColor(options: GradientOptions): string | undefined {
  try {
    return normalize(options).fallback
  } catch {
    // A color only the browser can parse (oklch(), named): no placeholder on the server.
    return undefined
  }
}

/**
 * A div with a dither gradient behind its children. Renders a flat average
 * color on the server, then the gradient once mounted.
 */
export const DitherGradient = forwardRef<DitherGradientHandle, DitherGradientProps>(
  function DitherGradient(props, ref) {
    const options: GradientOptions = {}
    const rest: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(props)) {
      if ((OPTION_KEYS as readonly string[]).includes(key)) {
        ;(options as Record<string, unknown>)[key] = value
      } else rest[key] = value
    }
    const { style, children, ...divProps } = rest as ComponentPropsWithoutRef<'div'>

    const layer = useRef<HTMLDivElement>(null)
    const instance = useRef<GradientInstance | null>(null)
    // Options arrive as a fresh object every render; compare by value.
    const key = JSON.stringify(options)

    useImperativeHandle(ref, () => ({
      toBlob: () => instance.current?.toBlob() ?? Promise.resolve(null),
    }))

    // biome-ignore lint/correctness/useExhaustiveDependencies: mount once; updates go through the effect below
    useEffect(() => {
      if (!layer.current) return
      instance.current = createGradient(layer.current, JSON.parse(key))
      return () => {
        instance.current?.destroy()
        instance.current = null
      }
    }, [])

    useEffect(() => {
      instance.current?.update({ ...CLEARED, ...JSON.parse(key) })
    }, [key])

    return (
      <div
        {...divProps}
        style={{
          position: 'relative',
          isolation: 'isolate',
          backgroundColor: fallbackColor(options),
          ...style,
        }}
      >
        <div ref={layer} aria-hidden style={{ position: 'absolute', inset: 0, zIndex: -1 }} />
        {children}
      </div>
    )
  },
)

import {
  type ComponentPropsWithoutRef,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'
import { CLEARED, fallbackColor, OPTION_KEYS } from './gradient/component.js'
import { createGradient, type GradientInstance } from './gradient/instance.js'
import type { GradientOptions } from './gradient/options.js'

export type DitherGradientProps = GradientOptions &
  Omit<ComponentPropsWithoutRef<'div'>, keyof GradientOptions>

export interface DitherGradientHandle {
  toBlob(): Promise<Blob | null>
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

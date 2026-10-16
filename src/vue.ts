import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  type PropType,
  ref,
  shallowRef,
  watch,
} from 'vue'
import { CLEARED, fallbackColor, OPTION_KEYS } from './gradient/component.js'
import { createGradient, type GradientInstance } from './gradient/instance.js'
import type { GradientOptions } from './gradient/options.js'

type OptionKey = (typeof OPTION_KEYS)[number]

// `type: null` accepts any value and, unlike Boolean, leaves an absent prop
// undefined instead of casting it to false.
const props = Object.fromEntries(OPTION_KEYS.map((k) => [k, { type: null, default: undefined }])) as unknown as {
  [K in OptionKey]: { type: PropType<GradientOptions[K]>; default: undefined }
}

export interface DitherGradientHandle {
  toBlob(): Promise<Blob | null>
}

/**
 * A div with a dither gradient behind its default slot. Renders a flat average
 * color on the server, then the gradient once mounted. Attributes that are not
 * options (class, style, listeners) fall through to the div.
 */
export const DitherGradient = defineComponent({
  name: 'DitherGradient',
  props,
  setup(props, { slots, expose }) {
    const layer = ref<HTMLDivElement | null>(null)
    const instance = shallowRef<GradientInstance | null>(null)

    const options = (): GradientOptions => {
      const out: Record<string, unknown> = {}
      for (const k of OPTION_KEYS) if (props[k] !== undefined) out[k] = props[k]
      return out as GradientOptions
    }

    expose({
      toBlob: () => instance.value?.toBlob() ?? Promise.resolve(null),
    } satisfies DitherGradientHandle)

    onMounted(() => {
      if (layer.value) instance.value = createGradient(layer.value, options())
    })

    onBeforeUnmount(() => {
      instance.value?.destroy()
      instance.value = null
    })

    // Arrays and objects may be fresh every render; compare by value.
    watch(
      () => JSON.stringify(options()),
      (key) => instance.value?.update({ ...CLEARED, ...JSON.parse(key) }),
    )

    return () =>
      h(
        'div',
        {
          style: {
            position: 'relative',
            isolation: 'isolate',
            backgroundColor: fallbackColor(options()),
          },
        },
        [
          h('div', {
            ref: layer,
            'aria-hidden': 'true',
            style: { position: 'absolute', inset: 0, zIndex: -1 },
          }),
          slots.default?.(),
        ],
      )
  },
})

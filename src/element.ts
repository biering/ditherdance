import { createGradient, type GradientInstance } from './gradient/instance.js'
import type { DitherMode, GradientOptions } from './gradient/options.js'
import type { PresetName } from './gradient/presets.js'

const NUMBERS = {
  seed: 'seed',
  softness: 'softness',
  warp: 'warp',
  'warp-scale': 'warpScale',
  streak: 'streak',
  'streak-angle': 'streakAngle',
  'streak-scale': 'streakScale',
  'pixel-size': 'pixelSize',
  levels: 'levels',
  speed: 'speed',
} as const

const ATTRIBUTES = [
  'name',
  'preset',
  'colors',
  'palette',
  'dither',
  'animate',
  'traits',
  ...Object.keys(NUMBERS),
]

/** Splits "a, rgb(1, 2, 3), #fff" on the commas that are not inside parentheses. */
function list(value: string): string[] {
  return value
    .split(/,(?![^(]*\))/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// Extending HTMLElement at module scope would throw during SSR, where it does
// not exist. Importing this file on the server is then a harmless no-op.
const Base = (typeof HTMLElement === 'undefined' ? class {} : HTMLElement) as typeof HTMLElement

/**
 * `<dither-gradient name="ada@example.com" pixel-size="4">` fills its box and
 * keeps its children on top. Every option is an attribute in kebab-case; set
 * `.options` from JS for anything an attribute cannot carry.
 */
export class DitherGradientElement extends Base {
  static observedAttributes = ATTRIBUTES

  #instance: GradientInstance | null = null
  #layer: HTMLDivElement | null = null
  #extra: GradientOptions = {}

  /** Extra options merged over the attributes. */
  get options(): GradientOptions {
    return this.#extra
  }
  set options(value: GradientOptions) {
    this.#extra = value
    this.#instance?.update(this.#read())
  }

  connectedCallback() {
    if (!this.shadowRoot) {
      const root = this.attachShadow({ mode: 'open' })
      root.innerHTML =
        '<style>:host{display:block;position:relative;isolation:isolate}' +
        '.layer{position:absolute;inset:0;z-index:-1}</style>' +
        '<div class="layer" part="layer"></div><slot></slot>'
      this.#layer = root.querySelector('.layer')
    }
    if (this.#layer && !this.#instance) this.#instance = createGradient(this.#layer, this.#read())
  }

  disconnectedCallback() {
    this.#instance?.destroy()
    this.#instance = null
  }

  attributeChangedCallback() {
    this.#instance?.update(this.#read())
  }

  /** PNG of the gradient as shown. */
  toBlob() {
    return this.#instance?.toBlob() ?? Promise.resolve(null)
  }

  #read(): GradientOptions {
    const get = (key: string) => this.getAttribute(key) ?? undefined
    const o: GradientOptions = {
      name: get('name'),
      preset: get('preset') as PresetName | undefined,
      dither: get('dither') as DitherMode | undefined,
    }
    for (const [attr, key] of Object.entries(NUMBERS)) {
      const v = get(attr)
      // Attributes removed since the last read must clear, not linger.
      o[key] = v === undefined || v === '' ? undefined : Number(v)
    }
    const colors = get('colors')
    o.colors = colors ? list(colors) : undefined
    const palette = get('palette')
    o.palette = palette ? list(palette) : undefined
    const animate = get('animate')
    o.animate =
      animate === undefined || animate === 'false' ? false : animate === 'hover' ? 'hover' : true
    const traits = get('traits')
    o.traits = traits ? JSON.parse(traits) : undefined
    return { ...o, ...this.#extra }
  }
}

/** Registers the element. Safe to call twice and on the server. */
export function defineDitherGradient(tag = 'dither-gradient') {
  if (typeof customElements !== 'undefined' && !customElements.get(tag)) {
    customElements.define(tag, DitherGradientElement)
  }
}

defineDitherGradient()

declare global {
  interface HTMLElementTagNameMap {
    'dither-gradient': DitherGradientElement
  }
}

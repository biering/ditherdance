export { type Lab, parseColor, type RGB } from './color.js'
export { renderPixels } from './cpu.js'
export {
  createGradient,
  type GradientInstance,
  type ExportOptions,
  renderToCanvas,
  renderToDataURL,
} from './instance.js'
export {
  lookFromName,
  type NameLook,
  type NameOptions,
  normalizeName,
  resolveTraits,
  SCHEME_EDGES,
  SCHEMES,
  type Scheme,
  TONE_EDGES,
  TONES,
  type Tone,
  TRAIT_KEYS,
  type TraitKey,
  type TraitPin,
  type Traits,
} from './name.js'
export {
  type ColorStop,
  DITHER_MODES,
  type DitherMode,
  type GradientOptions,
  MAX_COLORS,
  normalize,
  type RenderParams,
  resolveOptions,
} from './options.js'
export { PRESET_NAMES, type PresetName, presets } from './presets.js'

import type { GradientOptions } from './options.js'

/** Hand-tuned looks. Positions are 0..1 in the box, origin top-left. */
export const presets = {
  haze: {
    colors: [
      { color: '#8f7bff', x: 0.15, y: 0.1 },
      { color: '#3a2df0', x: 0.62, y: 0.32 },
      { color: '#c9bcff', x: 0.3, y: 0.62 },
      { color: '#4b3cf5', x: 0.9, y: 0.85 },
      { color: '#e7e0ff', x: 0.55, y: 0.95 },
    ],
    softness: 0.42,
    warp: 0.45,
  },
  icefall: {
    colors: [
      { color: '#f3f1ee', x: 0.5, y: 0.02 },
      { color: '#e8eefc', x: 0.1, y: 0.1 },
      { color: '#1f4dff', x: 0.5, y: 0.42 },
      { color: '#05060d', x: 0.5, y: 0.98 },
      { color: '#05060d', x: 0.1, y: 0.85 },
    ],
    softness: 0.24,
    warp: 0.08,
    streak: 0.42,
    streakAngle: 90,
    streakScale: 5,
  },
  ember: {
    colors: [
      { color: '#ff4b0d', x: 0.05, y: 0.08 },
      { color: '#0c0b0d', x: 0.78, y: 0.35 },
      { color: '#0c0b0d', x: 0.95, y: 0.05 },
      { color: '#f1e7dd', x: 0.12, y: 0.95 },
      { color: '#5b7472', x: 0.92, y: 0.98 },
    ],
    softness: 0.3,
    warp: 0.22,
  },
  solstice: {
    colors: [
      { color: '#050302', x: 0.02, y: 0.5 },
      { color: '#3b1406', x: 0.3, y: 0.7 },
      { color: '#ff8a00', x: 0.52, y: 0.75 },
      { color: '#ffc61f', x: 0.68, y: 0.4 },
      { color: '#fff3d8', x: 0.98, y: 0.5 },
    ],
    softness: 0.3,
    warp: 0.12,
  },
  abyss: {
    colors: [
      { color: '#03050b', x: 0.5, y: 0.1 },
      { color: '#03050b', x: 0.1, y: 0.5 },
      { color: '#1b5cff', x: 0.5, y: 0.9 },
      { color: '#a9d6ff', x: 0.5, y: 1.05 },
      { color: '#03050b', x: 0.9, y: 0.5 },
    ],
    softness: 0.26,
    warp: 0.25,
  },
  lagoon: {
    colors: [
      { color: '#f6fbff', x: 0.1, y: 0.15 },
      { color: '#ffe347', x: 0.08, y: 0.8 },
      { color: '#2ed8ee', x: 0.55, y: 0.45 },
      { color: '#0a6ae0', x: 0.95, y: 0.55 },
    ],
    softness: 0.32,
    warp: 0.3,
  },
  prism: {
    colors: [
      { color: '#ff7552', x: 0.04, y: 0.75 },
      { color: '#f3efe8', x: 0.35, y: 0.45 },
      { color: '#1b38cc', x: 0.72, y: 0.35 },
      { color: '#0b1640', x: 0.95, y: 0.05 },
    ],
    softness: 0.26,
    warp: 0.15,
  },
  frost: {
    colors: [
      { color: '#a6bccb', x: 0.05, y: 0.05 },
      { color: '#3a5468', x: 0.35, y: 0.4 },
      { color: '#0c1823', x: 0.75, y: 0.6 },
      { color: '#09121b', x: 0.95, y: 0.95 },
    ],
    softness: 0.38,
    warp: 0.2,
  },
  newsprint: {
    colors: [
      { color: '#0b0b0b', x: 0.15, y: 0.85 },
      { color: '#f2efe7', x: 0.75, y: 0.2 },
      { color: '#7d7a72', x: 0.45, y: 0.5 },
    ],
    palette: ['#111111', '#f2efe7'],
    dither: 'bayer8',
    softness: 0.4,
    warp: 0.35,
  },
} satisfies Record<string, GradientOptions>

export type PresetName = keyof typeof presets

export const PRESET_NAMES = Object.keys(presets) as PresetName[]

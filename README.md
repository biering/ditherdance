# ditherdance

Dithering for the web, in two halves:

- **Images.** Floyd-Steinberg, Atkinson, Bayer and five more, on anything
  shaped like `ImageData`, in the browser, a Web Worker or Node. About 2 kB
  gzipped.
- **Gradients.** A dither gradient from any string: a soft color field,
  pixelated and thresholded through a Bayer matrix by one WebGL shader. As a
  `<dither-gradient>` element, a React or Vue component, or plain JS. About 8 kB
  gzipped.

No dependencies. **Website, editor and live demo: [dither.dance](https://dither.dance)**

```ts
import { dither, grayscale } from 'ditherdance'

const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
dither(image, { method: 'atkinson', palette: grayscale(4) })
ctx.putImageData(image, 0, 0)
```

```tsx
import { DitherGradient } from 'ditherdance/react'

<DitherGradient name={user.email} className="h-40 rounded-xl">
  <h1>Children sit on top</h1>
</DitherGradient>
```

## Images

Try every method on your own picture at [dither.dance/image](https://dither.dance/image).

### Why this one

- **No dependencies, under 4 kB gzipped.** Tree-shakeable ES modules with types.
- **Works on plain pixels.** Any `{ data, width, height }` with RGBA bytes:
  a canvas's `ImageData`, an `OffscreenCanvas` in a worker, or a buffer from
  `sharp` in Node. No DOM required.
- **In place.** It writes back into the buffer you pass, so a frame costs no
  extra copy. Alpha is never touched.
- **Fast paths.** A grey palette runs on one channel instead of three, grey
  lookups are a table read instead of a search, and kernels are flattened into
  typed arrays for the hot loop.

Rough timings for one 1920x1080 frame on an M-series Mac, Node 22:

| Method | Black and white | 4-colour palette |
|---|---|---|
| `bayer` | 6 ms | 26 ms |
| `atkinson` | | 41 ms |
| `floyd-steinberg` | 38 ms | 60 ms |

### Methods

| `method` | Kind | Look |
|---|---|---|
| `floyd-steinberg` (default) | Error diffusion | The classic: smooth, fine grain |
| `atkinson` | Error diffusion | Bright and contrasty, the early Mac look. Passes on only 6/8 of the error |
| `jarvis-judice-ninke` | Error diffusion | Softer, spreads error over 12 neighbours |
| `stucki` | Error diffusion | Like Jarvis, a little sharper |
| `burkes` | Error diffusion | Between Floyd-Steinberg and Stucki |
| `sierra` | Error diffusion | Smooth, close to Jarvis but cheaper |
| `sierra-lite` | Error diffusion | Cheapest diffusion, three taps |
| `bayer` | Ordered | A regular cross-hatch. Every pixel is independent, so it is the fastest, does not shimmer between video frames, and ports one to one to a GPU shader |

### API

```ts
dither(image, options?)    // any method, see below
diffuse(image, options?)   // error diffusion only
ordered(image, options?)   // Bayer only
```

All three dither `image` in place and return it.

| Option | Applies to | Default | |
|---|---|---|---|
| `method` | `dither` | `'floyd-steinberg'` | A kernel name or `'bayer'` |
| `palette` | all | black and white | An array of `[r, g, b]` |
| `kernel` | `diffuse` | Floyd-Steinberg | A name from `KERNELS` or your own `{ divisor, taps }` |
| `serpentine` | diffusion | `true` | Alternate row direction to break up diagonal artefacts |
| `strength` | diffusion | `1` | How much error is passed on, 0 to 1 |
| `size` | `bayer` | `4` | Matrix size: 2, 4, 8 or 16 |
| `spread` | `bayer` | gap between greys | How far the threshold pattern pushes a value, in 0 to 255 |

Palettes:

```ts
import { BLACK_WHITE, GAME_BOY, grayscale, hex } from 'ditherdance'

grayscale(4)                                  // 4 even greys
GAME_BOY                                      // the four Game Boy greens
[hex('#1d2b53'), hex('#ff004d'), hex('#fff1e8')]  // your own
```

A custom kernel, here a plain right-and-down split:

```ts
diffuse(image, { kernel: { divisor: 2, taps: [[1, 0, 1], [0, 1, 1]] } })
```

`bayer(size)` returns the threshold matrix itself, as offsets from -0.5 to 0.5,
if you want to run ordered dithering in your own shader.

#### In a worker

```ts
// worker.ts
import { dither } from 'ditherdance'
self.onmessage = ({ data: { image, options } }) => {
  dither(image, options)
  self.postMessage(image, [image.data.buffer])
}
```

#### In Node

```ts
import sharp from 'sharp'
import { dither } from 'ditherdance'

const { data, info } = await sharp('in.jpg').ensureAlpha().raw().toBuffer({ resolveWithObject: true })
dither({ data, width: info.width, height: info.height }, { method: 'atkinson' })
await sharp(data, { raw: info }).png().toFile('out.png')
```

## Gradients

Type a name at [dither.dance](https://dither.dance), or pin traits and copy the
code in the [editor](https://dither.dance/editor).

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/ditherdance@0.2/dist/element.js"></script>

<dither-gradient name="ada@example.com" style="display: block; aspect-ratio: 4 / 3"></dither-gradient>
```

```ts
import { createGradient } from 'ditherdance/gradient'

const gradient = createGradient(document.querySelector('#hero'), { name: 'ada' })
gradient.update({ pixelSize: 4 })
```

| Entry point | What it is |
|---|---|
| `ditherdance/gradient` | `createGradient`, `renderToDataURL`, `renderPixels` and the name functions |
| `ditherdance/element` | registers `<dither-gradient>` on import |
| `ditherdance/react` | `<DitherGradient>`, which renders a flat fallback color on the server |
| `ditherdance/vue` | the same `<DitherGradient>` for Vue 3, with a default slot |

React and Vue are optional peer dependencies, and only `ditherdance/react` and
`ditherdance/vue` import them. Everything else runs with no framework at all.

```vue
<script setup>
import { DitherGradient } from 'ditherdance/vue'
</script>

<template>
  <DitherGradient :name="user.email" class="h-40 rounded-xl">
    <h1>Children sit on top</h1>
  </DitherGradient>
</template>
```

### Names

`name` is the main input: a username, an email, a slug, an id. The same string
renders the same gradient every time, in every engine. Names are NFC-normalized,
trimmed and lowercased first (`normalizeName: false` hashes the raw string).

A name decides eleven traits, each a 0..1 position hashed by its own key:

| Trait | Reads as |
|---|---|
| `hue` | base hue, 0 to 360° |
| `scheme` | analogous, complementary, split, mono or triad |
| `tone` | night (mostly dark), dusk (dark and light), day (mostly light) |
| `chroma` | how saturated the palette is |
| `count` | 3, 4 or 5 colors |
| `layout` | where the colors sit |
| `softness`, `warp`, `warpScale` | how the colors melt into each other |
| `streak`, `streakAngle` | drips; one name in five gets them |

Pin a trait with `traits` and it holds for every name while the rest still vary:

```ts
createGradient(el, { name: user.id, traits: { tone: 0.1, hue: 0.62 } })
// A list narrows without fixing: the name picks one of these.
createGradient(el, { name: user.id, traits: { scheme: [0.2, 0.5] } })
```

Because traits are hashed by key rather than read from one random stream,
adding a trait later cannot change existing gradients.

### Options

Explicit options always win over what the name or preset decided.

| Option | Default | |
|---|---|---|
| `name` | | any string; drives everything below unless set |
| `traits` | | pins, see above |
| `preset` | | `haze`, `icefall`, `ember`, `solstice`, `abyss`, `lagoon`, `prism`, `frost`, `newsprint` |
| `colors` | | 1 to 8 colors, `'#hex'` or `{ color, x, y }` with x/y in 0..1 |
| `seed` | `1` | noise and scatter, when not using a name |
| `softness` | `0.35` | blend radius, as a fraction of the height |
| `warp`, `warpScale` | `0.3`, `1.6` | organic distortion |
| `streak`, `streakAngle`, `streakScale` | `0`, `90`, `6` | drips |
| `pixelSize` | `3` | one dither cell, in CSS pixels |
| `dither` | `'bayer4'` | `'bayer2'`, `'bayer4'`, `'bayer8'`, `'noise'`, `'none'` |
| `levels` | `7` | shades per channel |
| `palette` | | quantize to exactly these colors (two for 1-bit) |
| `animate` | `false` | `true`, or `'hover'`; respects reduced motion, pauses off screen |
| `speed` | `1` | drift speed |

As attributes on the element, the camelCase options become kebab-case
(`pixel-size`, `streak-angle`), lists are comma-separated, and `traits` is JSON.

### As an image

```ts
import { renderToDataURL } from 'ditherdance/gradient'

el.style.backgroundImage = `url(${renderToDataURL({ name: slug }, { width: 1200, height: 630 })})`
```

`renderPixels(normalize(options), cols, rows)` is the same algorithm in plain
JS. It returns RGBA bytes, one pixel per cell, and runs in Node.

### How it works

- **One WebGL context for the whole page.** Browsers keep about sixteen alive
  and silently drop the oldest, so every gradient draws through a single shared
  context and copies the result into its own 2D canvas. Without WebGL, the CPU
  renderer takes over.
- **One fragment per cell.** The canvas is rendered at cell resolution and
  scaled up with `image-rendering: pixelated`. Cells are snapped to whole device
  pixels, so the grid stays crisp instead of alternating 3 and 4 px.
- **OKLab blending**, so the midpoint between two colors does not go grey.
- **SSR-safe.** Importing on the server does nothing; the React and Vue
  components render a flat average color until they mount.

## Install

```sh
npm install ditherdance
```

Until the first npm release, install from GitHub:

```sh
npm install github:biering/ditherdance
```

## Development

```sh
npm install
npm test
npm run build
```

## Releasing

Releases are automated with [release-please](https://github.com/googleapis/release-please)
and driven by [conventional commits](https://www.conventionalcommits.org):
`fix:` bumps the patch, `feat:` the minor (and, before 1.0, a breaking change
too).

Every push to `main` opens or updates a release PR with the next version and
`CHANGELOG.md`. Merging it tags `vX.Y.Z`, creates the GitHub release and
publishes to npm with provenance, through npm trusted publishing.

## License

[Apache-2.0](LICENSE). Made by [Christoph Biering](https://github.com/biering).
More at [dither.dance](https://dither.dance).

# ditherdance

Fast, dependency-free dithering for anything shaped like `ImageData`.
Floyd-Steinberg, Atkinson, Bayer and five more, in the browser, a Web Worker
or Node.

**Website and live demo: [dither.dance](https://dither.dance)**

```ts
import { dither, grayscale } from 'ditherdance'

const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
dither(image, { method: 'atkinson', palette: grayscale(4) })
ctx.putImageData(image, 0, 0)
```

## Why this one

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

## Methods

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

## API

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

### In a worker

```ts
// worker.ts
import { dither } from 'ditherdance'
self.onmessage = ({ data: { image, options } }) => {
  dither(image, options)
  self.postMessage(image, [image.data.buffer])
}
```

### In Node

```ts
import sharp from 'sharp'
import { dither } from 'ditherdance'

const { data, info } = await sharp('in.jpg').ensureAlpha().raw().toBuffer({ resolveWithObject: true })
dither({ data, width: info.width, height: info.height }, { method: 'atkinson' })
await sharp(data, { raw: info }).png().toFile('out.png')
```

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

## License

[Apache-2.0](LICENSE). Made by [Christoph Biering](https://github.com/biering).
More at [dither.dance](https://dither.dance).

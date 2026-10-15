// One pass, one pixel per dither cell: the canvas is rendered at cell
// resolution and scaled up with nearest-neighbour, so a 4px cell costs one
// fragment, not sixteen. cpu.ts mirrors this file line for line.

export const VERTEX = /* glsl */ `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

export const FRAGMENT = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 uRes;
uniform int uCount;
uniform vec3 uLab[8];
uniform vec2 uPos[8];
uniform float uSoft;
uniform float uWarp;
uniform float uWarpScale;
uniform float uStreak;
uniform vec2 uStreakDir;
uniform float uStreakScale;
uniform vec2 uSeed;
uniform float uTime;
uniform int uDither;
uniform float uLevels;
uniform int uPaletteCount;
uniform vec3 uPalette[8];

out vec4 outColor;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.4;
  }
  return s / 0.78;
}

float bayer2(vec2 a) {
  a = floor(a);
  return fract(dot(a, vec2(0.5, a.y * 0.75)));
}
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

float threshold(vec2 cell) {
  if (uDither == 1) return bayer2(cell) + 0.125;
  if (uDither == 2) return bayer4(cell) + 0.03125;
  if (uDither == 3) return bayer8(cell) + 0.0078125;
  if (uDither == 4) return fract(52.9829189 * fract(dot(cell, vec2(0.06711056, 0.00583715))));
  return 0.5;
}

vec3 labToLinear(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.291485548 * c.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  return vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  );
}

vec3 toGamma(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec2 cell = vec2(floor(gl_FragCoord.x), uRes.y - 1.0 - floor(gl_FragCoord.y));
  vec2 uv = (cell + 0.5) / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 q = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  float t = uTime * 0.05;

  // Organic warp, then drips: displacement along the streak direction that
  // varies only across it, which pulls the field into icicles.
  vec2 w = q * uWarpScale + uSeed;
  q += uWarp * (vec2(fbm(w + t), fbm(w + vec2(5.2, 1.3) - t)) - 0.5) * 2.0;
  vec2 perp = vec2(-uStreakDir.y, uStreakDir.x);
  float drip = fbm(vec2(dot(q, perp) * uStreakScale + uSeed.x, uSeed.y + t));
  q += uStreakDir * uStreak * (drip - 0.5) * 2.0;

  // Softmax over squared distance: each stop owns a soft blob, blended in OKLab.
  float d[8];
  float dmin = 1e9;
  for (int i = 0; i < 8; i++) {
    if (i >= uCount) break;
    vec2 s = uPos[i];
    s += 0.05 * vec2(sin(uTime * 0.31 + float(i) * 1.7), cos(uTime * 0.23 + float(i) * 2.3));
    vec2 p = vec2((s.x - 0.5) * aspect, s.y - 0.5);
    d[i] = dot(q - p, q - p);
    dmin = min(dmin, d[i]);
  }
  vec3 lab = vec3(0.0);
  float wsum = 0.0;
  float k = 1.0 / (uSoft * uSoft);
  for (int i = 0; i < 8; i++) {
    if (i >= uCount) break;
    float wi = exp(-(d[i] - dmin) * k);
    lab += uLab[i] * wi;
    wsum += wi;
  }
  lab /= wsum;

  float th = threshold(cell);

  if (uPaletteCount >= 2) {
    // Ordered dither between the two nearest palette colors.
    float d1 = 1e9; float d2 = 1e9;
    vec3 c1 = uPalette[0]; vec3 c2 = uPalette[0];
    for (int i = 0; i < 8; i++) {
      if (i >= uPaletteCount) break;
      float di = distance(lab, uPalette[i]);
      if (di < d1) { d2 = d1; c2 = c1; d1 = di; c1 = uPalette[i]; }
      else if (di < d2) { d2 = di; c2 = uPalette[i]; }
    }
    float f = d1 / max(d1 + d2, 1e-6);
    outColor = vec4(toGamma(labToLinear(th < f ? c2 : c1)), 1.0);
    return;
  }

  vec3 rgb = toGamma(labToLinear(lab));
  if (uDither > 0) {
    float n = uLevels - 1.0;
    rgb = clamp(floor(rgb * n + th) / n, 0.0, 1.0);
  }
  outColor = vec4(rgb, 1.0);
}`

// Шейдеры первого экрана: картинка + карта глубины (белое = близко) дают объёмный параллакс.
// Точка схода коридора в координатах картинки (y вниз): VP.

export const VERTEX = `
attribute vec2 p;
varying vec2 v;
void main() {
  v = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

export const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v;
uniform sampler2D uImg;
uniform sampler2D uDepth;
uniform vec2 uRes;
uniform vec2 uLook;
uniform float uAspect;
uniform float uTime;
uniform float uMotion;

const vec2 VP = vec2(0.5, 0.44);

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Пылинки в лучах света: ячейки со случайными частицами, медленно плывут вверх.
float dust(vec2 st, float scale, float speed, float size) {
  st *= scale;
  st.y += uTime * speed * uMotion;
  vec2 id = floor(st);
  vec2 f = fract(st) - 0.5;
  float h = hash(id);
  vec2 o = (vec2(hash(id + 1.7), hash(id + 9.2)) - 0.5) * 0.6;
  o += 0.1 * vec2(sin(uTime * 0.5 + h * 6.28), cos(uTime * 0.4 + h * 6.28)) * uMotion;
  float r = length(f - o);
  float tw = 0.55 + 0.45 * sin(uTime * 1.4 * uMotion + h * 40.0);
  return smoothstep(size, 0.0, r) * step(0.62, h) * tw;
}

void main() {
  float sa = uRes.x / uRes.y;
  vec2 s = vec2(v.x, 1.0 - v.y);
  vec2 uv = s;
  if (sa > uAspect) uv.y = 0.5 + (s.y - 0.5) * (uAspect / sa);
  else uv.x = 0.5 + (s.x - 0.5) * (sa / uAspect);
  uv = 0.5 + (uv - 0.5) / 1.14;

  // Медленное «дыхание» камеры вперёд-назад и лёгкое блуждание взгляда.
  float dolly = (0.5 - 0.5 * cos(uTime * 0.45)) * uMotion;
  vec2 drift = vec2(sin(uTime * 0.23), cos(uTime * 0.19) * 0.6) * 0.012 * uMotion;
  vec2 look = uLook * vec2(0.045, 0.028) + drift;

  vec2 uvp = uv;
  for (int i = 0; i < 4; i++) {
    float d = texture2D(uDepth, uvp).r;
    float sc = 1.0 - 0.12 * dolly * (0.25 + 0.75 * d);
    uvp = VP + (uv - VP) * sc + look * (d - 0.3);
  }
  uvp = clamp(uvp, 0.002, 0.998);

  vec3 col = texture2D(uImg, uvp).rgb;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));

  // Лаймовые линии света слегка пульсируют.
  float lime = smoothstep(0.12, 0.45, col.g - max(col.r, col.b));
  col += vec3(0.28, 0.5, 0.04) * lime * (0.12 + 0.10 * sin(uTime * 1.3 * uMotion));

  // Холодное свечение в конце коридора.
  float dv = length((uvp - VP) * vec2(uAspect, 1.0));
  col += vec3(0.05, 0.13, 0.28) * exp(-dv * 5.5) * (0.4 + 0.15 * sin(uTime * 0.7 * uMotion));

  // Пыль: три слоя с разной глубиной параллакса.
  vec2 st = vec2(s.x * sa, s.y);
  float lit = 0.18 + 1.6 * smoothstep(0.04, 0.5, lum);
  float dsum = dust(st + look * 6.0, 14.0, 0.012, 0.09)
             + dust(st + look * 3.0 + 3.1, 26.0, 0.02, 0.08) * 0.8
             + dust(st + look * 1.5 + 7.7, 48.0, 0.03, 0.07) * 0.6;
  col += vec3(0.62, 0.82, 1.0) * dsum * lit * 0.55;

  // Виньетка и плёночное зерно.
  float vig = 1.0 - 0.5 * pow(length((s - 0.5) * vec2(1.1, 1.25)), 2.2);
  col *= vig;
  col += (hash(s * uRes + fract(uTime) * 91.7) - 0.5) * 0.04;

  gl_FragColor = vec4(col, 1.0);
}`;

/**
 * NebulaSky - the sky, and the kick drum's body. A Hubble-palette nebula
 * (oxygen teal, hydrogen rust, sulphur ochre on near-black) around a young
 * star cluster: on every heard kick the cluster breathes and the dense gas
 * lights up from inside; the downbeat also throws a pressure front out
 * through the gas. It grows with the level, 1 to 8.
 *
 * The gas is one fragment shader on a 400x300 WebGL buffer, drawn scaled up
 * under the game; stars and the cluster are 2D. Without a usable GPU the sky
 * is 'flat': a dark gradient, the stars and the pulsing cluster.
 *
 * draw(p, s) is stateless given s (BackgroundRenderer.skyFrame builds it), so
 * the study harness in docs/superpowers/ can capture any moment of it.
 */

import { CONFIG } from '../../config.js';
import { constrain } from '../../mathUtils.js';
import { NONE_SEC } from '../../audio/BeatTrack.js';

// The gas buffer, a quarter of the game's 800x600 canvas, drawn scaled up
const GW = 400;
const GH = 300;
const VIEW_W = 800;
const VIEW_H = 600;
// Gas parallax, and the cluster ("heart") in gas-world px: on screen it sits
// at HEART - cam * GAS_F, upper left, about (165-200, 145-170)
const GAS_F = 0.1;
const HEART = [240, 200];

// The kick's envelopes, in seconds. Everything a kick does is over by
// KICK_END_SEC, so a beat without a kick is still.
const KICK_END_SEC = 0.45;
const TAIL_START_SEC = 0.28;
const MAX_KICK_AGE_SEC = 1; // "no kick" (99) is clamped here before any maths
const BREATH_ATTACK_SEC = 0.008; // puts the peak right on the thump
const BREATH_BASE = 1.1;
const BREATH_PER_LEVEL = 0.3;
const PUSH_BASE_PX = 20; // the gas pushes out from the cluster
const PUSH_PER_LEVEL_PX = 20;
const LEVEL_UP_BREATH = 1.6; // the first kick after the level rises
const FRONT_ATTACK_SEC = 0.012;
const FRONT_DECAY_SEC = 0.3;
const FRONT_START_PX = 30;
const FRONT_SPEED_PX = 1800; // per second: clears the far corner by ~0.4 s
const FRONT_WIDEN_PX = 140; // per second
// Just before a kick lands, the space draws a small breath in
const INHALE_SEC = 0.15;
const INHALE_OFFBEAT = 0.5;
const INHALE_PUSH_PX = 6;

// Software WebGL: the shader would run on the CPU, so the sky draws flat
const SOFTWARE_RENDERER =
  /swiftshader|llvmpipe|softpipe|lavapipe|software|basic render/i;
const SEED = 20260927;

// The flat sky: a dim teal glow around the cluster, fading to the void
const FLAT_CORE = 'rgb(12, 26, 36)';
const FLAT_EDGE = 'rgb(2, 3, 6)';
const FLAT_RADIUS = 700;
const FLAT_GLOW_PX = 90; // the cluster's own glow, which pulses in flat mode
const FLAT_GLOW_ALPHA = 0.35;

// Star layers, far to near: parallax factor, count at level 1 and 8, size,
// brightness, glow, and how far (px) near stars dolly away on a kick
const LAYERS = [
  {
    f: 0.03,
    n1: 170,
    n8: 340,
    size: [0.8, 1.2],
    a: [0.18, 0.5],
    glow: 0,
    dolly: 0,
  },
  {
    f: 0.07,
    n1: 80,
    n8: 160,
    size: [1.0, 1.6],
    a: [0.3, 0.75],
    glow: 0,
    dolly: 0,
  },
  {
    f: 0.16,
    n1: 26,
    n8: 56,
    size: [1.4, 2.0],
    a: [0.5, 0.9],
    glow: 0.35,
    dolly: 3,
  },
  {
    f: 0.35,
    n1: 7,
    n8: 16,
    size: [1.8, 2.6],
    a: [0.7, 1.0],
    glow: 0.7,
    dolly: 9,
  },
];
const TINTS = [
  [200, 215, 255], // blue-white
  [242, 242, 248], // white
  [255, 226, 184], // pale gold
  [255, 178, 150], // red giant, rare
];
const PAD = 40;
const TILE_W = VIEW_W + PAD * 2;
const TILE_H = VIEW_H + PAD * 2;
const CLUSTER_N = 22; // 2 stars at level 1, all of them by level 8
const CLUSTER_AT_LEVEL_1 = 2;

/** lv: the level as 0 (level 1) to 1 (level 8). */
export const levelFraction = (level) => constrain((level - 1) / 7, 0, 1);

/** A resting frame: no kick, level 1. Drawn once at startup to link the shader. */
export const REST_FRAME = {
  t: 0,
  beatSec: 0.5,
  flow: 0,
  camX: 575,
  camY: 425,
  level: 1,
  levelAge: NONE_SEC,
  kickAge: NONE_SEC,
  prevKickAge: NONE_SEC,
  downbeat: false,
  nextKickIn: NONE_SEC,
};

const VERT = `attribute vec3 aPosition;
void main(){ vec4 q = vec4(aPosition, 1.0); q.xy = q.xy * 2.0 - 1.0; gl_Position = q; }`;

const FRAG = `precision highp float;
uniform vec2 res;
uniform float flow;   // integrated flow time: faster as the level rises
uniform vec2 cam;     // gas parallax offset, px
uniform vec2 heart;   // the nebula's heart on screen, px
uniform float lv;     // level 0..1
uniform float breath; // fast kick envelope (lights the dense gas)
uniform float push;   // outward push of the gas from the heart, px
uniform float ringR;  // shock front radius, px (downbeats only)
uniform float ringA;  // shock strength 0..~1.5
uniform float ringW;  // shock front width, px
uniform float inhale; // 0..1 just before a kick

// Tuning values; noise and hash coefficients stay literals below
const float COVER_L1 = 0.545;       // gas coverage threshold at level 1 ...
const float COVER_L8 = 0.505;       // ... and at level 8: more gas
const float BUBBLE_R0 = 90.0;       // the cluster's bubble, px, at level 1 ...
const float BUBBLE_GROWTH = 270.0;  // ... plus this by level 8
const float HEAT_START = 0.3;       // where the palette turns hot, along lv
const float HEAT_FULL = 0.6;
const vec3 COOL_THIN = vec3(0.025, 0.06, 0.17);  // oxygen blues, level 1
const vec3 COOL_MID = vec3(0.03, 0.22, 0.27);
const vec3 COOL_DENSE = vec3(0.18, 0.46, 0.52);
const vec3 HOT_THIN = vec3(0.01, 0.20, 0.25);    // teal left in the thin gas
const vec3 HOT_RUST = vec3(0.44, 0.08, 0.04);    // hydrogen rust
const vec3 HOT_OCHRE = vec3(0.62, 0.52, 0.40);   // dusty sulphur ochre
const vec3 LIGHT_COOL = vec3(0.35, 0.62, 0.68);  // the cluster's light on cool gas
const vec3 LIGHT_TEAL = vec3(0.25, 0.62, 0.68);
const vec3 LIGHT_WARM = vec3(0.85, 0.70, 0.52);  // ... on hot, dense gas
const vec3 FRONT_LIGHT = vec3(0.20, 0.32, 0.38); // the downbeat front's glow
const vec3 HEART_GLOW = vec3(0.16, 0.24, 0.30);  // the cluster's own glow
const vec3 VOID = vec3(0.006, 0.008, 0.02);      // the darkest the sky gets
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);   // luminance weights
const float KICK_LUMA_CAP = 0.255; // a kick lifts gas no brighter than this (before the shoulder)

float h(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
const mat2 M = mat2(1.6, 1.2, -1.2, 1.6);
float fbm3(vec2 p){ float v = 0.5 * n(p); p = M * p; v += 0.25 * n(p); p = M * p; v += 0.125 * n(p); return v / 0.875; }
float fbm4(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * n(p); p = M * p; a *= 0.5; } return v / 0.9375; }
float fbm5(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * n(p); p = M * p; a *= 0.5; } return v / 0.96875; }

void main(){
  vec2 sp = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) * (800.0 / res.x);
  vec2 d = sp - heart; float r = length(d); vec2 dir = d / max(r, 1.0);
  // Shock front: compression gathers the gas into the front (a lens); it
  // moves the gas more than it lights it
  float x = (r - ringR) / ringW;
  float front = exp(-x * x) * smoothstep(10.0, 80.0, r);
  float lens = -ringA * 32.0 * x * front;
  vec2 wp = sp - dir * (push * r / (r + 60.0) * exp(-r / 520.0) + lens);
  float ft = flow;
  vec2 P = (wp + cam) / 290.0 + vec2(0.006, 0.003) * ft;

  vec2 q = vec2(fbm4(P + vec2(0.0, 0.021 * ft)), fbm4(P + vec2(5.2, 1.3) - 0.017 * ft));
  vec2 W = P + 1.9 * q;
  // Big clouds and open voids: one slow octave shapes the composition
  float mac = (n(P * 0.33 + vec2(7.3, 2.1)) - 0.5) * 0.34;
  float fw = fbm5(W);
  float f = fw + mac;
  // The cluster's wind carves a bubble from level 2 on and grows it past the
  // play area by level 8: gas is cleared inside and piles up in a ragged wall
  // (the kick pushes it out). The gas itself roughens the wall's radius.
  float bub = smoothstep(0.1, 0.85, lv);
  float bR = BUBBLE_R0 + BUBBLE_GROWTH * lv;
  float rw = length(wp - heart) + (q.x - 0.5) * 120.0 + (fw - 0.5) * 170.0;
  // Square by multiplying: GLSL ES leaves a negative base to a power undefined
  float wz = (rw - bR) / (35.0 + 25.0 * lv);
  float wall = exp(-wz * wz);
  f += bub * (0.08 * wall - 0.2 * (1.0 - smoothstep(0.35 * bR, bR, rw)) * smoothstep(90.0, 200.0, r));
  // The heart's cluster lights the gas: faces turned toward it catch light
  vec2 ld = normalize(mix(vec2(0.86, 0.5), dir, smoothstep(0.0, 60.0, r)));
  float edge = clamp((f - mac - fbm5(W - ld * 0.035)) * 12.0, 0.0, 1.0);
  float near = exp(-r / 330.0);
  float cov = mix(COVER_L1, COVER_L8, lv);
  float g1 = smoothstep(cov, cov + 0.25, f);
  float g2 = smoothstep(cov + 0.10, cov + 0.30, f);
  float g3 = smoothstep(cov + 0.20, cov + 0.40, f);
  // Filaments: ridges of a second warped field, only where there is gas
  float rg = 1.0 - abs(fbm4(P * 2.1 + 2.6 * q + 4.0) * 2.0 - 1.0);
  float fil = pow(rg, 10.0) * smoothstep(cov - 0.12, cov + 0.16, f) * (0.35 + 0.8 * lv);
  // Dust lanes: broken ridges of a third field, absorbing
  float hz = fbm3(P * 1.5 + q * 1.8 + vec2(11.0, 3.0));
  float du = 1.0 - abs(hz * 2.0 - 1.0);
  float dust = smoothstep(0.80, 0.97, du) * smoothstep(0.38, 0.62, q.y) * (0.05 + 0.85 * lv);

  // Palette arc (Hubble SHO): cool oxygen ladder at level 1; by level 8 the
  // dense gas runs hydrogen rust to a dusty sulphur ochre, with oxygen teal
  // left in the thin gas around it. Hot and cool regions part along a seam.
  float heat = smoothstep(HEAT_START, HEAT_FULL, lv * 1.1 + (q.x - 0.5) * 1.8 - 0.05);
  vec3 cool = COOL_THIN * g1 * 0.65 + COOL_MID * g2 * 0.55 + COOL_DENSE * g3 * 0.32;
  vec3 hot = HOT_THIN * g1 * (1.0 - g2) * 0.7 + HOT_RUST * g2 * (1.0 - 0.5 * g3) * 0.6 + HOT_OCHRE * g3 * 0.25;
  vec3 col = mix(cool, hot, heat) * (1.0 - 2.2 * heat * (1.0 - heat) * g2) * (0.8 + 0.12 * lv);
  vec3 lightCol = mix(LIGHT_COOL, mix(LIGHT_TEAL, LIGHT_WARM, g2), heat);
  col += lightCol * (fil * 0.2 + edge * g1 * (0.04 + 0.10 * lv) * (0.5 + 1.2 * near));
  // The wall's inner face, turned to the cluster, is lit; the kick lights it more
  float rz = (rw - bR + 18.0) / 16.0;
  float rim = exp(-rz * rz) * g1 * 0.12 * lv * bub;
  col += lightCol * rim * (1.0 + 1.5 * breath);
  // The breath: dense gas lights up from inside, most near the heart; voids stay dark
  // and from level 4 up the thin gas between clouds dims: density, not area
  vec3 rest = col;
  col *= max(0.0, 1.0 + breath * ((0.15 + 0.35 * g1 + 0.35 * g2 + 0.5 * g3 + 0.9 * fil) * (0.55 + 0.9 * near) - 0.35 * lv * (1.0 - g2))) * (1.0 - 0.1 * inhale);
  // The kick may light the gas, but never past the readability line
  float lRest = dot(rest, LUMA);
  float lKick = dot(col, LUMA);
  float room = max(0.0, KICK_LUMA_CAP - lRest);
  if (lKick > lRest + room) col = rest + (col - rest) * room / (lKick - lRest);
  // Behind the front the gas thins; at the front it is compressed and lit
  col *= 1.0 - 0.05 * ringA * (1.0 - smoothstep(0.0, ringR, r)) + front * ringA * 0.7;
  col += lightCol * edge * g1 * front * ringA * 0.5;
  col += FRONT_LIGHT * front * ringA * (0.25 + 0.4 * hz * hz);
  col *= 1.0 - dust * 0.85;
  // The heart's own faint glow
  col += HEART_GLOW * exp(-r / 38.0) * (0.25 + 0.5 * lv) * (1.0 + 1.5 * breath);
  vec2 uv = sp / vec2(800.0, 600.0) - 0.5;
  col *= 1.0 - smoothstep(0.25, 0.75, length(uv * vec2(1.0, 1.25))) * 0.5;
  // Shoulder: the kick deepens the dense gas without spreading bright area
  col = VOID + 0.45 * (1.0 - exp(-col / 0.45));
  col += (h(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;

// ?sky=full or ?sky=flat forces a mode. It is read once and is never a config
// key, so it can't reach config.js through the ?tune JSON.
function requestedMode() {
  const q = new URLSearchParams(globalThis.location?.search ?? '').get('sky');
  return q === 'full' || q === 'flat' ? q : 'auto';
}

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let z = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

function glowSprite(p, c) {
  const g = p.createGraphics(32, 32);
  g.pixelDensity(1);
  const ctx = g.drawingContext;
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, `rgba(${c},0.9)`);
  grad.addColorStop(0.2, `rgba(${c},0.35)`);
  grad.addColorStop(1, `rgba(${c},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  return g.elt;
}

function spikeSprite(p, c) {
  const S = 64;
  const g = p.createGraphics(S, S);
  g.pixelDensity(1);
  const ctx = g.drawingContext;
  for (const [dx, dy] of [
    [1, 0],
    [0, 1],
  ]) {
    const grad = ctx.createLinearGradient(
      S / 2 - (dx * S) / 2,
      S / 2 - (dy * S) / 2,
      S / 2 + (dx * S) / 2,
      S / 2 + (dy * S) / 2
    );
    grad.addColorStop(0, `rgba(${c},0)`);
    grad.addColorStop(0.5, `rgba(${c},0.8)`);
    grad.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = grad;
    if (dx) ctx.fillRect(0, S / 2 - 0.5, S, 1);
    else ctx.fillRect(S / 2 - 0.5, 0, 1, S);
  }
  return g.elt;
}

// What the kick and the level do this frame; every number here is finite
function envelopes(s) {
  const cfg = CONFIG.SKY;
  const lv = levelFraction(s.level);
  const str = cfg.KICK_STRENGTH;
  const a = Math.min(s.kickAge, MAX_KICK_AGE_SEC);
  const live = s.kickAge < KICK_END_SEC;
  const tail =
    1 -
    constrain((a - TAIL_START_SEC) / (KICK_END_SEC - TAIL_START_SEC), 0, 1) **
      2;
  const accent = s.downbeat ? 1 : cfg.OFFBEAT_SHARE;
  const env = live
    ? (1 - Math.exp(-a / BREATH_ATTACK_SEC)) *
      Math.exp(-a / cfg.PULSE_DECAY_SEC) *
      tail *
      accent *
      str
    : 0;
  // The first kick after the level rises breathes deeper
  const deep =
    s.kickAge <= s.levelAge && s.levelAge < s.prevKickAge ? LEVEL_UP_BREATH : 1;
  // Only the downbeat throws the front
  const ringA =
    live && s.downbeat
      ? (1 - Math.exp(-a / FRONT_ATTACK_SEC)) *
        Math.exp(-a / FRONT_DECAY_SEC) *
        tail *
        str *
        cfg.DOWNBEAT_FRONT
      : 0;
  const nextBeat = Math.round((s.t + s.nextKickIn) / s.beatSec);
  const nextDown = ((nextBeat % 4) + 4) % 4 === 0;
  const inhale =
    s.nextKickIn < INHALE_SEC
      ? (1 - s.nextKickIn / INHALE_SEC) ** 2 *
        (nextDown ? 1 : INHALE_OFFBEAT) *
        str
      : 0;
  return {
    lv,
    ringA,
    inhale,
    breath: env * (BREATH_BASE + BREATH_PER_LEVEL * lv) * deep,
    push:
      env * (PUSH_BASE_PX + PUSH_PER_LEVEL_PX * lv) - inhale * INHALE_PUSH_PX,
    ringR: FRONT_START_PX + a * FRONT_SPEED_PX,
    ringW: FRONT_START_PX + a * FRONT_WIDEN_PX,
    hx: HEART[0] - s.camX * GAS_F,
    hy: HEART[1] - s.camY * GAS_F,
  };
}

export class NebulaSky {
  /**
   * @param {p5} p
   * @param {'auto'|'full'|'flat'} requested  ?sky= from the URL by default
   */
  constructor(p, requested = requestedMode()) {
    this.mode = 'flat';
    this.shaderLinked = false;
    this.renderer = 'none';
    this._makeStars(p);
    if (globalThis.WebGLRenderingContext) this._initGas(p, requested);
  }

  _initGas(p, requested) {
    try {
      this.g = p.createGraphics(GW, GH, p.WEBGL);
      // The shader maps gl_FragCoord to a fixed GW x GH: a HiDPI screen or
      // browser zoom would otherwise draw a different, zoomed nebula
      this.g.pixelDensity(1);
      this.g.noStroke();
      this.sh = this.g.createShader(VERT, FRAG);
      // p5 compiles on first use. A shader that fails to compile makes this
      // first draw throw (no program for useProgram), and the catch makes the
      // sky flat. One that compiles but fails to link doesn't throw, so ask WebGL.
      this._renderGas(REST_FRAME, envelopes(REST_FRAME));
      this.gl = this.g.drawingContext;
      const program = this.sh._glProgram;
      this.shaderLinked =
        !!program &&
        !!this.gl.getProgramParameter(program, this.gl.LINK_STATUS);
      const info = this.gl.getExtension('WEBGL_debug_renderer_info');
      this.renderer = String(
        info
          ? this.gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
          : this.gl.getParameter(this.gl.RENDERER)
      );
    } catch (err) {
      console.warn(
        'Sky: no WebGL, or the shader failed, so the sky is flat.',
        err
      );
      return;
    }
    if (!this.shaderLinked) {
      console.warn('Sky: the nebula shader did not link, so the sky is flat.');
      return;
    }
    const software = SOFTWARE_RENDERER.test(this.renderer);
    if (requested === 'full' || (requested === 'auto' && !software)) {
      this.mode = 'full';
    }
  }

  _makeStars(p) {
    const rnd = mulberry32(SEED);
    const lerp = (a, b, u) => a + (b - a) * u;
    this.layers = LAYERS.map((L) => {
      const stars = [];
      while (stars.length < L.n8) {
        // Far stars crowd into a faint diagonal stream that wraps with the tile
        const x = rnd() * TILE_W;
        const y = rnd() * TILE_H;
        const band =
          0.5 + 0.5 * Math.sin(2 * Math.PI * (x / TILE_W + y / TILE_H) + 1);
        if (L.f < 0.1 && rnd() > 0.2 + 0.8 * band * band) continue;
        const u = rnd();
        stars.push({
          x,
          y,
          size: lerp(L.size[0], L.size[1], rnd() ** 2),
          a: lerp(L.a[0], L.a[1], rnd() ** 1.5),
          tint: u < 0.38 ? 0 : u < 0.78 ? 1 : u < 0.96 ? 2 : 3,
          tw: 1.2 + rnd() * 4,
          ph: rnd() * 6.283,
          twk: rnd() < 0.5 ? 0.35 : 0.1,
          glint: rnd() < 0.45,
        });
      }
      // Grouped by tint, so fillStyle is set once per group
      const byTint = TINTS.map((_, k) =>
        stars.map((st, i) => ({ st, i })).filter((o) => o.st.tint === k)
      );
      return { ...L, byTint };
    });
    // The cluster: a Gaussian clump, brightest (and most central) first
    this.cluster = Array.from({ length: CLUSTER_N }, (_, i) => {
      const u = i / CLUSTER_N;
      const rad = (7 + 20 * u) * Math.sqrt(-2 * Math.log(1 - rnd() * 0.95));
      const ang = rnd() * 6.283;
      return {
        x: Math.cos(ang) * rad * 1.25,
        y: Math.sin(ang) * rad * 0.85,
        size: 1.0 + 1.6 * (1 - u) ** 2,
        a: 0.35 + 0.6 * (1 - u) ** 1.5,
        tint: rnd() < 0.75 ? 0 : 1,
        ph: rnd() * 6.283,
      };
    });
    this.fills = TINTS.map((c) => `rgb(${c})`);
    this.glows = TINTS.map((c) => glowSprite(p, c.join(',')));
    this.spikes = TINTS.map((c) => spikeSprite(p, c.join(',')));
  }

  /** Draws the whole 800x600 sky for frame s (see the class comment). */
  draw(p, s) {
    const e = envelopes(s);
    if (this.mode === 'full' && this.gl.isContextLost()) {
      console.warn('Sky: the WebGL context was lost; flat until a reload.');
      this.mode = 'flat';
    }
    if (this.mode === 'full') {
      this._renderGas(s, e);
      p.image(this.g, 0, 0, VIEW_W, VIEW_H);
    } else {
      this._drawFlat(p);
    }
    this._drawStars(p, s, e);
  }

  _renderGas(s, e) {
    const { g, sh } = this;
    g.shader(sh);
    sh.setUniform('res', [GW, GH]);
    sh.setUniform('flow', s.flow);
    sh.setUniform('cam', [s.camX * GAS_F, s.camY * GAS_F]);
    sh.setUniform('heart', [e.hx, e.hy]);
    sh.setUniform('lv', e.lv);
    sh.setUniform('breath', e.breath);
    sh.setUniform('push', e.push);
    sh.setUniform('inhale', e.inhale);
    sh.setUniform('ringR', e.ringR);
    sh.setUniform('ringA', e.ringA);
    sh.setUniform('ringW', e.ringW);
    g.rect(0, 0, GW, GH);
  }

  _drawFlat(p) {
    if (!this.flat) {
      this.flat = p.createGraphics(VIEW_W, VIEW_H);
      this.flat.pixelDensity(1);
      const ctx = this.flat.drawingContext;
      const grad = ctx.createRadialGradient(
        HEART[0],
        HEART[1],
        0,
        HEART[0],
        HEART[1],
        FLAT_RADIUS
      );
      grad.addColorStop(0, FLAT_CORE);
      grad.addColorStop(1, FLAT_EDGE);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    p.image(this.flat, 0, 0, VIEW_W, VIEW_H);
  }

  _drawStars(p, s, e) {
    const { lv, breath, ringA, ringR, ringW, hx, hy } = e;
    const t = s.t;
    const ctx = p.drawingContext;
    ctx.save();
    // A throw in here must not leave the canvas's state stack unbalanced
    try {
      ctx.globalCompositeOperation = 'lighter';
      for (let li = 0; li < this.layers.length; li++) {
        const L = this.layers[li];
        const count = L.n1 + (L.n8 - L.n1) * lv;
        const ox = s.camX * L.f;
        const oy = s.camY * L.f;
        for (let k = 0; k < TINTS.length; k++) {
          ctx.fillStyle = this.fills[k];
          for (const { st, i } of L.byTint[k]) {
            const fade = Math.min(1, count - i);
            if (fade <= 0) continue;
            let x = ((((st.x - ox) % TILE_W) + TILE_W) % TILE_W) - PAD;
            let y = ((((st.y - oy) % TILE_H) + TILE_H) % TILE_H) - PAD;
            let dx = x - hx;
            let dy = y - hy;
            const r = Math.hypot(dx, dy) || 1;
            dx /= r;
            dy /= r;
            // Near stars dolly away from the cluster on a kick; every star
            // rides the downbeat's front
            const xf = (r - ringR) / ringW;
            const front = Math.exp(-xf * xf);
            const move =
              L.dolly * breath * Math.exp(-r / 700) -
              ringA * 10 * xf * front * (0.4 + L.f * 2);
            x += dx * move;
            y += dy * move;
            const twinkle = 1 - st.twk + st.twk * Math.sin(t * st.tw + st.ph);
            const alpha = st.a * twinkle * fade * (1 + front * ringA * 1.5);
            const sz = st.size;
            ctx.globalAlpha = Math.min(1, alpha);
            ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
            if (L.glow) {
              const gl = st.glint ? front * ringA : 0;
              const gs = sz * 5 * (1 + gl * 0.8);
              ctx.globalAlpha = Math.min(1, alpha * L.glow * (1 + gl));
              ctx.drawImage(this.glows[k], x - gs / 2, y - gs / 2, gs, gs);
              if (li === 3 || gl > 0.05) {
                const ss = sz * (li === 3 ? 9 : 5) * (1 + gl * 2.2);
                ctx.globalAlpha = Math.min(1, alpha * (0.35 + gl * 0.9));
                ctx.drawImage(this.spikes[k], x - ss / 2, y - ss / 2, ss, ss);
              }
            }
          }
        }
      }
      // The cluster, which the level fills in; it flares on each kick
      const shown = CLUSTER_AT_LEVEL_1 + (CLUSTER_N - CLUSTER_AT_LEVEL_1) * lv;
      for (let i = 0; i < CLUSTER_N; i++) {
        const fade = Math.min(1, shown - i);
        if (fade <= 0) break;
        const c = this.cluster[i];
        const x = hx + c.x;
        const y = hy + c.y;
        const alpha =
          c.a *
          fade *
          (0.85 + 0.15 * Math.sin(t * 1.7 + c.ph)) *
          (1 + 0.8 * breath);
        const k = c.tint;
        ctx.fillStyle = this.fills[k];
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.fillRect(x - c.size / 2, y - c.size / 2, c.size, c.size);
        const gs = c.size * 6;
        ctx.globalAlpha = Math.min(1, alpha * 0.45);
        ctx.drawImage(this.glows[k], x - gs / 2, y - gs / 2, gs, gs);
        if (i < 2) {
          const ss = c.size * 10;
          ctx.globalAlpha = Math.min(1, alpha * 0.4);
          ctx.drawImage(this.spikes[k], x - ss / 2, y - ss / 2, ss, ss);
        }
      }
      // With no gas to light, the cluster's own glow carries the kick
      if (this.mode === 'flat') {
        const gs = FLAT_GLOW_PX * (1 + breath);
        ctx.globalAlpha = Math.min(1, FLAT_GLOW_ALPHA * (0.4 + breath));
        ctx.drawImage(this.glows[0], hx - gs / 2, hy - gs / 2, gs, gs);
      }
    } finally {
      ctx.restore();
    }
  }
}

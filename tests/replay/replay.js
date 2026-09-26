/**
 * Replay: runs the whole game (js/GameLoop.js) headless on a mock p5 with a
 * seeded Math.random, a virtual clock and scripted input, and writes one
 * SHA-1 per frame of everything the frame did: every drawing primitive with
 * the full style and transform it is drawn with, every sound and speech line,
 * and every game-state change. Two trees that write the same file look and
 * sound the same, so a refactor that should change nothing can be proved to.
 *
 * Usage: node tests/replay/replay.js <root> <out> [frames] [seed] [mode]
 *   mode 'tough' adds score and heals the hero, to reach later levels.
 *   DETAIL=a-b also writes frames a..b in full, to see what differs.
 * Normally run through compare.js.
 */
import { openSync, writeSync, closeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const [root, out] = process.argv.slice(2);
const FRAMES = Number(process.argv[4] ?? 6000);
const SEED = Number(process.argv[5] ?? 987654);
let seed = SEED;
const MODE = process.argv[6] ?? 'normal';

// mulberry32: a small seeded generator, so both trees draw the same numbers
Math.random = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const fd = openSync(out, 'w');
const [dA, dB] = (process.env.DETAIL ?? '-1--1').split('-').map(Number);
let hash = createHash('sha1');
let frameNo = 0;
let nLines = 0;
let buf = [];
const log = {
  push(line) {
    nLines++;
    hash.update(line + '\n');
    if (frameNo >= dA && frameNo <= dB) buf.push(line);
  },
  endFrame(label) {
    writeSync(fd, `${label} ${hash.digest('hex')}\n`);
    if (buf.length) writeSync(fd, buf.join('\n') + '\n');
    buf = [];
    hash = createHash('sha1');
  },
  flush() {
    this.endFrame('END');
  },
};
// Round numbers so float noise in the last bits doesn't count as a change
const R = (v) =>
  typeof v === 'number'
    ? Number.isFinite(v)
      ? +v.toPrecision(9)
      : String(v)
    : v;

// ---- virtual clock + timers
let now = 1_000_000;
const T0 = now;
Date.now = () => now;
globalThis.performance.now = () => now - T0;
let timers = [];
let timerId = 0;
globalThis.setTimeout = (fn, ms = 0) => {
  const id = ++timerId;
  timers.push({ id, at: now + ms, fn });
  return id;
};
globalThis.clearTimeout = (id) => {
  timers = timers.filter((t) => t.id !== id);
};
globalThis.setInterval = () => 0;
globalThis.clearInterval = () => {};
function runTimers() {
  for (;;) {
    timers.sort((a, b) => a.at - b.at || a.id - b.id);
    const t = timers[0];
    if (!t || t.at > now) return;
    timers.shift();
    t.fn();
  }
}

// ---- browser globals
globalThis.window = globalThis;
const listeners = {};
globalThis.addEventListener = (type, fn) => {
  (listeners[type] ??= []).push(fn);
};
globalThis.removeEventListener = (type, fn) => {
  listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn);
};
function dispatch(type, props) {
  const ev = {
    type,
    repeat: false,
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    button: 0,
    target: {},
    preventDefault() {},
    stopImmediatePropagation() {},
    ...props,
  };
  for (const fn of [...(listeners[type] ?? [])]) fn(ev);
}
const store = {};
globalThis.localStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => {
    store[k] = String(v);
  },
};
const el = () => ({
  style: {},
  appendChild() {},
  remove() {},
  addEventListener() {},
  setAttribute() {},
  classList: { add() {}, remove() {} },
});
globalThis.document = {
  getElementById: () => null,
  createElement: el,
  body: el(),
};
Object.defineProperty(globalThis, 'location', { value: { search: '' } });
globalThis.speechSynthesis = {
  getVoices: () => [],
  speak(u) {
    log.push(`SPEECH ${u.text}`);
  },
  cancel() {},
  speaking: false,
};
globalThis.SpeechSynthesisUtterance = class {
  constructor(text) {
    this.text = text;
  }
};
console.log = () => {};
console.info = () => {};
console.debug = () => {};
console.warn = (...a) => log.push(`WARN ${a.map(String).join(' ')}`);
console.error = (...a) => log.push(`ERROR ${a.map(String).join(' ')}`);

// ---- mock p5 with tracked style + transform state
let gfxCount = 0;
function toRGBA(args) {
  let a = args;
  if (a.length === 1 && a[0] && typeof a[0] === 'object') {
    if (Array.isArray(a[0])) a = a[0];
    else if (a[0].levels)
      return a[0].levels.map((v, i) => (i < 3 ? Math.round(v) : R(v)));
  }
  if (a.length === 1 && typeof a[0] === 'string') return [a[0]];
  let lv;
  if (a.length === 1) lv = [a[0], a[0], a[0], 255];
  else if (a.length === 2) lv = [a[0], a[0], a[0], a[1]];
  else if (a.length === 3) lv = [a[0], a[1], a[2], 255];
  else lv = a.slice(0, 4);
  return lv.map((v, i) => (i < 3 ? Math.round(v) : R(v)));
}

function makeP(tag, w, h) {
  const st = () => ({
    fill: [255, 255, 255, 255],
    stroke: [0, 0, 0, 255],
    sw: 1,
    blend: 'source-over',
    textSize: 12,
    textAlign: 'left,alphabetic',
    textFont: 'sans',
    imageMode: 'corner',
    tint: null,
    strokeJoin: 'miter',
    m: [1, 0, 0, 1, 0, 0],
    ctx: {
      shadowBlur: 0,
      shadowColor: 'rgba(0,0,0,0)',
      globalAlpha: 1,
      fillStyle: '#000',
    },
  });
  let s = st();
  const stack = [];
  const clone = (o) => ({ ...o, m: [...o.m], ctx: { ...o.ctx } });
  const xf = (x, y) => {
    const [a, b, c, d, e, f] = s.m;
    return [R(a * x + c * y + e), R(b * x + d * y + f)];
  };
  const styleStr = () =>
    `f=${s.fill ? s.fill.join(',') : 'none'} s=${s.stroke ? s.stroke.join(',') : 'none'} sw=${R(s.sw)} b=${s.blend} ga=${R(s.ctx.globalAlpha)} sb=${R(s.ctx.shadowBlur)} sc=${s.ctx.shadowColor} m=${s.m.slice(0, 4).map(R).join(',')}`;
  const draw = (name, pts, extra = []) => {
    log.push(
      `${tag}.${name} ${pts.map((p) => xf(...p).join(',')).join(' ')} ${extra.map(R).join(',')} | ${styleStr()}`
    );
  };
  const ctx = new Proxy(
    {},
    {
      get(_, k) {
        if (k in s.ctx) return s.ctx[k];
        if (k === 'save') return () => stack.push(clone(s));
        if (k === 'restore')
          return () => {
            s = stack.pop();
          };
        if (k === 'createRadialGradient' || k === 'createLinearGradient')
          return (...args) => {
            const g = { desc: `${k}(${args.map(R)})`, stops: [] };
            g.addColorStop = (o, c) => g.stops.push(`${R(o)}:${c}`);
            return g;
          };
        if (k === 'fillRect')
          return (...args) => {
            const fs = s.ctx.fillStyle;
            const fsStr =
              typeof fs === 'object' ? `${fs.desc}[${fs.stops.join(' ')}]` : fs;
            log.push(
              `${tag}.ctx.fillRect ${args.map(R)} fs=${fsStr} | ${styleStr()}`
            );
          };
        return (...args) => log.push(`${tag}.ctx.${String(k)}(${args.map(R)})`);
      },
      set(_, k, v) {
        s.ctx[k] = typeof v === 'number' ? v : v;
        return true;
      },
    }
  );
  let shape = null;
  const base = {
    TWO_PI: Math.PI * 2,
    PI: Math.PI,
    HALF_PI: Math.PI / 2,
    CLOSE: 'close',
    CENTER: 'center',
    CORNER: 'corner',
    LEFT: 'left',
    RIGHT: 'right',
    TOP: 'top',
    BOTTOM: 'bottom',
    MITER: 'miter',
    CHORD: 'chord',
    ADD: 'lighter',
    BLEND: 'source-over',
    SCREEN: 'screen',
    MULTIPLY: 'multiply',
    width: w,
    height: h,
    frameCount: 0,
    deltaTime: 1000 / 60,
    mouseX: 400,
    mouseY: 300,
    drawingContext: ctx,
    createCanvas(W, H) {
      this.width = W;
      this.height = H;
    },
    createGraphics(W, H) {
      return makeP(`g${++gfxCount}`, W, H);
    },
    remove() {},
    millis: () => now - T0,
    color(...a) {
      // keep unrounded values like p5's _array, rounded only at fill time
      let raw;
      if (a.length === 1) raw = [a[0], a[0], a[0], 255];
      else if (a.length === 2) raw = [a[0], a[0], a[0], a[1]];
      else if (a.length === 3) raw = [a[0], a[1], a[2], 255];
      else raw = a.slice(0, 4);
      return {
        levels: raw,
        setAlpha(v) {
          this.levels[3] = v;
        },
      };
    },
    red: (c) => (Array.isArray(c) ? c[0] : c.levels[0]),
    green: (c) => (Array.isArray(c) ? c[1] : c.levels[1]),
    blue: (c) => (Array.isArray(c) ? c[2] : c.levels[2]),
    alpha: (c) => (Array.isArray(c) ? c[3] : c.levels[3]),
    lerp: (a, b, t) => t * (b - a) + a,
    map(n, a, b, c, d, within) {
      const v = ((n - a) / (b - a)) * (d - c) + c;
      if (!within) return v;
      return c < d ? Math.max(Math.min(v, d), c) : Math.max(Math.min(v, c), d);
    },
    constrain: (n, lo, hi) => Math.max(Math.min(n, hi), lo),
    dist: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
    sin: Math.sin,
    cos: Math.cos,
    floor: Math.floor,
    min: Math.min,
    keyIsDown: (k) => keys.has(k),
    // state
    fill(...a) {
      s.fill = toRGBA(a);
    },
    noFill() {
      s.fill = null;
    },
    stroke(...a) {
      s.stroke = toRGBA(a);
    },
    noStroke() {
      s.stroke = null;
    },
    strokeWeight(v) {
      s.sw = v;
    },
    blendMode(m) {
      s.blend = m;
    },
    textSize(v) {
      s.textSize = v;
    },
    textAlign(a, b = 'alphabetic') {
      s.textAlign = `${a},${b}`;
    },
    textFont(f) {
      s.textFont = f;
    },
    imageMode(m) {
      s.imageMode = m;
    },
    tint(...a) {
      s.tint = toRGBA(a);
    },
    noTint() {
      s.tint = null;
    },
    strokeJoin(j) {
      s.strokeJoin = j;
    },
    push() {
      stack.push(clone(s));
    },
    pop() {
      s = stack.pop();
    },
    translate(x, y) {
      const [a, b, c, d, e, f] = s.m;
      s.m = [a, b, c, d, a * x + c * y + e, b * x + d * y + f];
    },
    rotate(t) {
      const [a, b, c, d, e, f] = s.m;
      const co = Math.cos(t);
      const si = Math.sin(t);
      s.m = [
        a * co + c * si,
        b * co + d * si,
        -a * si + c * co,
        -b * si + d * co,
        e,
        f,
      ];
    },
    scale(x, y = x) {
      const [a, b, c, d, e, f] = s.m;
      s.m = [a * x, b * x, c * y, d * y, e, f];
    },
    // primitives
    ellipse(x, y, w, h = w) {
      draw('ellipse', [[x, y]], [w, h]);
    },
    circle(x, y, d) {
      draw('ellipse', [[x, y]], [d, d]);
    },
    rect(x, y, w, h = w, ...r) {
      draw('rect', [[x, y]], [w, h, ...r]);
    },
    line(x1, y1, x2, y2) {
      draw('line', [
        [x1, y1],
        [x2, y2],
      ]);
    },
    triangle(a, b, c, d, e, f) {
      draw('tri', [
        [a, b],
        [c, d],
        [e, f],
      ]);
    },
    quad(a, b, c, d, e, f, g, h) {
      draw('quad', [
        [a, b],
        [c, d],
        [e, f],
        [g, h],
      ]);
    },
    arc(x, y, w, h, a, b, mode) {
      draw('arc', [[x, y]], [w, h, a, b, mode ?? '']);
    },
    text(t, x, y) {
      draw(
        'text',
        [[x, y]],
        [`"${t}" ts=${R(s.textSize)} ta=${s.textAlign} tf=${s.textFont}`]
      );
    },
    image(g, x, y, ...r) {
      draw(
        'image',
        [[x, y]],
        [g?.tag ?? '?', s.imageMode, s.tint ? s.tint.join(',') : '', ...r]
      );
    },
    beginShape() {
      shape = [];
    },
    vertex(x, y) {
      shape.push([x, y]);
    },
    endShape(mode) {
      draw('shape', shape, [mode ?? '']);
      shape = null;
    },
  };
  base.tag = tag;
  return new Proxy(base, {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k === 'symbol' || k === 'then') return undefined;
      return (...args) =>
        log.push(`${tag}.UNKNOWN.${String(k)}(${args.map(R)})`);
    },
  });
}

let keys = new Set();
const p = makeP('p', 100, 100);
let sketchP;
globalThis.p5 = function (sketch) {
  sketch(p);
  sketchP = p;
};

await import(pathToFileURL(`${root}/js/GameLoop.js`).href);
sketchP.setup();

// Log sounds, speech and state changes
const wrap = (obj, name, tag) => {
  const orig = obj[name].bind(obj);
  obj[name] = (...a) => {
    log.push(
      `${tag}.${name}(${a.map((v) => (v && typeof v === 'object' ? (v.constructor?.name ?? 'obj') : R(v))).join(',')})`
    );
    return orig(...a);
  };
};
wrap(window.audio, 'playSound', 'A');
wrap(window.audio, 'speak', 'A');
wrap(window.audio, 'speakPlayerLine', 'A');
wrap(window.gameState, 'setGameState', 'GS');

// Reseed as the run starts: work done behind the title screen, which no
// player sees, must not shift what the run draws
seed = SEED;
window.gameState.restart();

let gameOverAt = -1;
for (let f = 1; f <= FRAMES; f++) {
  const dt = f % 211 === 0 ? 70 : f % 7 === 0 ? 17 : 1000 / 60;
  now += dt;
  runTimers();
  p.frameCount = f;
  p.deltaTime = dt;
  p.mouseX = 400 + 300 * Math.cos(f * 0.021);
  p.mouseY = 300 + 220 * Math.sin(f * 0.017);
  const tgt = window.enemies[0];
  if (tgt && f % 600 < 450) {
    p.mouseX = tgt.x - window.cameraSystem.x + 400;
    p.mouseY = tgt.y - window.cameraSystem.y + 300;
  }
  keys = new Set();
  const phase = Math.floor(f / 50) % 8;
  if (phase & 1) keys.add(87);
  if (phase & 2) keys.add(68);
  if (phase === 4) keys.add(65);
  if (phase === 6) keys.add(83);
  // Input via the real listeners
  if (f % 300 === 10) dispatch('keydown', { code: 'Space', key: ' ' });
  if (f % 300 === 250) dispatch('keyup', { code: 'Space', key: ' ' });
  if (f % 97 === 5) dispatch('keydown', { code: 'ArrowUp', key: 'ArrowUp' });
  if (f % 97 === 40) dispatch('keyup', { code: 'ArrowUp', key: 'ArrowUp' });
  if (f % 131 === 7)
    dispatch('keydown', { code: 'ArrowLeft', key: 'ArrowLeft' });
  if (f % 131 === 60)
    dispatch('keyup', { code: 'ArrowLeft', key: 'ArrowLeft' });
  if (f % 173 === 3)
    dispatch('keydown', { code: 'ArrowDown', key: 'ArrowDown' });
  if (f % 173 === 30)
    dispatch('keyup', { code: 'ArrowDown', key: 'ArrowDown' });
  if (f % 157 === 9)
    dispatch('keydown', { code: 'ArrowRight', key: 'ArrowRight' });
  if (f % 157 === 80)
    dispatch('keyup', { code: 'ArrowRight', key: 'ArrowRight' });
  if (f % 400 === 100) dispatch('mousedown', { button: 0 });
  if (f % 400 === 300) dispatch('mouseup', { button: 0 });
  if (f % 450 === 20) dispatch('keydown', { code: 'KeyE', key: 'e' });
  if (f === 1500) dispatch('keydown', { code: 'KeyP', key: 'p' });
  if (f === 1560) dispatch('keydown', { code: 'KeyP', key: 'p' });
  if (f === 2000)
    dispatch('keydown', { code: 'ShiftLeft', key: 'Shift', shiftKey: true });
  if (f === 2100)
    dispatch('keydown', { code: 'KeyQ', key: 'q', shiftKey: false });
  if (f === 2500) dispatch('blur', {});
  if (f % 900 === 450) window.gameState.addScore(400); // reach later levels
  if (MODE === 'tough') {
    if (f % 300 === 150) window.gameState.addScore(400);
    if (f % 200 === 0) window.player.health = window.player.maxHealth;
  }
  const st = window.gameState.gameState;
  if (st === 'gameOver') {
    if (gameOverAt < 0) gameOverAt = f;
    if (f - gameOverAt > 90) {
      dispatch('keydown', { code: 'KeyR', key: 'r' });
      gameOverAt = -1;
    }
  }
  log.endFrame(`F${f - 1}`);
  frameNo = f;
  log.push(
    `=== F${f} ${st} score=${window.gameState.score} lvl=${window.gameState.level} hp=${R(window.player.health)} e=${window.enemies.length} pb=${window.playerBullets.length} eb=${window.enemyBullets.length}`
  );
  sketchP.draw();
}
log.flush();
closeSync(fd);
process.stderr.write(`${out}: ${FRAMES} frames, ${nLines} lines\n`);

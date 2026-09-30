import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import {
  NebulaSky,
  REST_FRAME,
} from '../../js/systems/background/NebulaSky.js';
import { CONFIG } from '../../js/config.js';
import { readFileSync } from 'node:fs';

// A p5 stand-in: a fake WebGL buffer that records uniforms, and 2D contexts
// that record every number drawn with
function fakeP5({ renderer = 'Test GPU', links = true, noWebGL = false } = {}) {
  const uniforms = {};
  const numbers = [];
  const densities = [];
  const record = (...args) => {
    for (const a of args) if (typeof a === 'number') numbers.push(a);
  };
  const gl = {
    LINK_STATUS: 0x8b82,
    RENDERER: 0x1f01,
    lost: false,
    getProgramParameter: () => links,
    getExtension: () => null,
    getParameter: () => renderer,
    isContextLost() {
      return this.lost;
    },
  };
  const ctx2d = () =>
    new Proxy(
      {},
      {
        get: (t, k) =>
          k in t
            ? t[k]
            : k === 'createRadialGradient' || k === 'createLinearGradient'
              ? () => ({ addColorStop() {} })
              : record,
        set: (t, k, v) => {
          t[k] = v;
          record(v);
          return true;
        },
      }
    );
  const p = {
    WEBGL: 'webgl',
    drawingContext: ctx2d(),
    image: record,
    createGraphics(w, h, mode) {
      if (mode === 'webgl' && noWebGL) throw new Error('no WebGL here');
      return {
        elt: {},
        drawingContext: mode === 'webgl' ? gl : ctx2d(),
        pixelDensity: (d) => mode === 'webgl' && densities.push(d),
        noStroke() {},
        shader() {},
        rect() {},
        createShader: () => ({
          _glProgram: 1,
          setUniform: (name, v) => {
            uniforms[name] = v;
          },
        }),
      };
    },
  };
  return { p, gl, uniforms, numbers, densities };
}

const frame = (over = {}) => ({ ...REST_FRAME, t: 8, flow: 3, ...over });

let hadWebGL;
beforeAll(() => {
  hadWebGL = 'WebGLRenderingContext' in globalThis;
  globalThis.WebGLRenderingContext ??= class {};
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => {
  if (!hadWebGL) delete globalThis.WebGLRenderingContext;
  vi.restoreAllMocks();
});

describe('NebulaSky', () => {
  it('draws the gas on a hardware GPU, with the buffer at pixel density 1', () => {
    const { p, densities } = fakeP5();
    const sky = new NebulaSky(p, 'auto');
    expect(sky.mode).toBe('full');
    expect(sky.shaderLinked).toBe(true);
    expect(densities).toEqual([1]);
  });

  it('keeps every uniform and every drawn number finite, kick or none', () => {
    for (const level of [1, 8]) {
      for (const kickAge of [0.02, 99, Infinity]) {
        const { p, uniforms, numbers } = fakeP5();
        const sky = new NebulaSky(p, 'full');
        sky.draw(p, frame({ level, kickAge, downbeat: true }));
        expect(Object.values(uniforms).flat().every(Number.isFinite)).toBe(
          true
        );
        expect(numbers.length).toBeGreaterThan(0);
        expect(numbers.every(Number.isFinite)).toBe(true);
      }
    }
  });

  it('breathes just after a kick and rests without one', () => {
    const { p, uniforms } = fakeP5();
    const sky = new NebulaSky(p, 'full');
    sky.draw(p, frame({ kickAge: 0.02, downbeat: true }));
    expect(uniforms.breath).toBeGreaterThan(0);
    expect(uniforms.ringA).toBeGreaterThan(0);
    sky.draw(p, frame());
    expect(uniforms.breath).toBe(0);
    expect(uniforms.ringA).toBe(0);
  });

  it('breathes deeper on the first kick after the level rises', () => {
    const { p, uniforms } = fakeP5();
    const sky = new NebulaSky(p, 'full');
    const kick = { kickAge: 0.02, prevKickAge: 0.52, downbeat: true };
    sky.draw(p, frame(kick));
    const normal = uniforms.breath;
    // The level rose 0.1 s ago: between the previous kick and this one
    sky.draw(p, frame({ ...kick, levelAge: 0.1 }));
    expect(uniforms.breath / normal).toBeCloseTo(1.6); // LEVEL_UP_BREATH
  });

  it('draws flat on a software renderer, but still links the shader', () => {
    const { p } = fakeP5({ renderer: 'Google SwiftShader' });
    const sky = new NebulaSky(p, 'auto');
    expect(sky.mode).toBe('flat');
    expect(sky.shaderLinked).toBe(true);
    const forced = fakeP5({ renderer: 'Google SwiftShader' });
    expect(new NebulaSky(forced.p, 'full').mode).toBe('full');
  });

  it('draws flat when the shader does not link, or there is no WebGL', () => {
    const broken = fakeP5({ links: false });
    const sky = new NebulaSky(broken.p, 'full');
    expect(sky.mode).toBe('flat');
    expect(sky.shaderLinked).toBe(false);
    const none = fakeP5({ noWebGL: true });
    const flat = new NebulaSky(none.p, 'full');
    expect(flat.mode).toBe('flat');
    expect(() => flat.draw(none.p, frame({ kickAge: 0.02 }))).not.toThrow();
  });

  it('drops to flat when the WebGL context is lost', () => {
    const { p, gl } = fakeP5();
    const sky = new NebulaSky(p, 'full');
    gl.lost = true;
    sky.draw(p, frame());
    expect(sky.mode).toBe('flat');
  });

  it('never raises a possibly negative number to a power in the shader', () => {
    // GLSL ES leaves pow(x, y) undefined for x < 0, and some GPUs return NaN
    const src = readFileSync(
      new URL('../../js/systems/background/NebulaSky.js', import.meta.url),
      'utf8'
    );
    // rg is 1 - abs(...), never negative
    expect(src.match(/pow\([^,]*,/g)).toEqual(['pow(rg,']);
  });

  it('ships with the level preview off', () => {
    expect(CONFIG.SKY.LEVEL_OVERRIDE).toBe(0);
  });
});

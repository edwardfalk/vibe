import { describe, it, expect, vi, afterEach } from 'vitest';
import { Player } from '../../js/entities/player.js';
import {
  heroFrame,
  heroPose,
  heroAnger,
  heroMuzzle,
  heroShoulder,
  drawPlayer,
  HERO_PARTS,
  PROTO_SIZE,
} from '../../js/entities/PlayerRenderer.js';
import { CONFIG } from '../../js/config.js';
import { transformP5 } from './helpers/transformP5.js';

const LOOK_DEFAULTS = { ...CONFIG.PLAYER_LOOK };
afterEach(() => {
  Object.assign(CONFIG.PLAYER_LOOK, LOOK_DEFAULTS);
  vi.restoreAllMocks();
});

// A pose as Player#pose gives it: walking right, unhurt, shield up
const LOOK = {
  t: 3,
  side: 1,
  aimRel: 0.2,
  moving: true,
  back: false,
  stepFoot: 0,
  stepPhase: 0,
  beat: 0.4,
  kick: 0.5,
  kickAge: 0.1,
  prevKickAge: 0.6,
  downbeatKick: 0,
  dash: 0,
  dashDir: 0,
  hp: 1,
  hurtAge: Infinity,
  shotAge: Infinity,
  firing: false,
  shield: true,
  shatterAge: Infinity,
  shieldBackAge: Infinity,
  plantAge: Infinity,
  plantAhead: true,
  footfalls: [],
};

// A hero at (0, 0), mouse at `mouse` (no camera: world coordinates, unless
// one is given)
function heroAimingAt(mouse, cameraSystem = null) {
  const p = {
    color: () => ({}),
    keyIsDown: () => false,
    constrain: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
    cos: Math.cos,
    sin: Math.sin,
    get mouseX() {
      return mouse.x;
    },
    get mouseY() {
      return mouse.y;
    },
  };
  globalThis.window = { playerIsShooting: false };
  return new Player(p, 0, 0, cameraSystem, { playerBullets: [] });
}

// A canvas context that keeps its transform and notes where each point of
// every path lands, for checking that a sprite's drawing fits its box
function boundsContext() {
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const points = [];
  const apply = ([A, B, C, D, E, F]) => {
    const [a, b, c, d, e, f] = m;
    m = [
      a * A + c * B,
      b * A + d * B,
      a * C + c * D,
      b * C + d * D,
      a * E + c * F + e,
      b * E + d * F + f,
    ];
  };
  const note = (x, y) =>
    points.push([m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]);
  const round = (x, y, rx, ry) => {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * 2 * Math.PI;
      note(x + Math.cos(a) * rx, y + Math.sin(a) * ry);
    }
  };
  const calls = {
    save: () => stack.push(m),
    restore: () => (m = stack.pop()),
    translate: (x, y) => apply([1, 0, 0, 1, x, y]),
    rotate: (r) =>
      apply([Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]),
    scale: (x, y = x) => apply([x, 0, 0, y, 0, 0]),
    moveTo: note,
    lineTo: note,
    quadraticCurveTo: (cx, cy, x, y) => (note(cx, cy), note(x, y)),
    ellipse: (x, y, rx, ry) => round(x, y, rx, ry),
    arc: (x, y, r) => round(x, y, r, r),
    fillRect: (x, y, w, h) => (note(x, y), note(x + w, y + h)),
  };
  const state = {};
  return {
    points,
    ctx: new Proxy(state, {
      get: (t, k) => calls[k] ?? t[k] ?? (() => {}),
      set: (t, k, v) => ((t[k] = v), true),
    }),
  };
}

describe('his flipbook', () => {
  it('follows his step phase, a loop every two eighths', () => {
    const at = (stepFoot, stepPhase) =>
      heroFrame({ ...LOOK, stepFoot, stepPhase });
    expect(at(0, 0)).toBe('walk0');
    expect(at(0, 0.5)).toBe('walk3');
    expect(at(1, 0)).toBe('walk6');
    expect(at(1, 0.99)).toBe('walk11');
  });

  it('backing off, picks the picture half a cycle on', () => {
    for (const [foot, phase] of [
      [0, 0.25],
      [1, 0.6],
    ]) {
      const ahead = heroFrame({
        ...LOOK,
        stepFoot: 1 - foot,
        stepPhase: phase,
      });
      expect(
        heroFrame({ ...LOOK, back: true, stepFoot: foot, stepPhase: phase })
      ).toBe(ahead);
    }
  });

  it('stands still, and leaps through three pictures on the dash', () => {
    expect(heroFrame({ ...LOOK, moving: false })).toBe('stand');
    expect(heroFrame({ ...LOOK, dash: 0.1 })).toBe('dash0');
    expect(heroFrame({ ...LOOK, dash: 0.5 })).toBe('dash1');
    expect(heroFrame({ ...LOOK, dash: 1 })).toBe('dash2');
  });

  it('kicks a bomb on through three pictures, out, held and back, ahead or back, over a dash too', () => {
    // Each picture he shows, in order, through the kick
    const shown = (o) => {
      const frames = [];
      for (let ms = 0; ms <= 450; ms += 5) {
        const f = heroFrame({
          ...LOOK,
          moving: false,
          ...o,
          plantAge: ms / 1000,
        });
        if (f !== frames.at(-1)) frames.push(f);
      }
      return frames;
    };
    const kick = (name) => [0, 1, 2, 1, 0].map((i) => `${name}${i}`);
    expect(shown({})).toEqual(['stand', ...kick('plantAhead'), 'stand']);
    expect(shown({ plantAhead: false })).toEqual([
      'stand',
      ...kick('plantBack'),
      'stand',
    ]);
    expect(shown({ dash: 0.5 })).toEqual([
      'dash1',
      ...kick('plantAhead'),
      'dash1',
    ]);
    // Held out for a while, not just a picture in passing
    const held = [];
    for (let ms = 0; ms <= 450; ms += 5) {
      if (heroFrame({ ...LOOK, plantAge: ms / 1000 }) === 'plantAhead2')
        held.push(ms);
    }
    expect(held.at(-1) - held[0]).toBeGreaterThanOrEqual(100);
  });
});

describe('his pose', () => {
  it('shows his anger from the health it names', () => {
    const at = (hp) => heroPose({ ...LOOK, hp });
    expect(at(0.71).vein).toBe(false); // the vein from about 70%
    expect(at(0.69).vein).toBe(true);
    expect(at(0.54).steam).toBe(false); // steam from about 53%
    expect(at(0.52).steam).toBe(true);
    expect(at(0.5).glow).toBe(false); // the red glow from 49%
    expect(at(0.48).glow).toBe(true);
    expect(at(0.37).tremble).toBe(0); // the tremble from about 36%
    expect(at(0.2).tremble).not.toBe(0);
    expect(heroAnger(0.15)).toBe(1); // full at 15%
  });

  it('knocks his shades crooked, holds them, then slides them back', () => {
    const askew = (hurtAge) => heroPose({ ...LOOK, hurtAge }).askew;
    expect(askew(0.1)).toBe(1);
    expect(askew(0.4)).toBeGreaterThan(0);
    expect(askew(0.4)).toBeLessThan(1);
    expect(askew(0.7)).toBe(0);
    expect(askew(Infinity)).toBe(0);
  });

  it('yells through a planting kick and leans away from it; a dash under it keeps its afterimages', () => {
    const at = (o) => heroPose({ ...LOOK, plantAge: 0.1, ...o });
    expect(at({}).yell).toBe(true);
    expect(at({}).lean).toBeLessThan(0); // back, from a kick ahead
    expect(at({ plantAhead: false }).lean).toBeGreaterThan(0);
    expect(heroPose({ ...LOOK, plantAge: 0.45 }).yell).toBe(false);
    expect(at({ dash: 0.5 })).toMatchObject({
      frame: 'plantAhead2',
      ghostFrame: 'dashGhost1',
    });
  });

  it('yells while he holds fire, grits his teeth when hit', () => {
    expect(heroPose({ ...LOOK, firing: true }).yell).toBe(true);
    expect(heroPose({ ...LOOK, hurtAge: 0.2 }).grit).toBe(true);
    expect(heroPose({ ...LOOK, hurtAge: 0.4 }).grit).toBe(false);
  });
});

describe('drawing him', () => {
  // Every state at once: walking, hurt, angry, a shot, a dash, a shattered
  // shield, a crack under him
  const busy = (player) => {
    player.poseBeats = 17.3;
    player.facing = -1;
    player.isMoving = true;
    player.isDashing = true;
    player.dashTimerMs = 150;
    player.health = 20;
    player.shieldUp = false;
    player.shieldDownMs = 200;
    player.hurtAt = 17.1;
    player.shotAt = 17.25;
    player.plantedAt = 17.1; // his kick held out
    player.footfalls = [{ x: 4, y: 20, at: 17, foot: 0 }];
  };

  it('draws without the game’s random numbers, and restores the canvas', () => {
    const player = heroAimingAt({ x: -300, y: 0 });
    for (const set of [() => {}, busy]) {
      set(player);
      const { p, calls } = transformP5();
      const spy = vi.spyOn(Math, 'random');
      drawPlayer(p, player);
      expect(spy).toHaveBeenCalledTimes(0);
      expect(calls.map(([name]) => name)).not.toContain('random'); // nor p5's
      const ctx = p.drawingContext;
      expect(ctx.alphasDrawn.length).toBeGreaterThan(0);
      expect(ctx.globalAlpha).toBe(1);
      expect(ctx.globalCompositeOperation).toBe('source-over');
      expect(ctx.depth).toBe(0); // every save restored
      expect(ctx.moved).toBe(0); // so nothing drawn next is moved by him
      // A hurt flash is one added stamp per part: the next part draws plainly
      expect(ctx.opsDrawn.includes('lighter')).toBe(set === busy);
      expect(ctx.opsDrawn.join(' ')).not.toContain('lighter lighter');
      // The last thing drawn (his health bar) isn't caught in his flash
      expect(ctx.alphasDrawn.at(-1)).toBe(1);
      expect(ctx.opsDrawn.at(-1)).toBe('source-over');
      spy.mockRestore();
    }
  });

  it('kicks toward the bomb: ahead on the side he faces, back like a mule on the other', () => {
    const player = heroAimingAt({ x: 300, y: 0 });
    player.poseBeats = 4;
    player.plantedBomb(40);
    expect(player.pose()).toMatchObject({ plantAge: 0, plantAhead: true });
    player.plantedBomb(-40);
    expect(player.pose().plantAhead).toBe(false);
    player.facing = -1; // he turned round to it
    expect(player.pose().plantAhead).toBe(true);
    expect(heroAimingAt({ x: 300, y: 0 }).pose().plantAge).toBe(Infinity);
  });

  it('draws the dash’s leap in its afterimages while he kicks, and the kick on him', () => {
    const player = heroAimingAt({ x: 300, y: 0 });
    player.poseBeats = 17.3;
    player.isDashing = true;
    player.dashTimerMs = 150;
    player.plantedAt = 17.1; // 0.1 s ago: held out
    const { p } = transformP5();
    const ctx = p.drawingContext;
    const stamped = []; // [alpha, width in his px] of each sprite drawn
    p.drawingContext = new Proxy(ctx, {
      get: (t, k) =>
        k === 'drawImage'
          ? (img, x, y, w) => stamped.push([t.globalAlpha, w])
          : t[k],
    });
    drawPlayer(p, player);
    const kickW = 46; // the kick's pictures' box; the leap's is 42
    const ghosts = stamped.filter(([a]) => a < 1);
    expect(ghosts.some(([, w]) => w === 42)).toBe(true);
    expect(ghosts.some(([, w]) => w === kickW)).toBe(false);
    expect(stamped.some(([a, w]) => a === 1 && w === kickW)).toBe(true);
  });

  it('draws at both ends of the size slider', () => {
    for (const scale of [0.7, 1.4]) {
      CONFIG.PLAYER_LOOK.ART_SCALE = scale;
      const player = heroAimingAt({ x: 300, y: 0 });
      const { p, shapes } = transformP5();
      expect(() => drawPlayer(p, player)).not.toThrow();
      expect(p.drawingContext.alphasDrawn.length).toBeGreaterThan(0);
      expect(shapes.some((sh) => sh.kind === 'ellipse')).toBe(false); // all raw canvas
    }
  });

  it('keeps a crack where it landed when he flinches', () => {
    const player = heroAimingAt({ x: 300, y: 0 });
    player.poseBeats = 17.3;
    player.footfalls = [{ x: 4, y: 20, at: 17.2, foot: 0 }];
    for (const hurtAt of [null, 17.2]) {
      player.hurtAt = hurtAt; // unhurt, then flinching
      const { p } = transformP5();
      const { points, ctx } = boundsContext();
      p.drawingContext = ctx;
      drawPlayer(p, player);
      expect(points[0]).toEqual([4, 20]); // the crack's first stroke, in the world
    }
  });

  it('fits each sprite’s drawing inside its box, ink and strokes included', () => {
    const INK = 1.2; // the widest stroke's half, and the ink round a part
    for (const [name, [[x0, y0, x1, y1], draw]] of Object.entries(HERO_PARTS)) {
      const { points, ctx } = boundsContext();
      draw({ scale() {}, drawingContext: ctx }, 1);
      expect(points.length, name).toBeGreaterThan(0);
      for (const [x, y] of points) {
        expect(x - INK, `${name} left`).toBeGreaterThanOrEqual(x0);
        expect(x + INK, `${name} right`).toBeLessThanOrEqual(x1);
        expect(y - INK, `${name} top`).toBeGreaterThanOrEqual(y0);
        expect(y + INK, `${name} bottom`).toBeLessThanOrEqual(y1);
      }
    }
  });

  it('kicks ahead past his walk and back past it, as the pictures are named', () => {
    const reach = (name) => {
      const { points, ctx } = boundsContext();
      HERO_PARTS[name][1]({ scale() {}, drawingContext: ctx }, 1);
      const xs = points.map(([x]) => x);
      return [Math.min(...xs), Math.max(...xs)];
    };
    const [standBack, standAhead] = reach('stand');
    expect(reach('plantAhead2')[1]).toBeGreaterThan(standAhead + 5);
    expect(reach('plantBack2')[0]).toBeLessThan(standBack - 5);
  });

  it('builds his sprites once at a size, and again only when ART_SCALE changes', () => {
    const player = heroAimingAt({ x: 300, y: 0 });
    const { p, graphics } = transformP5();
    drawPlayer(p, player);
    const first = graphics.length;
    expect(first).toBeGreaterThan(0);
    drawPlayer(p, player);
    expect(graphics.length).toBe(first);
    CONFIG.PLAYER_LOOK.ART_SCALE = 1.2;
    drawPlayer(p, player);
    expect(graphics.length).toBe(2 * first);
    expect(graphics.slice(0, first).every((g) => g.removed)).toBe(true);
  });
});

describe('his shots', () => {
  // How far the cursor is from the line the shot flies along
  const offLine = (b, at) =>
    Math.abs(
      Math.cos(b.angle) * (at.y - b.y) - Math.sin(b.angle) * (at.x - b.x)
    );

  it('fly along a line through the cursor, at every facing and size', () => {
    for (const scale of [0.7, 1, 1.4]) {
      CONFIG.PLAYER_LOOK.ART_SCALE = scale;
      const k = (32 * scale) / PROTO_SIZE;
      for (const at of [
        { x: 300, y: 0 },
        { x: -300, y: 40 },
        { x: 120, y: -200 },
        { x: -60, y: 250 },
      ]) {
        const player = heroAimingAt(at);
        player.update(16);
        const b = player.fireBullet();
        // Within the muzzle's 1 px to the gun's top side
        expect(offLine(b, at), `${scale} ${at.x},${at.y}`).toBeLessThanOrEqual(
          1 * k + 1e-9
        );
      }
    }
  });

  it('still aim and fire with the cursor on his shoulder', () => {
    const player = heroAimingAt({ x: 2.4, y: -7 }); // he faces right: his shoulder
    player.update(16);
    expect(Number.isFinite(player.aimAngle)).toBe(true);
    const b = player.fireBullet();
    expect(Number.isFinite(b.x) && Number.isFinite(b.y)).toBe(true);
  });

  it('leave from his rest-pose muzzle, at every facing and size', () => {
    for (const scale of [0.7, 1, 1.4]) {
      CONFIG.PLAYER_LOOK.ART_SCALE = scale;
      for (const at of [
        { x: 300, y: 0 },
        { x: -300, y: 40 },
      ]) {
        const player = heroAimingAt(at);
        player.update(16);
        const b = player.fireBullet();
        const m = heroMuzzle(
          player.x,
          player.y,
          player.aimAngle,
          player.facing,
          32 * scale
        );
        expect(b.x).toBeCloseTo(m.x, 6);
        expect(b.y).toBeCloseTo(m.y, 6);
      }
    }
  });

  it('leave from his new side on the frame he turns round', () => {
    const at = { x: 300, y: 0 };
    const player = heroAimingAt(at);
    player.update(16);
    expect(player.facing).toBe(1);
    at.x = -300; // the cursor goes behind him
    player.update(16);
    expect(player.facing).toBe(-1);
    const sh = heroShoulder(player.x, player.y, -1, player.drawnSize());
    const a = Math.atan2(at.y - sh.y, at.x - sh.x);
    expect(player.aimAngle).toBeCloseTo(a, 9);
    const b = player.fireBullet();
    const m = heroMuzzle(player.x, player.y, a, -1, player.drawnSize());
    expect(b.x).toBeCloseTo(m.x, 6);
    expect(b.y).toBeCloseTo(m.y, 6);
  });

  it('turns him round by the angle from his centre, not his shoulder', () => {
    // From his centre the cursor is inside FLIP_COS (cos -0.25); from his
    // shoulder it is past it (cos -0.41)
    const player = heroAimingAt({ x: -7.5, y: -29 });
    player.update(16);
    expect(player.facing).toBe(1);
  });

  it('aim along the arrow keys, and turn him by them', () => {
    const player = heroAimingAt({ x: 300, y: 0 });
    window.arrowLeftPressed = true;
    player.update(16);
    expect(player.aimAngle).toBe(Math.PI);
    expect(player.facing).toBe(-1);
    const b = player.fireBullet();
    const m = heroMuzzle(player.x, player.y, Math.PI, -1, player.drawnSize());
    expect(b.x).toBeCloseTo(m.x, 6);
    expect(b.y).toBeCloseTo(m.y, 6);
  });

  it('aim at the cursor in the world, through the camera', () => {
    const camera = { screenToWorld: (x, y) => ({ x: x + 100, y: y - 50 }) };
    const player = heroAimingAt({ x: 200, y: 150 }, camera);
    player.update(16);
    const b = player.fireBullet();
    const at = { x: 300, y: 100 }; // the cursor, in the world
    expect(
      Math.abs(
        Math.cos(b.angle) * (at.y - b.y) - Math.sin(b.angle) * (at.x - b.x)
      )
    ).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('fire a queued shot from his new side when he turns round on its frame', () => {
    const at = { x: 300, y: 0 };
    const player = heroAimingAt(at);
    player.update(16);
    player.queueShot(0); // due now: it fires in the next update
    at.x = -300;
    player.update(16);
    expect(player.facing).toBe(-1);
    const [b] = player.context.playerBullets;
    const m = heroMuzzle(
      player.x,
      player.y,
      player.aimAngle,
      -1,
      player.drawnSize()
    );
    expect(b.x).toBeCloseTo(m.x, 6);
    expect(b.y).toBeCloseTo(m.y, 6);
  });
});

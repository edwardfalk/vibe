import { describe, it, expect, vi, afterEach } from 'vitest';
import { CONFIG } from '../../js/config.js';
import { BaseEnemy } from '../../js/entities/BaseEnemy.js';
import { Grunt } from '../../js/entities/Grunt.js';
import { Tank } from '../../js/entities/Tank.js';
import { Rusher } from '../../js/entities/Rusher.js';
import { Stabber } from '../../js/entities/Stabber.js';
import { HEALTH_BAR_HEIGHT_PX } from '../../js/entities/BaseEnemyHelpers.js';
import { createMockP5 } from './helpers/enemyMocks.js';
import { transformP5 } from './helpers/transformP5.js';

// A beat clock frozen at a position; it opens no beat windows, so update()
// moves and aims the grunt but never fires
const clockAt = (beats) => ({
  getBeatPosition: () => beats,
  getTotalBeats: () => Math.floor(beats),
  getBeatPhase: () => beats % 1,
  getCurrentBeat: () => Math.floor(beats) % 4,
  isOnBeat: () => false,
  canGruntShoot: () => false,
  beatInterval: 500,
});
const gruntWith = (clock) => {
  const context = {
    get: (k) => (k === 'beatClock' ? clock : undefined),
    set() {},
  };
  const g = new Grunt(0, 0, 'grunt', { context }, createMockP5(), null);
  g.isSpawning = false;
  return g;
};
const DEFAULTS = { ...CONFIG.GRUNT_LOOK };

afterEach(() => {
  Object.assign(CONFIG.GRUNT_LOOK, DEFAULTS);
  vi.restoreAllMocks();
});

const tankWith = (clock) => {
  const context = {
    get: (k) => (k === 'beatClock' ? clock : undefined),
    set() {},
  };
  const t = new Tank(0, 0, 'tank', { context }, createMockP5(), null);
  t.isSpawning = false;
  return t;
};
const rusherWith = (clock) => {
  const context = {
    get: (k) => (k === 'beatClock' ? clock : undefined),
    set() {},
  };
  const r = new Rusher(0, 0, 'rusher', { context }, createMockP5(), null);
  r.isSpawning = false;
  return r;
};
const stabberWith = (clock) => {
  const context = {
    get: (k) => (k === 'beatClock' ? clock : undefined),
    set() {},
  };
  const s = new Stabber(0, 0, 'stabber', { context }, createMockP5(), null);
  s.isSpawning = false;
  return s;
};
const KINDS = [
  {
    kind: 'grunt',
    make: gruntWith,
    base: ['grunt', { size: 26, health: 2, speed: 1.2, color: null }],
    busy: (g) => {
      g.warnedOnBeat = 17; // the wind-up
    },
  },
  {
    kind: 'tank',
    make: tankWith,
    base: ['tank', { size: 50, health: 60, speed: 0.2, color: null }],
    busy: (t) => {
      t.chargingShot = true; // the second bar of his charge
      t.chargeStartBeat = 12;
      t.poseBeats = 17.3;
    },
  },
  {
    kind: 'rusher',
    make: rusherWith,
    base: ['rusher', { size: 22, health: 1, speed: 2.5, color: null }],
    busy: (r) => {
      r.cried = true; // lit by a blast, pushed, mid-fuse
      r.cryAt = 16.2;
      r.lit = { at: 16.4, by: 'blast', blastBeat: 20, beatsTotal: 4 };
      r.hitAt = 16.4;
      r.pushed = true;
      r.pushAt = 16.4;
      r.pushDir = 1;
    },
  },
  {
    kind: 'stabber',
    make: stabberWith,
    base: ['stabber', { size: 28, health: 10, speed: 2.5, color: null }],
    busy: (s) => {
      s.state = 'windup'; // winding up in bar 4, shot and pushed
      s.bar = 4;
      s.stateAt = 17.02;
      s.distance = 300;
      s.hitAt = 17.1;
      s.hitDir = 1;
      s.push = { x: 200, y: 0 };
      s.poseBeats = 17.3;
    },
  },
];

describe.each(KINDS)('a $kind', ({ make, base, busy }) => {
  it("rolls no more of the game's random numbers than any enemy does", () => {
    const spy = vi.spyOn(Math, 'random');
    new BaseEnemy(0, 0, base[0], base[1], createMockP5(), null);
    const plain = spy.mock.calls.length;
    spy.mockClear();
    make(null);
    expect(spy.mock.calls.length).toBe(plain);
  });

  it("draws without the game's random numbers, apart from the hit-shake's two", () => {
    for (const clock of [clockAt(17.3), null]) {
      const e = make(clock);
      busy(e);
      const { p } = transformP5();
      const spy = vi.spyOn(Math, 'random');
      e.draw(p);
      expect(spy).toHaveBeenCalledTimes(0);
      e.hitFlash = 5;
      e.draw(p);
      expect(spy).toHaveBeenCalledTimes(2);
      expect(p.drawingContext.globalAlpha).toBe(1); // restored after drawing
      spy.mockRestore();
    }
  });

  it('stops dancing while the game is paused, and moves on when it updates again', () => {
    let beats = 17.1;
    const clock = { ...clockAt(17.1), getBeatPosition: () => beats };
    const e = make(clock);
    e.update(100, 0);
    const before = e.pose();
    beats = 17.4; // the beat moves on, but the game is paused: no update
    expect(e.pose()).toEqual(before);
    e.update(100, 0);
    expect(e.pose().t).toBeGreaterThan(before.t);
  });
});

describe('drawing a grunt', () => {
  it('turns to face a target on its left by mirroring, not by turning upside down', () => {
    const g = gruntWith(clockAt(17.3));
    g.update(-100, 0); // its target is straight to its left
    expect(g.facing).toBe(-1);
    const { p, shapes } = transformP5();
    g.draw(p);
    // Upright and flipped: x mirrored, y still down. The jelly draws four
    // sprites (plate, nozzle, helmet, gun); the old figure drew none
    const images = shapes.filter((s) => s.kind === 'image');
    expect(images.length).toBe(4);
    for (const { matrix } of images) {
      expect(Math.sign(matrix[0])).toBe(-1);
      expect(matrix[3]).toBeGreaterThan(0);
    }
  });

  it('winds up on the beat it was warned on, and sulks on the beat it held its fire', () => {
    const g = gruntWith(clockAt(16.6));
    g.warnedOnBeat = 16;
    expect(g.pose().charge).toBeCloseTo(0.6);
    g.warnedOnBeat = null;
    g.heldOnBeat = 16;
    expect(g.pose().droop).toBeGreaterThan(0);
    g.pendingStabDeath = true; // while its "ow" plays, no event shows
    expect(g.pose().droop).toBe(0);
    g.warnedOnBeat = 16;
    g.firedAt = 16.5;
    expect(g.pose().charge).toBe(0);
    expect(g.pose().flash).toBe(0);
  });

  it("shows its chatter, in the voice it plays, and its swarm's move call", () => {
    const away = (CONFIG.GRUNT_LOOK.SPIN_SEC * (1 - Math.SQRT1_2)) / 0.5;
    const g = gruntWith(clockAt(17));
    g.lookSeed = 0.3; // his own voice is the squeak
    g.makeGruntWeirdNoise();
    expect(g.chatter).toEqual({ beat: 17, voice: 'squeak' });
    g.poseBeats = 17 + away;
    expect(g.pose().turn).toBeCloseTo(-1);
    // ?tune's one voice for every grunt is the one he plays, and shows
    const band = { ...CONFIG.BAND };
    try {
      CONFIG.BAND.CHATTER = 'whine';
      g.makeGruntWeirdNoise();
      expect(g.chatter.voice).toBe('whine');
      expect(g.pose().turn).toBe(1);
    } finally {
      Object.assign(CONFIG.BAND, band);
    }
    g.swarm = { call: { beat: 17, heading: 'advance' } };
    const lean = g.pose().back;
    g.swarm.call.heading = 'retreat';
    expect(lean).toBeGreaterThan(g.pose().back);
    g.pendingStabDeath = true; // while its "ow" plays, no event shows
    expect(g.pose().squash).toBeCloseTo(
      gruntWith(clockAt(17 + away)).pose().squash
    );
    expect(g.pose().back).toBeCloseTo(
      gruntWith(clockAt(17 + away)).pose().back
    );
  });

  it('chatters unseen, and does not throw, with no beat clock', () => {
    const g = gruntWith(null);
    g.makeGruntWeirdNoise();
    expect(g.chatter).toBe(null);
  });

  // The look settings its health bar must clear its antennae at: any hop
  // and size, and a whine's stretch up to its slider's top
  const whine = DEFAULTS.WHINE_STRETCH;
  const LOOKS = [
    [DEFAULTS.HOP_PX, DEFAULTS.ART_SCALE, whine],
    [12, DEFAULTS.ART_SCALE, whine],
    [12, 0.8, whine],
    [12, 1.6, whine],
    [DEFAULTS.HOP_PX, 1.6, whine],
    [DEFAULTS.HOP_PX, DEFAULTS.ART_SCALE, 0.5],
    [0, 1.6, 0.5],
    [12, 0.8, 0],
  ];
  const lookOf = ([hop, scale, stretch]) => {
    CONFIG.GRUNT_LOOK.HOP_PX = hop;
    CONFIG.GRUNT_LOOK.ART_SCALE = scale;
    CONFIG.GRUNT_LOOK.WHINE_STRETCH = stretch;
  };
  // Px between the lower edge of its drawn health bar and the top of
  // everything else it draws
  const barGap = (g) => {
    g.health = 1; // damaged, so its health bar shows
    const { p, shapes, calls } = transformP5();
    g.draw(p);
    const top = Math.min(
      ...shapes
        .filter((s) => s.kind === 'ellipse' && s.blend !== 'add')
        .map((s) => s.top)
    );
    const [, , barY, , barH] = calls.find(([k]) => k === 'rect');
    expect(barH).toBe(HEALTH_BAR_HEIGHT_PX);
    expect(Number.isFinite(top)).toBe(true);
    return top - (barY + barH);
  };

  it('keeps its health bar clear of its antennae, at any hop and size', () => {
    for (const look of LOOKS) {
      lookOf(look);
      for (let i = 0; i < 80; i++) {
        const g = gruntWith(clockAt(16 + i / 20));
        g.aimAngle = i % 2 ? 0.4 : Math.PI - 0.4;
        g.facing = i % 2 ? 1 : -1;
        if (i % 4 === 0) g.warnedOnBeat = Math.floor(16 + i / 20);
        if (i % 4 === 1) g.heldOnBeat = Math.floor(16 + i / 20);
        // Every other one fired on its last snare (beats 2 and 4 are odd
        // here): those do the full hop, which lifts the antennae highest
        const snare = Math.floor((16 + i / 20 - 1) / 2) * 2 + 1;
        if (i % 2 === 0) g.firedAt = snare;
        // A squeak on the snare, and its swarm's call
        if (i % 3 === 1) g.chatter = { beat: snare, voice: 'squeak' };
        if (i % 5 < 2) {
          g.swarm = {
            call: { beat: snare, heading: i % 5 ? 'retreat' : 'advance' },
          };
        }
        expect(barGap(g)).toBeGreaterThan(0);
      }
    }
  });

  it('keeps its health bar clear of a whine, and no higher than it needs', () => {
    // A whiner never fires on that snare (GruntSwarm): it hops the small hop
    for (const look of LOOKS) {
      lookOf(look);
      let closest = Infinity;
      for (let ms = 0; ms <= 400; ms += 5) {
        const g = gruntWith(clockAt(17 + ms / 500));
        g.aimAngle = 0.4;
        g.chatter = { beat: 17, voice: 'whine' };
        closest = Math.min(closest, barGap(g));
      }
      expect(closest).toBeGreaterThan(0);
      // 4.4 px measured at the defaults: it doesn't float far above it
      if (look === LOOKS[0]) expect(closest).toBeLessThan(6);
    }
  });
});

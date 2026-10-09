import { describe, it, expect, vi, afterEach } from 'vitest';
import { CONFIG } from '../../js/config.js';
import {
  EnemyDeathHandler,
  GRUNT_CHORD,
  STRUM_SEC,
} from '../../js/systems/combat/EnemyDeathHandler.js';
import { GruntDeath, makeBurst } from '../../js/entities/GruntDeath.js';
import { BaseEnemy } from '../../js/entities/BaseEnemy.js';
import { gruntPose, nextFacing } from '../../js/entities/GruntRenderer.js';
import {
  damageEnemiesInRadius,
  handleAreaDamageEvents,
} from '../../js/effects/AreaDamageHandler.js';
import { updateEnemiesAndResolveResults } from '../../js/systems/gameplay/EnemyUpdatePipeline.js';
import {
  handleRegularEnemyBulletHit,
  resolveBulletEnemyHit,
} from '../../js/systems/collision/BulletCollisionResolvers.js';
import { CollisionSystem } from '../../js/systems/CollisionSystem.js';
import { plantBomb, updateBombs } from '../../js/systems/BombSystem.js';
import { Bullet } from '../../js/entities/bullet.js';
import { DAMAGE_RESULT } from '../../js/shared/DamageResult.js';
import { transformP5 } from './helpers/transformP5.js';
import { tankWorld } from './helpers/tankWorld.js';

const LATENCY = 0.03; // the fake AudioContext's base + output latency
const SIZE = 26 * CONFIG.GRUNT_LOOK.ART_SCALE;
const poseOf = (aimAngle = 0.4) =>
  gruntPose({
    beats: 9.3,
    beatSec: 0.5,
    seed: 0.3,
    aimAngle,
    facing: nextFacing(1, aimAngle),
    size: SIZE,
  });

// A beat clock on audio time: 120 BPM from audio time 0, the eighths every
// 0.25 s; `t` is the audio clock
function audioClock(t = 0) {
  const clock = {
    t,
    audioContext: {},
    startTime: 0,
    beatInterval: 500,
    tolerance: 500 * CONFIG.BEAT_TOLERANCES.ON_BEAT,
    nowSec: () => clock.t,
  };
  return clock;
}
const aGrunt = (o = {}) => ({
  type: 'grunt',
  x: 100,
  y: 50,
  size: 26,
  facing: 1,
  lookSeed: 0.3,
  pose: () => poseOf(),
  ...o,
});
function deathWorld(t = 0, enemies = []) {
  const clock = audioClock(t);
  const audio = {
    audioContext: { baseLatency: 0.01, outputLatency: 0.02 },
    playGruntPop: vi.fn(),
    playSound: vi.fn(),
  };
  const explosionManager = {
    fragmentExplosions: [],
    addFragmentExplosion: vi.fn(),
  };
  const values = { beatClock: clock, audio, explosionManager, enemies };
  const handler = new EnemyDeathHandler({ get: (k) => values[k] });
  const kill = (enemy, blow = null) =>
    handler.handleEnemyDeath(enemy, enemy.type, enemy.x, enemy.y, blow);
  const deaths = () => explosionManager.fragmentExplosions;
  return { clock, audio, explosionManager, handler, kill, deaths };
}

describe("a grunt's death", () => {
  it('pops on the next eighth after it dies, and shows when the pop is heard', () => {
    const w = deathWorld(1.13);
    w.kill(aGrunt({ lookSeed: 0.37 }));
    const [death] = w.deaths();
    expect(death).toBeInstanceOf(GruntDeath);
    expect(death.seed).toBe(0.37); // its own look's, not the game's random numbers
    expect(death.diedAt).toBe(1.13);
    expect(death.popsAt).toBeCloseTo(1.25 + LATENCY, 9);
    expect(w.audio.playGruntPop).toHaveBeenCalledWith(
      100,
      50,
      1.25,
      ['b3', 5],
      0.37
    );
    // Today's burst and blip are gone for it
    expect(w.explosionManager.addFragmentExplosion).not.toHaveBeenCalled();
    expect(w.audio.playSound).not.toHaveBeenCalled();
  });

  it('waits for the next eighth even just after one, as on the page; within 20 ms of one, for the one after', () => {
    const w = deathWorld(1.25 + 0.05);
    w.kill(aGrunt());
    w.clock.t = 1.24;
    w.kill(aGrunt());
    expect(w.audio.playGruntPop.mock.calls.map((c) => c[2])).toEqual([
      1.5,
      1.5 + STRUM_SEC,
    ]);
  });

  it('pops on an eighth of the clock’s own grid, wherever it starts', () => {
    const w = deathWorld(1.13);
    w.clock.startTime = 100; // its eighths at 0.1 + k × 0.25
    w.kill(aGrunt());
    expect(w.audio.playGruntPop.mock.calls[0][2]).toBeCloseTo(1.35, 9);
  });

  it('the death it makes is drawn on the beat clock: whole, then popped, then gone', () => {
    const w = deathWorld(1.13);
    w.kill(aGrunt());
    const [death] = w.deaths(); // pops at 1.25, heard at 1.28
    const images = () => {
      const { p, shapes } = transformP5();
      death.draw(p);
      return shapes.filter((s) => s.kind === 'image').length;
    };
    w.clock.t = 1.27;
    expect(images()).toBe(4);
    w.clock.t = 1.29;
    expect(images()).toBe(2);
    w.clock.t = 1.28 + 1.5;
    images();
    expect(death.active).toBe(false);
  });

  it('its remains stay as long as the linger slider says', () => {
    for (const [linger, showing] of [
      [1, false],
      [2, true],
    ]) {
      CONFIG.DEATHS.LINGER = linger;
      const clock = { t: 0 };
      const d = new GruntDeath({
        x: 0,
        y: 0,
        size: SIZE,
        pose: poseOf(),
        dir: 0,
        blast: false,
        seed: 0.7,
        diedAt: 0,
        popsAt: 0.1,
        now: () => clock.t,
      });
      clock.t = 0.1 + 1.6;
      d.draw(transformP5().p);
      expect(d.active).toBe(showing);
    }
    CONFIG.DEATHS.LINGER = 1;
  });

  it('a pop still pending on a later eighth keeps its chord', () => {
    const w = deathWorld(1.13); // pops on 1.25
    w.kill(aGrunt());
    w.clock.t = 1.24; // on 1.5
    w.kill(aGrunt());
    w.clock.t = 1.3; // on 1.5 too: the next tone
    w.kill(aGrunt());
    const calls = w.audio.playGruntPop.mock.calls;
    expect(calls.map((c) => [c[2], c[3]])).toEqual([
      [1.25, GRUNT_CHORD[0]],
      [1.5, GRUNT_CHORD[0]],
      [1.5 + STRUM_SEC, GRUNT_CHORD[1]],
    ]);
  });

  it('starts the audio before it reads the clock, so its times are on the clock that draws it', () => {
    const w = deathWorld(1.13);
    // Starting the audio moves the beat clock onto audio time
    w.audio.ensureAudioContext = vi.fn(() => (w.clock.t = 3.13));
    w.kill(aGrunt());
    expect(w.deaths()[0].diedAt).toBe(3.13);
    expect(w.audio.playGruntPop.mock.calls[0][2]).toBe(3.25);
  });

  it('grunts popping on one eighth, from any frame, strum the chord, round again after five', () => {
    const w = deathWorld(1.13);
    w.kill(aGrunt());
    w.clock.t = 1.17; // a later frame, the same eighth
    w.kill(aGrunt());
    w.clock.t = 1.2;
    for (let i = 0; i < 5; i++) w.kill(aGrunt());
    const calls = w.audio.playGruntPop.mock.calls;
    expect(calls.map((c) => c[3])).toEqual([
      ...GRUNT_CHORD,
      GRUNT_CHORD[0],
      GRUNT_CHORD[1],
    ]);
    calls.forEach((c, k) => expect(c[2]).toBeCloseTo(1.25 + k * STRUM_SEC, 9));
    // Their pictures pop together
    for (const d of w.deaths()) {
      expect(d.popsAt).toBeCloseTo(1.25 + LATENCY, 9);
    }
    // The next eighth starts a new chord
    w.clock.t = 1.38;
    w.kill(aGrunt());
    expect(calls.at(-1)[2]).toBe(1.5);
    expect(calls.at(-1)[3]).toEqual(GRUNT_CHORD[0]);
  });

  it('flies the way the blow sent it; with none, the way it faced', () => {
    const w = deathWorld(1.13);
    w.kill(aGrunt(), { dir: 2, blast: true });
    w.kill(aGrunt({ facing: -1 }));
    w.kill(aGrunt({ facing: 1 }), { dir: null });
    const [blown, left, right] = w.deaths();
    expect([blown.dir, blown.blast]).toEqual([2, true]);
    expect([left.dir, left.blast]).toEqual([Math.PI, false]);
    expect(right.dir).toBe(0);
  });

  it('leaves the stabber and the rusher their burst and sounds (the tank has his own death)', () => {
    const w = deathWorld(1.13);
    for (const type of ['stabber', 'rusher']) {
      w.kill({ type, x: 0, y: 0 });
    }
    expect(w.explosionManager.addFragmentExplosion).toHaveBeenCalledTimes(2);
    expect(w.audio.playGruntPop).not.toHaveBeenCalled();
    expect(w.deaths()).toHaveLength(0);
  });

  describe('its neighbours', () => {
    afterEach(() => vi.useRealTimers());

    it('are told when it pops', () => {
      const neighbour = aGrunt({ onNearbyDeath: vi.fn() });
      const w = deathWorld(1.13, [neighbour]);
      const dead = aGrunt();
      w.kill(dead);
      expect(neighbour.onNearbyDeath).toHaveBeenCalledWith(dead, 1.25);
    });

    it('answer an eighth after its pop, not on it', () => {
      vi.useFakeTimers();
      const clock = audioClock(1.13);
      const audio = { playSound: vi.fn() };
      const values = { audio, beatClock: clock };
      const neighbour = Object.assign(Object.create(BaseEnemy.prototype), {
        type: 'grunt',
        x: 0,
        y: 0,
        health: 3,
        markedForRemoval: false,
        getContextValue: (k) => values[k],
      });
      neighbour.onNearbyDeath({ type: 'grunt', x: 10, y: 0 }, 1.25);
      // The pop is 0.12 s off; the answer an eighth (0.25 s) after it
      vi.advanceTimersByTime(369);
      expect(audio.playSound).not.toHaveBeenCalled();
      vi.advanceTimersByTime(2);
      expect(audio.playSound).toHaveBeenCalledWith('gruntResponse', 0, 0);
    });
  });
});

describe("a grunt's death, drawn", () => {
  const death = (o = {}) => {
    const clock = { t: 1.13 };
    const d = new GruntDeath({
      x: 100,
      y: 50,
      size: SIZE,
      pose: poseOf(),
      dir: 0.5,
      blast: false,
      seed: 0.3,
      diedAt: 1.13,
      popsAt: 1.28,
      now: () => clock.t,
      ...o,
    });
    return { d, clock };
  };
  const drawn = (d) => {
    const { p, shapes, calls } = transformP5();
    d.draw(p);
    return { shapes, calls, ctx: p.drawingContext };
  };

  it('hangs where it died, swelling, until its pop, then flies apart, and is gone in under 1.5 s', () => {
    const { d, clock } = death();
    // Frozen: the living grunt's drawing (plate, nozzle, helmet, gun)
    const wait = drawn(d).shapes.filter((s) => s.kind === 'image');
    expect(wait).toHaveLength(4);
    clock.t = 1.27;
    const swollen = drawn(d).shapes.filter((s) => s.kind === 'image');
    expect(swollen[0].matrix[0]).toBeGreaterThan(wait[0].matrix[0]);
    // Popped: no body, but its helmet and gun fly, and drops fill
    clock.t = 1.3;
    const pop = drawn(d);
    expect(pop.shapes.filter((s) => s.kind === 'image')).toHaveLength(2);
    expect(pop.ctx.alphasDrawn.length).toBeGreaterThan(0);
    expect(d.active).toBe(true);
    clock.t = 1.28 + 1.5;
    drawn(d);
    expect(d.active).toBe(false);
  });

  it('is drawn from the clock it was given: the same at one time, with no update between', () => {
    // So a pause, which holds the audio clock, holds it; hitstop, which
    // skips the game's update, does not
    const { d, clock } = death();
    clock.t = 1.5;
    const once = JSON.stringify(drawn(d).shapes);
    expect(JSON.stringify(drawn(d).shapes)).toBe(once);
    clock.t = 1.6;
    expect(JSON.stringify(drawn(d).shapes)).not.toBe(once);
  });

  it("its remains stay linger times as long, its gun's fade doesn't; its eyes never blink before the pop", () => {
    for (const linger of [0.5, 1, 2]) {
      const b = makeBurst({
        size: SIZE,
        pose: poseOf(),
        dir: 0,
        blast: false,
        seed: 0.7,
        linger,
      });
      b.eyes.forEach((e, i) => {
        expect(e.blinkAt).toBeGreaterThanOrEqual(0);
        expect(e.life).toBeCloseTo([1.25, 1.4][i] * linger, 9); // linger stretches them
      });
      // Blobs keep their size a while; drops shrink from the start
      const blobs = b.drops.filter((d) => d.hold > 0);
      const drops = b.drops.filter((d) => d.hold === 0);
      expect(blobs.length).toBeGreaterThanOrEqual(3);
      for (const d of blobs) {
        expect(d.life).toBeGreaterThanOrEqual(0.75 * linger - 1e-9);
        expect(d.life).toBeLessThanOrEqual(0.95 * linger + 1e-9);
      }
      for (const d of drops) {
        expect(d.life).toBeGreaterThanOrEqual(0.35 * linger - 1e-9);
        expect(d.life).toBeLessThanOrEqual(0.6 * linger + 1e-9);
      }
      expect(b.helmet.life).toBeCloseTo(1.1 * linger, 9);
      expect(b.gun.life).toBe(0.4);
    }
  });

  it('a blast flings its pieces harder', () => {
    const base = { size: SIZE, pose: poseOf(), dir: 0, seed: 0.7, linger: 1 };
    const shot = makeBurst({ ...base, blast: false });
    const blast = makeBurst({ ...base, blast: true });
    expect(blast.helmet.v / shot.helmet.v).toBeCloseTo(1.3, 9);
    expect(blast.drops[0].v / shot.drops[0].v).toBeCloseTo(1.3, 9);
  });
});

describe('every way a grunt dies hands its death the blow', () => {
  const dying = (o = {}) => ({
    ...aGrunt(),
    hitRadius: 10,
    health: 1,
    maxHealth: 3,
    markedForRemoval: false,
    takeDamage: vi.fn(() => DAMAGE_RESULT.DIED),
    ...o,
  });

  it('a blast or a cloud: away from its centre; takeDamage still gets no angle', () => {
    const grunt = dying({ x: 30, y: 40 });
    const onDeath = vi.fn();
    damageEnemiesInRadius(
      { x: 0, y: 0, radius: 60, damage: 5 },
      [grunt],
      { onDeath },
      'rusher-blast'
    );
    expect(grunt.takeDamage).toHaveBeenCalledWith(5, null, 'rusher-blast');
    expect(onDeath).toHaveBeenCalledWith(grunt, {
      dir: Math.atan2(40, 30),
      blast: true,
    });
  });

  it('the real callers hand on the blow: a hazard cloud, and a rusher blast', () => {
    const cloudKill = dying({ x: 30, y: 40 });
    const enemyDeathHandler = { handleEnemyDeath: vi.fn() };
    handleAreaDamageEvents([{ x: 0, y: 0, radius: 60, damage: 5 }], {
      enemies: [cloudKill],
      enemyDeathHandler,
    });
    expect(enemyDeathHandler.handleEnemyDeath).toHaveBeenCalledWith(
      cloudKill,
      'grunt',
      30,
      40,
      { dir: Math.atan2(40, 30), blast: true }
    );
    const blastKill = { ...dying({ x: -30, y: 40 }), update: () => null };
    const rusher = {
      ...dying({ x: 0, y: 0, type: 'rusher' }),
      update: () => ({
        type: 'rusher-explosion',
        x: 0,
        y: 0,
        radius: 150,
        damage: 35,
      }),
    };
    const collisionSystem = {
      handleRusherExplosion: vi.fn(),
      handleEnemyDeath: vi.fn(),
    };
    updateEnemiesAndResolveResults({
      enemies: [rusher, blastKill],
      enemyBullets: [],
      player: { x: 5000, y: 5000 },
      deltaTimeMs: 16,
      collisionSystem,
      gameState: { gameState: 'playing', addKill() {}, addScore() {} },
    });
    expect(collisionSystem.handleEnemyDeath).toHaveBeenCalledWith(
      blastKill,
      'grunt',
      -30,
      40,
      { dir: Math.atan2(40, -30), blast: true }
    );
  });

  it("the hero's shot: along it", () => {
    const grunt = dying({ x: 0, y: 0 });
    const shot = Bullet.acquire(0, 0, 0.7, 2, 'player');
    const handleEnemyDeath = vi.fn();
    resolveBulletEnemyHit(shot, grunt, {
      getContextValue: () => null,
      handleEnemyDeath,
      getContext: () => ({ get: () => 0, set() {} }),
    });
    expect(handleEnemyDeath).toHaveBeenCalledWith(grunt, 'grunt', 0, 0, {
      dir: 0.7,
    });
  });

  it("another alien's shot: along it, and no extra explosion", () => {
    for (const type of ['grunt', 'stabber']) {
      const enemy = dying({ type });
      const shot = Bullet.acquire(100, 50, -0.4, 2, 'enemy-grunt');
      const audio = { playSound: vi.fn() };
      const handleEnemyDeath = vi.fn();
      handleRegularEnemyBulletHit(shot, enemy, {
        getContextValue: (k) => (k === 'audio' ? audio : null),
        handleEnemyDeath,
      });
      expect(handleEnemyDeath).toHaveBeenCalledWith(enemy, type, 100, 50, {
        dir: -0.4,
      });
      const bangs = audio.playSound.mock.calls.filter(
        ([key]) => key === 'explosion'
      );
      expect(bangs).toHaveLength(type === 'grunt' ? 0 : 1);
    }
  });

  it("a tank's ball, which kills without takeDamage: along it, and no extra explosion", () => {
    const grunt = dying({ x: 0, y: 0 });
    const w = tankWorld({ hero: { x: 9999, y: 0 }, enemies: [grunt] });
    const ball = Bullet.acquire(0, 0, 0, 2, 'enemy-tank');
    ball.ownerId = 'the shooter';
    w.values.enemyBullets = [ball];
    const handleEnemyDeath = vi.fn();
    new CollisionSystem(w.context, {
      handleEnemyDeath,
    }).checkEnemyBulletsVsEnemies();
    expect(handleEnemyDeath).toHaveBeenCalledWith(grunt, 'grunt', 0, 0, {
      dir: 0,
    });
    const sounds = w.values.audio.playSound.mock.calls.map(([key]) => key);
    expect(sounds).toContain('tankBallKill');
    expect(sounds).not.toContain('explosion');
  });

  it('the bomb: away from it, and a tank it hits still takes it on his body, not his plates', () => {
    const w = tankWorld({ hero: { x: 9999, y: 0 } });
    const tank = w.tank(); // faces +x; the bomb rides on his back
    const grunt = dying({ x: tank.x - 40, y: tank.y + 30 });
    w.at(4000);
    plantBomb(w.values.activeBombs, tank, w.clock);
    const enemyDeathHandler = { handleEnemyDeath: vi.fn() };
    // On until it has blown
    for (let ms = 4000; w.values.activeBombs.length && ms < 20000; ms += 100) {
      w.at(ms);
      updateBombs({
        activeBombs: w.values.activeBombs,
        enemies: [tank, grunt],
        explosionManager: {
          addExplosion() {},
          addBombBlast() {},
          addBombCloud() {},
        },
        enemyDeathHandler,
        beatClock: w.clock,
      });
    }
    const call = enemyDeathHandler.handleEnemyDeath.mock.calls.find(
      ([e]) => e === grunt
    );
    const [, , , , blow] = call;
    expect(blow.blast).toBe(true);
    // From the bomb on his back (left of him) toward the grunt, down-left
    expect(Math.cos(blow.dir)).toBeLessThan(0);
    expect(Math.sin(blow.dir)).toBeGreaterThan(0);
    expect(Object.values(tank.plates).every((pl) => pl.hp === pl.max)).toBe(
      true
    );
  });
});

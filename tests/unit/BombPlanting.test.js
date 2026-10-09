import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleContactCollisions } from '../../js/systems/combat/PlayerContactHandlers.js';
import {
  plantBomb,
  updateBombs,
  drawBombs,
} from '../../js/systems/BombSystem.js';
import { tankBackPoint } from '../../js/entities/TankRenderer.js';
import { HazardCloud } from '../../js/effects/explosions/HazardCloud.js';
import { damageEnemiesInRadius } from '../../js/effects/AreaDamageHandler.js';
import { CONFIG } from '../../js/config.js';
import { DAMAGE_RESULT } from '../../js/shared/DamageResult.js';
import { createMockAudio } from './helpers/enemyMocks.js';
import { transformP5 } from './helpers/transformP5.js';
import { tankWorld } from './helpers/tankWorld.js';
import { BeatClock } from '../../js/audio/BeatClock.js';
import { startTime, spoken } from '../../js/audio/speech/Voicebox.js';
import { BOMB_PLANTED } from '../../js/audio/DialogueLines.js';
import * as sam from '../../js/audio/speech/engines/sam.js';
import * as espeak from '../../js/audio/speech/engines/espeak.js';

const clockAt = (beats) => ({
  getBeatPosition: () => beats,
  beatInterval: 500,
});
const touchingTank = (id, o = {}) => ({
  id,
  type: 'tank',
  x: 0,
  y: 0,
  size: 50,
  facing: 0, // facing +x: his back is -x
  isSpawning: false,
  checkCollision: () => true,
  ...o,
});
const touch = (player, enemies, activeBombs, audio = null) =>
  handleContactCollisions({
    player,
    enemies,
    activeBombs,
    audio,
    beatClock: clockAt(9),
  });

describe("planting the hero's bomb", () => {
  it('plants only from behind a tank: not at his front or sides, nor while he spawns', () => {
    for (const [x, y, plants] of [
      [-60, 0, true],
      [60, 0, false],
      [0, 60, false],
      [0, -60, false],
    ]) {
      const activeBombs = [];
      touch({ x, y }, [touchingTank(1)], activeBombs);
      expect(activeBombs.length, `hero at ${x},${y}`).toBe(plants ? 1 : 0);
    }
    const activeBombs = [];
    touch(
      { x: -60, y: 0 },
      [touchingTank(1, { isSpawning: true })],
      activeBombs
    );
    expect(activeBombs).toEqual([]);
  });

  it('touching a tank frame after frame plants one bomb on it, and the hero shouts "TIMEBOMB!" once', () => {
    const activeBombs = [];
    const audio = createMockAudio();
    for (let i = 0; i < 10; i++) {
      touch({ x: -60, y: 0 }, [touchingTank(1)], activeBombs, audio);
    }
    expect(activeBombs).toHaveLength(1);
    // From the hero (no speaker is the hero), so the shout shows over him
    // and not under the count on the bomb; forced past the gap between his
    // lines, as the count is
    expect(audio.speak.mock.calls).toEqual([
      [null, 'TIMEBOMB!', 'player', true, expect.any(Function)],
    ]);
  });

  it('each tank takes its own', () => {
    const activeBombs = [];
    const enemies = [touchingTank(1), touchingTank(2)];
    for (let i = 0; i < 10; i++) touch({ x: -60, y: 0 }, enemies, activeBombs);
    expect(activeBombs.map((b) => b.tankId).sort()).toEqual([1, 2]);
  });
});

describe('the bomb, on the beat', () => {
  // Timed from a one-beat lead; the shipped lead is timed against his voice
  // in '"TIMEBOMB!" and the count'
  const LEAD = CONFIG.BOMB.COUNT_LEAD_BEATS;
  beforeEach(() => (CONFIG.BOMB.COUNT_LEAD_BEATS = 1));
  afterEach(() => (CONFIG.BOMB.COUNT_LEAD_BEATS = LEAD));
  // Planted at beat 10.3: its beat 0, the first whole beat at least a beat
  // later (room for "TIMEBOMB!"), is beat 12. Ticks come under a beat
  // apart, as frames do; a longer gap is a stall (see the last test)
  const setup = () => {
    let beats = 10.3;
    const clock = { getBeatPosition: () => beats, beatInterval: 500 };
    const audio = createMockAudio();
    const tank = {
      id: 't',
      type: 'tank',
      x: 0,
      y: 0,
      size: 50,
      facing: 0,
      markedForRemoval: false,
      takeDamage: vi.fn(() => DAMAGE_RESULT.DAMAGED),
    };
    const activeBombs = [];
    plantBomb(activeBombs, tank, clock);
    const explosionManager = {
      addExplosion: vi.fn(),
      addBombCloud: vi.fn(),
    };
    const tick = (b) => {
      beats = b;
      updateBombs({
        activeBombs,
        enemies: [tank],
        audio,
        beatClock: clock,
        explosionManager,
      });
    };
    const ticks = (from, to) => {
      for (let b = from; b <= to + 1e-9; b += 0.25) tick(b);
    };
    const now = () => beats;
    return { tank, activeBombs, audio, explosionManager, tick, ticks, now };
  };
  const said = (audio) =>
    audio.speak.mock.calls.map(([, word, voice, force]) => [
      word,
      voice,
      force,
    ]);

  it('counts 3, 2, 1 on its beats 0, 2 and 4, each forced past the voice cooldown, and blows on beat 6', () => {
    const { activeBombs, audio, ticks, tick, now } = setup();
    const at = [];
    audio.speak.mockImplementation(() => (at.push(now()), true));
    ticks(10.5, 17.75);
    expect(said(audio)).toEqual([
      ['3', 'player', true],
      ['2', 'player', true],
      ['1', 'player', true],
    ]);
    expect(at).toEqual([12, 14, 16]); // its beats 0, 2 and 4
    expect(activeBombs).toHaveLength(1);
    tick(18);
    expect(activeBombs).toHaveLength(0);
  });

  it('with a shorter fuse, drops the words that would come before its count starts', () => {
    const saved = CONFIG.BOMB.FUSE_BEATS;
    // [fuse, words, the beats they're said on, the bang]: the last even
    // beats before the bang, from its beat 0 (beat 12) on
    for (const [fuse, words, beats, bang] of [
      [4, ['2', '1'], [12, 14], 16],
      [5, ['2', '1'], [13, 15], 17],
      [3, ['1'], [13], 15],
    ]) {
      CONFIG.BOMB.FUSE_BEATS = fuse;
      try {
        const { activeBombs, audio, ticks, now } = setup();
        const at = [];
        audio.speak.mockImplementation(() => (at.push(now()), true));
        ticks(10.5, bang - 0.25);
        expect(
          said(audio).map(([w]) => w),
          `fuse ${fuse}`
        ).toEqual(words);
        expect(at, `fuse ${fuse}`).toEqual(beats);
        expect(activeBombs).toHaveLength(1);
        ticks(bang, bang);
        expect(activeBombs, `fuse ${fuse}`).toHaveLength(0);
      } finally {
        CONFIG.BOMB.FUSE_BEATS = saved;
      }
    }
  });

  it('hurts the hero near it and knocks him away, but not one past its reach', () => {
    const hero = (x) => ({
      x,
      y: 0,
      hurt: vi.fn(() => false),
      knockBack: vi.fn(),
    });
    const near = hero(0);
    const far = hero(CONFIG.BOMB.RADIUS_PX + 30);
    for (const player of [near, far]) {
      updateBombs({
        activeBombs: [
          {
            x: 0,
            y: 0,
            facing: 0,
            plantedAt: 0,
            seenAt: 100,
            beatSec: 0.5,
            said: 3,
            tankId: 't',
            tankRef: null,
          },
        ],
        enemies: [],
        player,
        beatClock: clockAt(100),
      });
    }
    expect(near.hurt).toHaveBeenCalledWith(
      CONFIG.BOMB.PLAYER_DAMAGE_MAX,
      'bomb'
    );
    expect(near.knockBack).toHaveBeenCalledWith(
      0,
      0,
      CONFIG.PLAYER.KNOCKBACK_BOMB
    );
    expect(far.hurt).not.toHaveBeenCalled();
  });

  it('draws its reach ring at the blast radius', () => {
    const { p, calls } = transformP5();
    drawBombs(p, [
      {
        x: 0,
        y: 0,
        facing: 0,
        plantedAt: 0,
        seenAt: 0.2,
        beatSec: 0.5,
        said: 0,
      },
    ]);
    const [, , , w, h] = calls.find(([k]) => k === 'arc');
    expect([w, h]).toEqual([
      2 * CONFIG.BOMB.RADIUS_PX,
      2 * CONFIG.BOMB.RADIUS_PX,
    ]);
  });

  it('hurts the tank it is on', () => {
    const { tank, ticks } = setup();
    ticks(10.5, 18);
    expect(tank.takeDamage).toHaveBeenCalledWith(
      expect.any(Number),
      null,
      'bomb'
    );
  });

  it('holds its fuse through beats the game sat out (a hidden tab), then counts on', () => {
    const { activeBombs, audio, ticks, tick } = setup();
    ticks(10.5, 12.25); // "3" said at 12
    tick(22.25); // ten beats went by without a frame
    expect(activeBombs).toHaveLength(1);
    expect(said(audio).map(([w]) => w)).toEqual(['3']);
    ticks(22.5, 26.25); // two beats past where it stopped: "2", then "1"
    expect(said(audio).map(([w]) => w)).toEqual(['3', '2', '1']);
    ticks(26.5, 27.75);
    expect(activeBombs).toHaveLength(1);
    ticks(28, 28);
    expect(activeBombs).toHaveLength(0);
  });

  it('rides on his back, and stays where he died, still drawn and still due', () => {
    const { tank, activeBombs, ticks, explosionManager } = setup();
    tank.x = 100;
    tank.facing = Math.PI / 2;
    ticks(10.5, 12);
    const s = 50 * CONFIG.TANK_LOOK.ART_SCALE;
    const back = tankBackPoint(100, 0, s, Math.PI / 2);
    expect(activeBombs[0].x).toBeCloseTo(back.x);
    expect(activeBombs[0].y).toBeCloseTo(back.y);
    tank.y = 30; // he moves on, and is shot dead there before the bang
    tank.markedForRemoval = true;
    const died = tankBackPoint(100, 30, s, Math.PI / 2);
    ticks(12.25, 13);
    tank.x = 400; // whatever happens to the corpse
    ticks(13.25, 14);
    expect(activeBombs[0].x).toBeCloseTo(died.x);
    expect(activeBombs[0].y).toBeCloseTo(died.y);
    const { p, shapes } = transformP5();
    drawBombs(p, activeBombs);
    expect(
      shapes.some(
        (sh) =>
          Math.hypot(sh.centre?.[0] - died.x, sh.centre?.[1] - died.y) < 1e-6
      )
    ).toBe(true);
    ticks(14.25, 18);
    expect(explosionManager.addExplosion).toHaveBeenCalledWith(
      died.x,
      died.y,
      'tank-plasma'
    );
  });
});

describe('"TIMEBOMB!" and the count', () => {
  it('his "TIMEBOMB!", in his voice as cast, ends before the "3", wherever in a beat he plants and however late it is scheduled', async () => {
    const cast = CONFIG.SPEECH.SPEAKERS.player;
    const engine = { sam, espeak }[cast.engine];
    const words = spoken(cast.engine, BOMB_PLANTED);
    const { samples, sampleRate } = await engine.render(words, cast.voice);
    const shoutSec = samples.length / sampleRate; // as Voicebox times it
    // Frames come ~16 ms apart and one may land right on the "3"'s beat:
    // step finely, or the "3" is found late and an overlap hides
    const STEP_SEC = 0.0005;
    const PLANTS = 200; // across a beat, so some fall just before an eighth
    // Voicebox looks at the clock once the frame is done, or once a render
    // it waited for is ready (up to MAX_WAIT_MS); then it tells the bomb
    const LOOKS_LATE_SEC = [0, 1 / 60, 0.1, 0.5];
    const ORIGIN_SEC = 3.21;
    for (const late of LOOKS_LATE_SEC) {
      for (let k = 0; k < PLANTS; k++) {
        // A clock on audio time, as the game's, started a while after the
        // audio was: beat n at ORIGIN_SEC + n × 0.5 s
        const ctx = { currentTime: ORIGIN_SEC };
        const clock = new BeatClock(120, ctx);
        const plantedAt = 10 + k / PLANTS;
        const touchSec = ORIGIN_SEC + plantedAt * 0.5;
        ctx.currentTime = touchSec;
        const audio = createMockAudio();
        let onStart = null;
        let shoutAt = null;
        let threeAt = null;
        audio.speak.mockImplementation((_e, word, _v, _f, started) => {
          if (word === BOMB_PLANTED) onStart = started;
          if (word === '3') threeAt = ctx.currentTime;
          return true;
        });
        const activeBombs = [];
        plantBomb(activeBombs, touchingTank('t'), clock, audio);
        while (threeAt === null) {
          if (shoutAt === null && ctx.currentTime >= touchSec + late) {
            shoutAt = startTime(ctx.currentTime, clock); // as Voicebox does
            onStart?.(shoutAt);
          }
          ctx.currentTime += STEP_SEC;
          updateBombs({ activeBombs, enemies: [], audio, beatClock: clock });
        }
        const shoutEnds = shoutAt + shoutSec;
        expect(
          shoutEnds,
          `planted at beat ${plantedAt.toFixed(3)}, scheduled ${late * 1000} ms later: "TIMEBOMB!" (${shoutSec.toFixed(3)} s) ends at ${shoutEnds.toFixed(4)} s, "3" at ${threeAt.toFixed(4)} s; raise CONFIG.BOMB.COUNT_LEAD_BEATS`
        ).toBeLessThanOrEqual(threeAt);
        // and no later than it must: the first whole beat at least the
        // lead after the shout starts
        const latestSec = (CONFIG.BOMB.COUNT_LEAD_BEATS + 1) * 0.5 + STEP_SEC;
        expect(threeAt - shoutAt, 'the "3" comes late').toBeLessThanOrEqual(
          latestSec
        );
      }
    }
  }, 60000);

  it('a stall before the shout is scheduled delays the count once, not twice', () => {
    // A clock on audio time; the bomb is planted at beat 10.3
    const ORIGIN_SEC = 3.21;
    const ctx = { currentTime: ORIGIN_SEC };
    const clock = new BeatClock(120, ctx);
    ctx.currentTime = ORIGIN_SEC + 10.3 * 0.5;
    const audio = createMockAudio();
    let onStart = null;
    let threeAt = null;
    audio.speak.mockImplementation((_e, word, _v, _f, started) => {
      if (word === BOMB_PLANTED) onStart = started;
      if (word === '3') threeAt = clock.getBeatPosition();
      return true;
    });
    const activeBombs = [];
    plantBomb(activeBombs, touchingTank('t'), clock, audio);
    // A hidden tab: ten beats with no frame, and the shout is scheduled
    // before the next one
    ctx.currentTime += 10.2 * 0.5;
    const shoutBeat = clock.getBeatPosition();
    onStart(startTime(ctx.currentTime, clock));
    while (threeAt === null && clock.getBeatPosition() < 40) {
      ctx.currentTime += 0.01;
      updateBombs({ activeBombs, enemies: [], audio, beatClock: clock });
    }
    // The count follows the shout, as without the stall
    expect(threeAt - shoutBeat).toBeLessThanOrEqual(
      CONFIG.BOMB.COUNT_LEAD_BEATS + 1
    );
  });
});

describe('a bomb kills the tank it is on', () => {
  it('the blast from his back, then the plasma it leaves, even with him moving at full drift', () => {
    const w = tankWorld({ hero: { x: 3000, y: 0 } }); // far away
    const t = w.tank(); // full health, facing +x
    const clouds = [];
    const explosionManager = {
      addExplosion() {},
      addBombCloud: (x, y) =>
        clouds.push(
          new HazardCloud(x, y, 'PLASMA'),
          new HazardCloud(x, y, 'DEBRIS')
        ),
    };
    w.at(4000);
    plantBomb(w.values.activeBombs, t, w.clock);
    // On until it has blown
    for (let ms = 4000; w.values.activeBombs.length && ms < 20000; ms += 100) {
      w.at(ms);
      updateBombs({
        activeBombs: w.values.activeBombs,
        enemies: [t],
        explosionManager,
        beatClock: w.clock,
      });
    }
    expect(w.values.activeBombs).toHaveLength(0);
    expect(t.health).toBeLessThan(t.maxHealth);
    let frames = 0;
    while (t.health > 0 && frames < 120) {
      t.x += CONFIG.TANK.DRIFT_PX_S / 60; // drifting off at full speed
      for (const cloud of clouds) {
        const event = cloud.update();
        if (event) damageEnemiesInRadius(event, [t], {}, 'area');
      }
      frames++;
    }
    expect(t.health).toBeLessThanOrEqual(0);
  });
});

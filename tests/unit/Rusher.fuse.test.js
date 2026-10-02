import { describe, it, expect, afterEach } from 'vitest';
import { Rusher, strongBeatAfter } from '../../js/entities/Rusher.js';
import { DAMAGE_RESULT } from '../../js/shared/DamageResult.js';
import { CONFIG } from '../../js/config.js';
import { createMockP5 } from './helpers/enemyMocks.js';
import { beatWorld } from './helpers/beatWorld.js';

const R = CONFIG.RUSHER;
const DEFAULTS = { ...R };
const FAR = 1000;
const MS_PER_BEAT = 500;
const FRAME_MS = 16;

// A spawned rusher at (0, 0) with the hero far off.
// - step(beats): one update at that beat position.
// - walk(from, to): updates every frame, stopping before `to`; returns the
//   first non-null result.
// - run(from, to): the same up to and including `to`; returns the first
//   blast and the beat position it came on.
function fused() {
  const w = beatWorld();
  const r = new Rusher(
    0,
    0,
    'rusher',
    { context: w.context },
    createMockP5(),
    w.audio
  );
  r.isSpawning = false;
  r.spawnTimer = r.spawnDuration;
  const update = (ms) => {
    w.at(ms);
    return r.updateSpecificBehavior(FAR, 0, FRAME_MS);
  };
  const step = (beats) => update(beats * MS_PER_BEAT);
  const walk = (from, to) => {
    for (let ms = from * MS_PER_BEAT; ms < to * MS_PER_BEAT; ms += FRAME_MS) {
      const result = update(ms);
      if (result) return result;
    }
    return null;
  };
  const run = (from, to) => {
    for (let ms = from * MS_PER_BEAT; ms <= to * MS_PER_BEAT; ms += FRAME_MS) {
      const result = update(ms);
      if (result) return { result, beats: ms / MS_PER_BEAT };
    }
    return null;
  };
  return { ...w, r, step, walk, run };
}

afterEach(() => Object.assign(CONFIG.RUSHER, DEFAULTS));

describe("the rusher's fuse", () => {
  it('strongBeatAfter finds the first beat 1 or 3 at least that far on', () => {
    expect(strongBeatAfter(12, 2)).toBe(14);
    expect(strongBeatAfter(12.3, 2)).toBe(16);
    expect(strongBeatAfter(16, 0)).toBe(16);
    expect(strongBeatAfter(16.2, 0)).toBe(18);
  });

  it('a hit lights him and returns EXPLODING; lit, he ignores damage', () => {
    const { r, step } = fused();
    step(12.2);
    expect(r.takeDamage(1, null, 'hit')).toBe(DAMAGE_RESULT.EXPLODING);
    const fuse = r.lit;
    expect(fuse).toMatchObject({ by: 'hit' }); // [review-added 2026-10-02]
    expect(r.takeDamage(99, null, 'hit')).toBe(DAMAGE_RESULT.EXPLODING);
    expect(r.lit).toBe(fuse);
    expect(r.markedForRemoval).toBe(false);
  });

  it.each([
    [12.0, 14, 2],
    [12.3, 16, 4],
    [13.0, 16, 3],
    [13.6, 16, 3],
    [14.9, 18, 4],
    [15.0, 18, 3], // [review-added 2026-10-02] beat 4
    [15.5, 18, 3],
  ])(
    'lit at beat %s, he blows on beat %s, never before it, and the fuse is %s beats',
    (litAt, blastBeat, beatsTotal) => {
      const { r, step, run } = fused();
      step(litAt);
      r.takeDamage(1, null, 'hit');
      expect(r.lit).toMatchObject({ by: 'hit', blastBeat, beatsTotal });
      expect(blastBeat % 2).toBe(0); // beat 1 or 3
      const blast = run(litAt, blastBeat + 1);
      expect(blast.beats).toBeGreaterThanOrEqual(blastBeat);
      expect(blast.beats).toBeLessThan(blastBeat + 0.05);
      expect(blast.result).toEqual({
        type: 'rusher-explosion',
        x: r.x,
        y: r.y,
        radius: R.EXPLOSION_RADIUS,
        damage: R.EXPLOSION_DAMAGE,
        chain: false,
      });
    }
  );

  it('an update more than half a beat late moves his blast on to the next beat 1 or 3', () => {
    const { r, step, walk } = fused();
    step(12.0);
    r.takeDamage(1, null, 'hit'); // his blast is beat 14
    expect(walk(12.0, 13.9)).toBeNull();
    expect(step(14.6)).toBeNull(); // the first update after beat 14 comes 0.6 beat late
    expect(r.lit.blastBeat).toBe(16);
    expect(walk(14.6, 16)).toBeNull();
    expect(step(16.01)?.type).toBe('rusher-explosion');
  });

  it('a stall of whole beats moves his blast on and keeps it on 1 or 3', () => {
    const { r, step } = fused();
    step(14.0);
    r.takeDamage(1, null, 'hit'); // blast on 16, two beats
    expect(r.lit.beatsTotal).toBe(2);
    step(14.05);
    expect(step(15.1)).toBeNull(); // a beat the game sat out: on to 18
    expect(r.lit.blastBeat).toBe(18);
    expect(r.lit.beatsTotal).toBe(3); // the fuse grew back to the beats left
  });

  // [review-added 2026-10-02] runs him to the blast, through his spawn warp
  it('lit before his first update, he counts from the beat he was made on and blows on it', () => {
    const w = beatWorld();
    w.at(12.3 * MS_PER_BEAT);
    const r = new Rusher(
      0,
      0,
      'rusher',
      { context: w.context },
      createMockP5(),
      w.audio
    );
    r.takeDamage(1, null, 'hit'); // a cloud he spawned in, before any update
    expect(r.lit.blastBeat).toBe(16);
    let at = null;
    for (
      let ms = 12.3 * MS_PER_BEAT;
      at === null && ms <= 17 * MS_PER_BEAT;
      ms += FRAME_MS
    ) {
      w.at(ms);
      if (r.update(FAR, 0, FRAME_MS)) at = ms / MS_PER_BEAT; // spawn warp included
    }
    expect(at).toBeGreaterThanOrEqual(16);
    expect(at).toBeLessThan(16.05);
  });

  // [review-added 2026-10-02]
  it('a late update that moves his blast on grows his count to the beats left', () => {
    CONFIG.RUSHER.FUSE_MIN_BEATS = 1;
    const { r, step, walk } = fused();
    step(13.0);
    r.takeDamage(1, null, 'hit'); // blast on 14, one beat
    expect(r.lit.beatsTotal).toBe(1);
    expect(walk(13.0, 13.9)).toBeNull();
    expect(step(14.6)).toBeNull(); // 0.6 beat late: on to 16
    expect(r.lit).toMatchObject({ blastBeat: 16, beatsTotal: 2 });
  });

  it('a blast lights him and he blows FUSE_MIN_BEATS after the beat it went off on', () => {
    const { r, step, run } = fused();
    step(14.03); // the blast went off on beat 14, a frame late
    r.takeDamage(R.EXPLOSION_DAMAGE, null, 'rusher-blast');
    expect(r.lit).toMatchObject({ by: 'blast', blastBeat: 16, beatsTotal: 2 });
    const blast = run(14.03, 17);
    expect(blast.beats).toBeLessThan(16.05);
    expect(blast.result.chain).toBe(true);
  });

  it('a shot pushes him along its path, lit or not; a blast does not; with PUSH off nothing does', () => {
    const { r, step } = fused();
    step(12.2);
    r.velocity = { x: 3, y: 0 };
    const v = R.PUSH_PX_S / 60;
    r.takeDamage(1, Math.PI / 2, 'hit'); // lights and pushes
    expect(r.velocity.x).toBeCloseTo(3 * R.PUSH_KEEP, 6);
    expect(r.velocity.y).toBeCloseTo(v, 6);
    r.takeDamage(1, Math.PI, 'hit'); // lit: pushed again
    expect(r.velocity.x).toBeCloseTo(-v + 3 * R.PUSH_KEEP ** 2, 6);
    expect(r.velocity.y).toBeCloseTo(v * R.PUSH_KEEP, 6);
    expect(r.lit.blastBeat).toBe(16); // the fuse is untouched
    const before = { ...r.velocity };
    r.takeDamage(R.EXPLOSION_DAMAGE, null, 'rusher-blast');
    expect(r.velocity).toEqual(before);
    CONFIG.RUSHER.PUSH = false;
    r.takeDamage(1, 0, 'hit');
    expect(r.velocity).toEqual(before);
  });

  it('once pushed he brakes with PUSH_BRAKE, else with BRAKE', () => {
    for (const [angle, brake] of [
      [0, R.PUSH_BRAKE],
      [null, R.BRAKE],
    ]) {
      const { r, step, at } = fused();
      step(12.2);
      r.velocity = { x: 2, y: 0 };
      r.takeDamage(1, angle, 'hit');
      const before = Math.hypot(r.velocity.x, r.velocity.y);
      at(12.25 * MS_PER_BEAT);
      r.update(FAR, 0, FRAME_MS); // update() brakes him
      expect(Math.hypot(r.velocity.x, r.velocity.y)).toBeCloseTo(
        before * brake ** (FRAME_MS / CONFIG.GAME_SETTINGS.FRAME_TIME_MS),
        6
      );
    }
  });

  // [review-added 2026-10-02: Codex]
  it('pushed during his spawn, he brakes from the first frame', () => {
    const { r, at } = fused();
    r.isSpawning = true;
    r.spawnTimer = 0;
    at(12.2 * MS_PER_BEAT);
    r.takeDamage(1, 0, 'hit');
    const before = Math.hypot(r.velocity.x, r.velocity.y);
    expect(before).toBeCloseTo(R.PUSH_PX_S / 60, 6); // the shot pushed him
    r.update(FAR, 0, FRAME_MS);
    expect(r.isSpawning).toBe(true);
    expect(Math.hypot(r.velocity.x, r.velocity.y)).toBeCloseTo(
      before * R.PUSH_BRAKE ** (FRAME_MS / CONFIG.GAME_SETTINGS.FRAME_TIME_MS),
      6
    );
  });

  // [review-added 2026-10-02: Codex]
  it('blowing up against the wall, his blast is where he is, inside the world', () => {
    const { r, step, walk } = fused();
    step(13.0);
    r.takeDamage(1, null, 'hit'); // blast on 16
    expect(walk(13.0, 16)).toBeNull();
    const halfW = CONFIG.GAME_SETTINGS.WORLD_WIDTH / 2 - r.size / 2;
    r.x = halfW + 40; // carried past the wall since his last update
    const blast = step(16.01);
    expect(blast.x).toBe(r.x);
    expect(blast.x).toBeLessThanOrEqual(halfW);
  });

  it('with no beat clock, lit, he never blows', () => {
    const context = { get: () => null, set() {} };
    const r = new Rusher(0, 0, 'rusher', { context }, createMockP5(), null);
    r.isSpawning = false;
    r.takeDamage(1, null, 'hit');
    for (let i = 0; i < 600; i++) {
      expect(r.updateSpecificBehavior(FAR, 0, FRAME_MS)).toBeNull();
    }
  });
});

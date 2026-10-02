import { describe, it, expect, afterEach } from 'vitest';
import { Rusher } from '../../js/entities/Rusher.js';
import { CONFIG } from '../../js/config.js';
import { createMockP5 } from './helpers/enemyMocks.js';
import { beatWorld } from './helpers/beatWorld.js';

const R = CONFIG.RUSHER;
const DEFAULTS = { ...R };
const FAR = 1000; // px: a hero this far off neither hears his cry nor lights him
const DEG = Math.PI / 180;

// A rusher at (0, 0), spawned, in a world whose clock at(ms) sets: a beat is
// 500 ms. step(ms, hx, hy) is one update at ms with the hero at (hx, hy)
function flight(values = {}) {
  const w = beatWorld(values);
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
  const step = (ms, hx = FAR, hy = 0) => {
    w.at(ms);
    return r.updateSpecificBehavior(hx, hy, 16);
  };
  return { ...w, r, step };
}

afterEach(() => Object.assign(CONFIG.RUSHER, DEFAULTS));

describe('the rusher in flight', () => {
  it('cruises until a new beat, then boosts and coasts back toward cruising', () => {
    const { r, step } = flight();
    step(1010); // his first update: no boost yet
    expect(r.speedNow).toBe(R.CRUISE_PX_S);
    step(1300); // the same beat
    expect(r.boostAt).toBeNull();
    step(1505); // a new beat: the boost
    expect(r.speedNow).toBeCloseTo(R.BOOST_PX_S, 6);
    step(1900); // 0.4 s on
    expect(r.speedNow).toBeGreaterThan(R.CRUISE_PX_S);
    expect(r.speedNow).toBeLessThan(R.BOOST_PX_S * 0.7);
  });

  it('turns toward the hero by at most TURN_STEP_DEG, only on a new beat, and flies straight between', () => {
    const { r, step } = flight();
    expect(r.heading).toBe(0); // no hero in the context: he spawned facing 0
    step(1010, -FAR, 0); // the hero straight behind him
    expect(r.heading).toBe(0);
    step(1505, -FAR, 0); // the boost starts a turn of at most the step
    step(1705, -FAR, 0); // TURN_SEC (0.12 s) has passed
    expect(r.heading).toBeCloseTo(R.TURN_STEP_DEG * DEG, 6);
    expect(Math.atan2(r.velocity.y, r.velocity.x)).toBeCloseTo(r.heading, 6);
    step(1950, -FAR, 0); // still that beat: no further turn
    expect(r.heading).toBeCloseTo(R.TURN_STEP_DEG * DEG, 6);
  });

  // [review-added 2026-10-02: Codex]
  it('a new beat starts its turn from where the last one got to, even when updates skipped', () => {
    const { r, step } = flight();
    step(1010, -FAR, 0);
    step(1505, -FAR, 0); // a turn from 0° toward the hero behind him: to 100°
    step(2005, -FAR, 0); // the next beat; the updates between were skipped
    expect(r.turn.from).toBeCloseTo(R.TURN_STEP_DEG * DEG, 6);
    step(2205, -FAR, 0);
    expect(r.heading).toBeCloseTo(Math.PI, 6);
  });

  it('catches up a beat the game skipped, once', () => {
    const { r, step } = flight();
    step(1010);
    step(3020); // four beats on in one jump
    expect(r.boostAt).toBeCloseTo(6.04, 6);
    step(3100);
    expect(r.boostAt).toBeCloseTo(6.04, 6);
  });

  it('cries once within CRY_DIST_PX, and his speed is CHARGE_BOOST higher after it', () => {
    const { r, audio, step } = flight();
    step(1010, R.CRY_DIST_PX + 10, 0);
    expect(audio.speak).not.toHaveBeenCalled();
    step(1020, R.CRY_DIST_PX - 10, 0);
    expect(audio.speak).toHaveBeenCalledTimes(1);
    expect(r.speedNow).toBeCloseTo(R.CRUISE_PX_S * R.CHARGE_BOOST, 6);
    step(1505, R.CRY_DIST_PX - 20, 0);
    expect(r.speedNow).toBeCloseTo(R.BOOST_PX_S * R.CHARGE_BOOST, 6);
    expect(audio.speak).toHaveBeenCalledTimes(1);
  });

  it('plays rusherCharge on the first new beat after his cry, also when a shot lit him first', () => {
    const { r, audio, step } = flight();
    const charges = () =>
      audio.playSound.mock.calls.filter(([n]) => n === 'rusherCharge').length;
    step(1010, 100, 0); // the cry, between beats
    r.takeDamage(1, null, 'hit'); // lit before the next beat
    step(1300, 100, 0);
    expect(charges()).toBe(0);
    step(1505, 100, 0);
    expect(charges()).toBe(1);
    step(2005, 100, 0);
    expect(charges()).toBe(1);
  });

  // [review-added 2026-10-02] pins both "was ahead" and "close by"
  it('notes shooting past when the hero goes from ahead of him to behind him, close by', () => {
    const { r, step } = flight();
    step(1010, 120, 70); // ahead, within PASS_DIST_PX
    step(1020, -300, 70); // behind him, but too far off to be shooting past
    expect(r.whoaAt).toBeNull();
    step(1030, -60, 70); // still behind, now close: he didn't just pass
    expect(r.whoaAt).toBeNull();
    step(1040, 120, 70); // ahead again
    step(1050, -60, 70); // and behind him, close by: shooting past
    expect(r.whoaAt).toBeCloseTo(2.1, 6);
  });

  it('lights within LIGHT_DIST_PX of the hero, unshot', () => {
    const { r, step } = flight();
    step(1010, R.LIGHT_DIST_PX + 5, 0);
    expect(r.lit).toBeNull();
    step(1020, R.LIGHT_DIST_PX - 5, 0);
    expect(r.lit.by).toBe('hero');
  });

  it('stays inside the world', () => {
    const { r, at } = flight();
    at(1010);
    r.x = CONFIG.GAME_SETTINGS.WORLD_WIDTH; // far past the right edge
    r.y = -CONFIG.GAME_SETTINGS.WORLD_HEIGHT;
    r.update(FAR, 0, 16);
    expect(r.x).toBeLessThanOrEqual(
      CONFIG.GAME_SETTINGS.WORLD_WIDTH / 2 - r.size / 2
    );
    expect(r.y).toBeGreaterThanOrEqual(
      -CONFIG.GAME_SETTINGS.WORLD_HEIGHT / 2 + r.size / 2
    );
  });

  it('with no beat clock he never boosts', () => {
    const context = { get: () => null, set() {} };
    const r = new Rusher(0, 0, 'rusher', { context }, createMockP5(), null);
    r.isSpawning = false;
    for (let i = 0; i < 120; i++) r.updateSpecificBehavior(FAR, 0, 16);
    expect(r.boostAt).toBeNull();
    expect(r.speedNow).toBe(R.CRUISE_PX_S);
  });
});

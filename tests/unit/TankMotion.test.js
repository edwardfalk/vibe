import { describe, it, expect, afterEach, vi } from 'vitest';
import { CONFIG } from '../../js/config.js';
import { tankMuzzle } from '../../js/entities/TankRenderer.js';
import { tankWorld } from './helpers/tankWorld.js';

const DEFAULTS = { ...CONFIG.TANK };
const SPEECH = { ...CONFIG.SPEECH_SETTINGS.TANK };
afterEach(() => {
  Object.assign(CONFIG.TANK, DEFAULTS);
  Object.assign(CONFIG.SPEECH_SETTINGS.TANK, SPEECH);
  vi.restoreAllMocks();
});
// Pin him in place, so the angle to the hero stays put while he turns
const pinned = () =>
  Object.assign(CONFIG.TANK, { DRIFT_PX_S: 0, LURCH_PX_S: 0 });
const STEP = Math.PI / 3;
const facingRight = (t) => {
  t.facing = 0;
  t.turn = { from: 0, to: 0, at: null };
};
// A tank that has already acted in bar 1, facing +x, the hero below him
const activeBelow = () => {
  pinned();
  const w = tankWorld({ hero: { x: 0, y: 300 } });
  const t = w.tank();
  facingRight(t);
  t.lastActedBar = 1;
  return { w, t };
};

describe('the tank turns on the kick', () => {
  it('turns toward the hero only on beat 1, by at most a step, and holds between kicks', () => {
    const { w, t } = activeBelow();
    w.frame(t, 2600); // bar 1, already acted: no turn
    expect(t.facing).toBe(0);
    for (let ms = 4000; ms < 6000; ms += 16) w.frame(t, ms); // bar 2
    expect(t.facing).toBeCloseTo(STEP, 5); // the step, then held
    for (let ms = 6000; ms < 8000; ms += 16) w.frame(t, ms); // bar 3
    expect(t.facing).toBeCloseTo(Math.PI / 2, 5); // the rest of the way
  });

  it('still acts on a beat 1 a hitstop swallowed, timed from when he acts, and only once', () => {
    const { w, t } = activeBelow();
    w.frame(t, 4230); // 230 ms into beat 1: a long hitstop ate the window
    expect(t.turn.to).toBeCloseTo(STEP, 5);
    expect(t.turn.at).toBeCloseTo(8.46, 6); // stamped with poseBeats
    w.frame(t, 4400);
    w.frame(t, 4480);
    expect(t.turn.to).toBeCloseTo(STEP, 5); // no second turn in that bar
  });

  it('stalled past beat 1, acts late in the bar, once', () => {
    const { w, t } = activeBelow();
    w.frame(t, 3900); // bar 1
    w.frame(t, 4600); // a 700 ms stall: beat 2 of bar 2
    expect(t.turn.to).toBeCloseTo(STEP, 5);
    w.frame(t, 5900);
    expect(t.turn.to).toBeCloseTo(STEP, 5);
  });

  it('jumping several bars, turns once', () => {
    const { w, t } = activeBelow();
    w.frame(t, 3900);
    w.frame(t, 12100); // bars 2, 3, 4 and 5 sat out
    expect(t.turn.to).toBeCloseTo(STEP, 5); // one step, not four
  });

  it('first seen past beat 1 (a spawn finishing mid-bar), waits for the next bar', () => {
    pinned();
    const w = tankWorld({ hero: { x: 0, y: 300 } });
    const t = w.tank(); // lastActedBar null
    facingRight(t);
    w.frame(t, 4600);
    w.frame(t, 5900);
    expect(t.turn.to).toBe(0);
    expect(t.lurchNow).toBe(0);
    w.frame(t, 6010);
    expect(t.turn.to).toBeCloseTo(STEP, 5);
  });

  it('starts a new turn from where the last one ended, with no frames between kicks', () => {
    const { w, t } = activeBelow();
    w.frame(t, 4000); // the turn to a step begins
    w.frame(t, 6000); // the next kick: no update in between
    expect(t.turn.from).toBeCloseTo(STEP, 5);
    expect(t.turn.to).toBeCloseTo(Math.PI / 2, 5);
  });
});

describe('the tank spawns', () => {
  it('facing the hero', () => {
    const w = tankWorld({ hero: { x: 0, y: 300 } });
    expect(w.tank().facing).toBeCloseTo(Math.PI / 2);
  });
});

describe("the tank's gun", () => {
  it('stays in its arc, at the nearer edge for a hero behind him, and his shot leaves the muzzle along it', () => {
    pinned();
    const w = tankWorld({ hero: { x: -300, y: -10 } }); // behind, a little to his left
    const t = w.tank();
    facingRight(t);
    for (let ms = 2100; ms < 3900; ms += 16) w.frame(t, ms); // first seen mid-bar: no turn
    const arc = (CONFIG.TANK.AIM_ARC_DEG * Math.PI) / 180;
    expect(t.gunRel).toBeCloseTo(-arc, 2);
    expect(t.aimAngle).toBeCloseTo(t.facing + t.gunRel, 9);
    t.chargingShot = true; // charged long ago: it fires on the next beat 1
    t.chargeStartBeat = 0;
    const shot = w.frame(t, 4000);
    const s = t.size * CONFIG.TANK_LOOK.ART_SCALE;
    const m = tankMuzzle(t.x, t.y, s, t.facing, t.gunRel);
    expect(shot.x).toBeCloseTo(m.x, 6);
    expect(shot.y).toBeCloseTo(m.y, 6);
    expect(shot.angle).toBeCloseTo(t.facing + t.gunRel, 9);
  });
});

describe("the tank's shot", () => {
  it('hits a hero pressed against his chest: its first sweep starts in his fists', () => {
    pinned();
    const w = tankWorld({ hero: { x: 30, y: 0 } });
    const t = w.tank();
    facingRight(t);
    t.lastActedBar = 1;
    t.chargingShot = true; // charged long ago: it fires on this beat 1
    t.chargeStartBeat = 0;
    const shot = w.frame(t, 4000);
    expect(shot.checkCollision({ x: 30, y: 0, size: 32 })).toBe(true);
  });
});

describe('the tank moves', () => {
  it('lurches along his facing on beat 1, drifts toward his target, and close to it holds his ground', () => {
    CONFIG.TANK.TURN_STEP_DEG = 0; // keep him facing +x
    const w = tankWorld({ hero: { x: 1000, y: 400 } }); // off his axis
    const t = w.tank();
    facingRight(t);
    t.lastActedBar = 1;
    w.frame(t, 4000);
    const toHero = Math.atan2(400 - t.y, 1000 - t.x);
    const drift = CONFIG.TANK.DRIFT_PX_S / 60;
    expect(t.velocity.y).toBeCloseTo(Math.sin(toHero) * drift, 3); // the lurch adds nothing sideways
    expect(t.velocity.x).toBeCloseTo(
      Math.cos(toHero) * drift + CONFIG.TANK.LURCH_PX_S / 60,
      3
    );
    w.player.x = t.x + 100; // within LURCH_MIN_DIST_PX
    w.player.y = t.y;
    w.frame(t, 6000);
    expect(t.velocity.x).toBe(0);
    expect(t.velocity.y).toBe(0);
  });
});

describe('the lurch', () => {
  it('dies away within the beat', () => {
    Object.assign(CONFIG.TANK, { DRIFT_PX_S: 0, TURN_STEP_DEG: 0 });
    const w = tankWorld({ hero: { x: 1000, y: 0 } });
    const t = w.tank();
    t.lastActedBar = 1;
    w.frame(t, 4000);
    const kick = t.velocity.x;
    expect(kick).toBeGreaterThan(0);
    w.frame(t, 4500);
    expect(t.velocity.x).toBeLessThan(kick * 0.2);
  });
});

describe("the tank's charge", () => {
  it('starts on a beat 1 with the hero in range and fires two bars later, however late in that bar', () => {
    CONFIG.SPEECH_SETTINGS.TANK.CALLOUT_CHANCE = 1;
    const w = tankWorld({ hero: { x: 300, y: 0 } });
    const t = w.tank();
    t.lastActedBar = 1;
    expect(w.frame(t, 4000)).toBeNull(); // bar 2: CHARGING!
    expect(t.chargingShot).toBe(true);
    for (const ms of [5000, 6000, 7000, 7900])
      expect(w.frame(t, ms)).toBeNull();
    const shot = w.frame(t, 8600); // bar 4, after a 700 ms stall
    expect(shot?.owner).toBe('enemy-tank');
    expect(t.chargingShot).toBe(false);
    const lines = w.audio.speak.mock.calls.map(([, line]) => line);
    expect(lines).toEqual(['CHARGING!', 'FIRE!']);
  });

  it('calls out CHARGING! and FIRE! on CALLOUT_CHANCE of his charges; the rest are tones alone', () => {
    CONFIG.SPEECH_SETTINGS.TANK.CALLOUT_CHANCE = 0;
    const w = tankWorld({ hero: { x: 300, y: 0 } });
    const t = w.tank();
    t.lastActedBar = 1;
    for (const ms of [4000, 5000, 6000, 7000, 8000]) w.frame(t, ms);
    expect(t.chargingShot).toBe(false); // he fired
    expect(w.audio.speak).not.toHaveBeenCalled();
    const sounds = w.audio.playSound.mock.calls.map(([name]) => name);
    expect(sounds).toContain('tankCharging');
    expect(sounds).toContain('tankPowerUp');
  });

  it('rolls his callout once per charge: FIRE! follows a called-out CHARGING!, and the next charge rolls again', () => {
    CONFIG.SPEECH_SETTINGS.TANK.CALLOUT_CHANCE = 1;
    const w = tankWorld({ hero: { x: 300, y: 0 } });
    const t = w.tank();
    t.lastActedBar = 1;
    w.frame(t, 4000); // CHARGING!
    CONFIG.SPEECH_SETTINGS.TANK.CALLOUT_CHANCE = 0;
    for (let ms = 5000; ms <= 16000; ms += 1000) w.frame(t, ms);
    const charges = w.audio.playSound.mock.calls.filter(
      ([name]) => name === 'tankCharging'
    );
    expect(charges).toHaveLength(2); // the second charge, silent
    const lines = w.audio.speak.mock.calls.map(([, line]) => line);
    expect(lines).toEqual(['CHARGING!', 'FIRE!']);
  });

  it('holds his charge through bars the game sat out (a hidden tab), then fires on a beat 1', () => {
    const w = tankWorld({ hero: { x: 300, y: 0 } });
    const t = w.tank();
    t.lastActedBar = 1;
    w.frame(t, 4000); // bar 2: CHARGING!
    w.frame(t, 5000);
    // Bars 3, 4 and 5 go by without a frame; back in bar 6, beat 2. One
    // bar of the charge has run, so it fires on the next beat 1
    expect(w.frame(t, 12600)).toBeNull();
    expect(t.chargingShot).toBe(true);
    expect(w.frame(t, 14000)?.owner).toBe('enemy-tank'); // bar 7
  });

  it('holds his charge when the game sits out its second bar, too', () => {
    const w = tankWorld({ hero: { x: 300, y: 0 } });
    const t = w.tank();
    t.lastActedBar = 1;
    w.frame(t, 4000); // bar 2: CHARGING!
    w.frame(t, 5000);
    w.frame(t, 6000); // bar 3, the charge's second
    w.frame(t, 6016);
    // Hidden from just after bar 3's beat 1 to bar 7, beat 2: the charge
    // still has bar 3 to run, so it fires on bar 8's beat 1
    expect(w.frame(t, 14600)).toBeNull();
    expect(w.frame(t, 16000)?.owner).toBe('enemy-tank');
  });

  it('waits RECHARGE_BEATS after a shot before charging again', () => {
    const w = tankWorld({ hero: { x: 300, y: 0 } });
    const t = w.tank();
    t.lastActedBar = 1;
    // A frame a beat: frames a bar or more apart are a stall, which holds
    // his charge
    const shots = [];
    for (let ms = 4000; ms <= 8000; ms += 500) shots.push(w.frame(t, ms));
    expect(shots.at(-1)?.owner).toBe('enemy-tank'); // bar 4: the shot
    for (let ms = 8500; ms <= 10000; ms += 500) w.frame(t, ms);
    expect(t.chargingShot).toBe(false); // bar 5: four beats on
    for (let ms = 10500; ms <= 12000; ms += 500) w.frame(t, ms);
    expect(t.chargingShot).toBe(true); // bar 6: eight beats on
  });
});

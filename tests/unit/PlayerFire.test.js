import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Player } from '../../js/entities/player.js';
import { BeatClock } from '../../js/audio/BeatClock.js';
import { CONFIG } from '../../js/config.js';

const p = {
  color: () => ({}),
  keyIsDown: () => false,
  constrain: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
  cos: Math.cos,
  sin: Math.sin,
  mouseX: 0,
  mouseY: 0,
};

describe('Player held fire', () => {
  beforeEach(() => {
    globalThis.window = { playerIsShooting: true };
  });

  it('fires once when the eighth-note window opens before a queued shot is due', () => {
    let onEighth = false;
    const playerBullets = [];
    const beatClock = {
      isOnHeroEighth: () => onEighth,
      getTimeToNextHeroEighth: () => 30,
    };
    const player = new Player(p, 100, 100, null, { playerBullets, beatClock });
    let fired = 0;
    const fire = player.fireBullet.bind(player);
    player.fireBullet = () => (fired++, fire());

    player.shoot(); // first shot: immediate
    player.update(250); // cooldown over
    player.shoot(); // off the grid: queues a shot 30 ms ahead
    expect(fired).toBe(1);

    onEighth = true; // 16 ms later, inside the window before the note
    player.update(16);
    player.shoot(); // on-grid shot fires now
    player.update(16); // the queued shot comes due on this frame
    expect(fired).toBe(2);
  });

  // Its sound reads the mark: a first shot never waits long for the grid
  it('marks the first shot of a press as not held, and the rest as held (Audio.heroShotTiming)', () => {
    let onEighth = false;
    const beatClock = {
      isOnHeroEighth: () => onEighth,
      getTimeToNextHeroEighth: () => 30,
    };
    const player = new Player(p, 100, 100, null, {
      playerBullets: [],
      beatClock,
    });
    player.shoot(); // first shot: immediate
    expect(player.shotHeld).toBe(false);
    player.update(250);
    onEighth = true;
    player.shoot(); // held fire, on the grid
    expect(player.shotHeld).toBe(true);
    window.playerIsShooting = false;
    player.update(16); // released
    window.playerIsShooting = true;
    player.update(250);
    onEighth = false;
    player.shoot(); // a new press: its first shot again
    expect(player.shotHeld).toBe(false);
    player.update(250);
    player.shoot(); // off the grid: queued
    player.update(40); // the queued shot fires
    expect(player.shotHeld).toBe(true);
  });

  it("a new burst does not also fire the last burst's queued shot", () => {
    const beatClock = {
      isOnHeroEighth: () => false,
      getTimeToNextHeroEighth: () => 30,
    };
    const player = new Player(p, 100, 100, null, {
      playerBullets: [],
      beatClock,
    });
    let fired = 0;
    const fire = player.fireBullet.bind(player);
    player.fireBullet = () => (fired++, fire());

    player.shoot();
    player.update(250);
    player.shoot(); // queues a shot 30 ms ahead
    window.playerIsShooting = false;
    player.update(16); // released: the burst ends
    window.playerIsShooting = true;
    player.shoot(); // pressed again: the new burst's first shot is immediate
    player.update(16); // the old queued shot comes due on this frame
    expect(fired).toBe(2);
  });
});

// While a bassist is about the hero's held fire swings: his "and" moves to
// CONFIG.SWING.AND_AT, and a held shot's cooldown is short enough to make
// the beat after it (the bassist spec, Timing)
describe('held fire on the hero grid', () => {
  const andAt = CONFIG.SWING.AND_AT;
  afterEach(() => {
    CONFIG.SWING.AND_AT = andAt;
  });

  // Holds fire from beat 2.9 to 8 at 60 fps; the beat positions he fired at
  function holdThroughABar({ swing, at = andAt }) {
    globalThis.window = { playerIsShooting: true };
    CONFIG.SWING.AND_AT = at;
    const ahead = CONFIG.BEAT_CLOCK.AHEAD_MS / 1000;
    const ctx = { currentTime: 2.9 * 0.5 - ahead };
    const clock = new BeatClock(120, ctx);
    clock.startTime = 0;
    clock.wantSwing(swing);
    const player = new Player(p, 100, 100, null, {
      playerBullets: [],
      beatClock: clock,
    });
    const shots = [];
    const fire = player.fireBullet.bind(player);
    player.fireBullet = (held) => {
      shots.push(clock.getBeatPosition());
      return fire(held);
    };
    const frameMs = 1000 / 60;
    for (let i = 0; i < 500 && clock.getBeatPosition() < 8; i++) {
      player.shoot();
      ctx.currentTime += frameMs / 1000;
      player.update(frameMs);
    }
    return shots.filter((b) => b >= 4 - 0.04 && b < 8 - 0.04);
  }

  // Each shot within the 20 ms window (0.04 beat) of 0 or `and` in its beat
  const onGrid = (shots, and) =>
    shots.every((b) => {
      const f = b - Math.round(b);
      const g = b - Math.floor(b) - and;
      return Math.abs(f) <= 0.04 || Math.abs(g) <= 0.04;
    });

  it.each([2 / 3, 0.75])(
    'swung at %s: 8 shots a bar, on 0 and the let',
    (at) => {
      const shots = holdThroughABar({ swing: true, at });
      expect(shots).toHaveLength(8);
      expect(onGrid(shots, at)).toBe(true);
    }
  );

  it('straight: 8 shots a bar, on 0 and 0.5, as today', () => {
    const shots = holdThroughABar({ swing: false });
    expect(shots).toHaveLength(8);
    expect(onGrid(shots, 0.5)).toBe(true);
  });
});

// Held fire's cooldown is the grid's: today's 200 ms on the straight grid,
// so a game with no bassist plays as before, and short enough on the swung
// one to make the beat after the let
describe("held fire's cooldown", () => {
  const cooldown = (swing, at = 2 / 3) => {
    CONFIG.SWING.AND_AT = at;
    const ctx = { currentTime: 0 };
    const clock = new BeatClock(120, ctx);
    clock.startTime = 0;
    clock.wantSwing(swing);
    ctx.currentTime = 2.1; // a new bar takes it
    clock.update(true);
    const player = new Player(p, 100, 100, null, {
      playerBullets: [],
      beatClock: clock,
    });
    return player.heldCooldownMs();
  };
  afterEach(() => {
    CONFIG.SWING.AND_AT = 2 / 3;
  });

  it('is 200 ms on the straight grid, as before', () => {
    expect(cooldown(false)).toBe(200);
  });

  it('is under the swung let-to-beat gap, and over the eighth window either side', () => {
    for (const at of [2 / 3, 0.75]) {
      const ms = cooldown(true, at);
      expect(ms).toBeLessThan((1 - at) * 500);
      expect(ms).toBeGreaterThan(2 * 20);
    }
  });
});

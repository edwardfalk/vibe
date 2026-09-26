import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.stubGlobal('localStorage', {
  _store: {},
  getItem(key) {
    return this._store[key] ?? null;
  },
  setItem(key, value) {
    this._store[key] = String(value);
  },
});
vi.spyOn(console, 'log').mockImplementation(() => {});

const { Player } = await import('../../js/entities/player.js');
const { GameState } = await import('../../js/core/GameState.js');
const { CONFIG } = await import('../../js/config.js');
const { BeatClock } = await import('../../js/audio/BeatClock.js');

const p = {
  color: () => ({}),
  keyIsDown: () => false,
  constrain: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
  cos: Math.cos,
  sin: Math.sin,
  mouseX: 0,
  mouseY: 0,
  width: 800,
  height: 600,
};

function makePlayer(beatClock) {
  const audio = {
    playSound: vi.fn(),
    speakPlayerLine: vi.fn(),
  };
  const gameState = { gameState: 'playing', resetKillStreak: vi.fn() };
  const context = { playerBullets: [], audio, gameState, beatClock };
  const player = new Player(p, 100, 100, null, context);
  return { player, audio, gameState };
}

describe('Player shield', () => {
  beforeEach(() => {
    globalThis.window = { playerIsShooting: false };
  });

  it('hurt ends the run only on a fatal hit', () => {
    const { player, gameState } = makePlayer();
    gameState.setGameState = vi.fn();
    expect(player.hurt(10, 'test')).toBe(false); // the shield takes it
    expect(player.hurt(10, 'test')).toBe(false);
    expect(gameState.setGameState).not.toHaveBeenCalled();
    expect(player.hurt(500, 'test')).toBe(true);
    expect(gameState.setGameState).toHaveBeenCalledWith('gameOver');
  });

  it('absorbs the first hit: no health, no wound sound, streak kept', () => {
    const { player, audio, gameState } = makePlayer();
    expect(player.takeDamage(99, 'rusher-explosion')).toBe(false);
    expect(player.health).toBe(100);
    expect(player.shieldUp).toBe(false);
    expect(audio.playSound).toHaveBeenCalledWith('shieldBreak', 100, 100);
    expect(audio.playSound).not.toHaveBeenCalledWith('playerHit');
    expect(gameState.resetKillStreak).not.toHaveBeenCalled();
  });

  it('the next hit lands, with the wound sound and a streak reset', () => {
    const { player, audio, gameState } = makePlayer();
    player.takeDamage(10, 'test');
    player.takeDamage(10, 'test');
    expect(player.health).toBe(90);
    expect(
      audio.playSound.mock.calls.filter(([name]) => name === 'playerHit')
    ).toHaveLength(1);
    expect(gameState.resetKillStreak).toHaveBeenCalledTimes(1);
  });

  it('contact ticks bypass the shield and leave it up', () => {
    const { player } = makePlayer();
    player.takeDamage(1, 'grunt-contact');
    expect(player.health).toBe(99);
    expect(player.shieldUp).toBe(true);
  });

  it('comes back after SHIELD_RECHARGE_MS (no beat clock: at once), not before', () => {
    const { player, audio } = makePlayer();
    player.takeDamage(10, 'test');
    player.update(CONFIG.PLAYER.SHIELD_RECHARGE_MS - 20);
    expect(player.shieldUp).toBe(false);
    player.update(40);
    expect(player.shieldUp).toBe(true);
    expect(audio.playSound).toHaveBeenCalledWith(
      'shieldUp',
      player.x,
      player.y
    );
  });

  it('with a beat clock, waits for the beat', () => {
    let onBeat = false;
    const { player } = makePlayer({ isOnBeat: () => onBeat });
    player.takeDamage(10, 'test');
    player.update(CONFIG.PLAYER.SHIELD_RECHARGE_MS + 100);
    expect(player.shieldUp).toBe(false);
    onBeat = true;
    player.update(16);
    expect(player.shieldUp).toBe(true);
  });

  it('returns on the beat, never ahead of it (real BeatClock)', () => {
    const ctx = { currentTime: 0 };
    const clock = new BeatClock(120, ctx);
    const { player } = makePlayer(clock);
    for (const breakAt of [130, 377, 3210, 4999]) {
      let ms = breakAt;
      ctx.currentTime = ms / 1000;
      clock.update(true);
      player.shieldUp = true;
      player.takeDamage(10, 'test');
      while (!player.shieldUp) {
        ms += 16;
        ctx.currentTime = ms / 1000;
        clock.update(true);
        player.update(16);
      }
      const sinceBeat = (ms - clock.startTime) % clock.beatInterval;
      expect(sinceBeat, `broke at ${breakAt}`).toBeLessThanOrEqual(
        clock.tolerance
      );
    }
  });

  it('restart brings the shield back and zeroes the timers', () => {
    const { player } = makePlayer();
    globalThis.window.player = player;
    player.takeDamage(10, 'test');
    player.update(500);
    new GameState().restart();
    expect(player.shieldUp).toBe(true);
    expect(player.shieldDownMs).toBe(0);
    expect(player.msSinceHit).toBe(0);
  });
});

describe('Player healing', () => {
  let player;
  beforeEach(() => {
    globalThis.window = { playerIsShooting: false };
    ({ player } = makePlayer());
    player.shieldUp = false; // let hits land
    player.shieldDownMs = -1e9; // and keep it down for these tests
  });

  it('starts REGEN_DELAY_MS after the last hit, at REGEN_PER_SEC', () => {
    player.update(CONFIG.PLAYER.REGEN_DELAY_MS * 2); // time passes before the hit
    player.takeDamage(50, 'test');
    player.update(CONFIG.PLAYER.REGEN_DELAY_MS - 500);
    expect(player.health).toBe(50);
    player.update(500); // the delay is over
    player.update(1000); // one second of healing
    expect(player.health).toBeCloseTo(50 + CONFIG.PLAYER.REGEN_PER_SEC, 5);
  });

  it('never overheals', () => {
    player.takeDamage(1, 'test');
    player.update(60000);
    expect(player.health).toBe(player.maxHealth);
  });

  it('never revives', () => {
    player.takeDamage(1000, 'test');
    player.update(60000);
    expect(player.health).toBe(0);
  });
});

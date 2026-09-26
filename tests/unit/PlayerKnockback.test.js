import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.spyOn(console, 'log').mockImplementation(() => {});

const { Player } = await import('../../js/entities/player.js');
const { CONFIG } = await import('../../js/config.js');
const { handleRusherExplosionCollision } =
  await import('../../js/systems/combat/PlayerContactHandlers.js');

const FRAME = CONFIG.GAME_SETTINGS.FRAME_TIME_MS;
const p = {
  color: () => ({}),
  keyIsDown: () => false,
  constrain: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
  mouseX: 0,
  mouseY: 0,
};

function makePlayer(x = 0, y = 0) {
  const audio = { playSound: vi.fn(), speakPlayerLine: vi.fn() };
  const gameState = { gameState: 'playing', resetKillStreak: vi.fn() };
  const context = { playerBullets: [], audio, gameState };
  return new Player(p, x, y, null, context);
}

describe('Player knockback', () => {
  beforeEach(() => {
    globalThis.window = { playerIsShooting: false };
  });

  it('a rusher blast pushes him away, and the push decays to nothing', () => {
    const player = makePlayer();
    // The shield takes the hit, so he survives it and is pushed
    handleRusherExplosionCollision({
      explosion: { x: -50, y: 0, radius: 150, damage: 10 },
      player,
    });
    player.update(FRAME);
    const afterOne = player.x;
    expect(afterOne).toBeGreaterThan(0);
    expect(player.y).toBeCloseTo(0);

    for (let i = 0; i < 300; i++) player.update(FRAME);
    const force = CONFIG.PLAYER.KNOCKBACK_RUSHER_BLAST;
    const decay = CONFIG.PLAYER.KNOCKBACK_DECAY;
    expect(player.x).toBeCloseTo(force / (1 - decay), 3); // geometric sum
    expect(Math.hypot(player.knockback.x, player.knockback.y)).toBeLessThan(
      1e-6
    );
  });

  it('a push never carries him out of the world', () => {
    const edge = CONFIG.GAME_SETTINGS.WORLD_WIDTH / 2;
    const player = makePlayer(edge - 40, 0);
    player.knockBack(edge - 100, 0, 1000);
    for (let i = 0; i < 60; i++) player.update(FRAME);
    expect(player.x).toBeLessThan(edge);
  });
});

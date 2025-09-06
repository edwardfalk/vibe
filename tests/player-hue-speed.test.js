import { describe, it, expect } from 'vitest';
import { Player } from '../packages/entities/src/player.js';

const pStub = { color: () => ({}) };

describe('Player hue shift speed', () => {
  it('is faster when dashing', () => {
    const player = new Player(pStub, 0, 0, null);
    const base = player.getHueShiftSpeed();
    player.isDashing = true;
    expect(player.getHueShiftSpeed()).toBeGreaterThan(base);
  });

  it('is faster when health is low', () => {
    const player = new Player(pStub, 0, 0, null);
    const base = player.getHueShiftSpeed();
    player.health = player.maxHealth * 0.2;
    expect(player.getHueShiftSpeed()).toBeGreaterThan(base);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { handleAreaDamageEvents } from '../../js/effects/AreaDamageHandler.js';

function grunt(x) {
  return { type: 'grunt', x, y: 0, size: 20, takeDamage: () => 'died' };
}

describe('area damage after the player died', () => {
  it('scores no kills once the game is over', () => {
    const gameState = {
      gameState: 'playing',
      addKill: vi.fn(),
      addScore: vi.fn(),
    };
    // The first cloud kills the player; the second, elsewhere, kills a grunt
    const player = {
      x: 0,
      y: 0,
      hurt: vi.fn(() => {
        gameState.gameState = 'gameOver';
        return true;
      }),
    };
    handleAreaDamageEvents(
      [
        { x: 0, y: 0, radius: 10, damage: 99 },
        { x: 500, y: 0, radius: 10, damage: 99 },
      ],
      { player, enemies: [grunt(500)], gameState }
    );
    expect(player.hurt).toHaveBeenCalled();
    expect(gameState.addScore).not.toHaveBeenCalled();
    expect(gameState.addKill).not.toHaveBeenCalled();
  });

  it('still scores while playing', () => {
    const gameState = {
      gameState: 'playing',
      addKill: vi.fn(),
      addScore: vi.fn(),
    };
    handleAreaDamageEvents([{ x: 500, y: 0, radius: 10, damage: 99 }], {
      player: null,
      enemies: [grunt(500)],
      gameState,
    });
    expect(gameState.addScore).toHaveBeenCalled();
  });
});

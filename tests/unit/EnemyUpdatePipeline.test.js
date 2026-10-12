import { describe, it, expect } from 'vitest';
import { updateEnemiesAndResolveResults } from '../../js/systems/gameplay/EnemyUpdatePipeline.js';

describe('the enemy loop', () => {
  it('an update finds each live enemy in the array once, after a removed one too', () => {
    // A stabber's stab that kills asks the dead one's neighbours to answer
    // from inside his update: a neighbour listed twice answers twice
    let seen = null;
    const enemies = [
      { id: 'gone', markedForRemoval: true, update: () => null },
      { id: 'a', update: () => null },
      {
        id: 'b',
        update: () => {
          seen = enemies.filter((e) => !e.markedForRemoval).map((e) => e.id);
          return null;
        },
      },
    ];
    updateEnemiesAndResolveResults({
      enemies,
      enemyBullets: [],
      player: null,
      deltaTimeMs: 16,
    });
    expect(seen).toEqual(['a', 'b']);
    expect(enemies.map((e) => e.id)).toEqual(['a', 'b']);
  });
});

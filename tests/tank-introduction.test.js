import { EnemyFactory } from '../packages/entities/src/EnemyFactory.js';

test('tanks unlock at level 4', () => {
  const factory = new EnemyFactory();
  expect(factory.getAvailableTypesForLevel(3)).not.toContain('tank');
  expect(factory.getAvailableTypesForLevel(4)).toContain('tank');
});

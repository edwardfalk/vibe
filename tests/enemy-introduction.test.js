import { test, expect } from '@playwright/test';
import { EnemyFactory } from '@vibe/entities/EnemyFactory.js';

test('tanks unlocked at intended level', () => {
  const factory = new EnemyFactory();
  expect(factory.getAvailableTypesForLevel(4)).not.toContain('tank');
  expect(factory.getAvailableTypesForLevel(5)).toContain('tank');
});

test('rushers unlocked at intended level', () => {
  const factory = new EnemyFactory();
  expect(factory.isTypeAvailableAtLevel('rusher', 2)).toBe(false);
  expect(factory.isTypeAvailableAtLevel('rusher', 3)).toBe(true);
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockP5, createMockAudio } from './helpers/enemyMocks.js';
import { Grunt } from '../../js/entities/Grunt.js';
import { CONFIG } from '../../js/config.js';
import { Bullet } from '../../js/entities/bullet.js';
import { DAMAGE_RESULT } from '../../js/shared/DamageResult.js';
import { STABBER_KILL_POINTS } from '../../js/shared/DamageResultHandler.js';

describe('Grunt deferred stabber death', () => {
  let grunt;
  let mockP5;
  let mockAudio;
  let mockCollisionSystem;
  let mockGameState;

  beforeEach(() => {
    mockGameState = { addKill: vi.fn(), addScore: vi.fn() };
    mockP5 = createMockP5();
    mockAudio = createMockAudio();
    mockCollisionSystem = { handleEnemyDeath: vi.fn() };

    const context = {
      get: vi.fn((key) => {
        if (key === 'audio') return mockAudio;
        if (key === 'collisionSystem') return mockCollisionSystem;
        if (key === 'gameState') return mockGameState;
        if (key === 'beatClock') return null;
        if (key === 'enemies') return [];
        return undefined;
      }),
      set: vi.fn(),
    };

    grunt = new Grunt(100, 100, 'grunt', { context }, mockP5, mockAudio);
    // Skip spawn animation so updateSpecificBehavior runs
    grunt.isSpawning = false;
    grunt.spawnTimer = grunt.spawnDuration;
  });

  it('returns DAMAGED (not DIED) when taking fatal stabber_melee damage', () => {
    // Grunt has 2 health. Dealing 2+ damage from stabber_melee should trigger deferred death.
    const result = grunt.takeDamage(5, null, 'stabber_melee');

    // Deferred: DAMAGED, not DIED
    expect(result).toBe(DAMAGE_RESULT.DAMAGED);
    // Should NOT be marked for removal yet
    expect(grunt.markedForRemoval).toBe(false);
    // Should have pending death flag set
    expect(grunt.pendingStabDeath).toBe(true);
  });

  it('rejects further damage while pendingStabDeath is true', () => {
    // First fatal hit from stabber
    const firstResult = grunt.takeDamage(5, null, 'stabber_melee');
    expect(firstResult).toBe(DAMAGE_RESULT.DAMAGED);
    expect(grunt.pendingStabDeath).toBe(true);

    // Second hit while pending death is DAMAGED too
    const secondResult = grunt.takeDamage(5, null, 'stabber_melee');
    expect(secondResult).toBe(DAMAGE_RESULT.DAMAGED);

    // Third hit from a non-stabber source should also be rejected
    const thirdResult = grunt.takeDamage(1, 0, 'player_bullet');
    expect(thirdResult).toBe(DAMAGE_RESULT.DAMAGED);

    // Still not removed yet
    expect(grunt.markedForRemoval).toBe(false);
  });

  it('sets markedForRemoval after deferred timer expires in updateSpecificBehavior', () => {
    // Trigger deferred death
    grunt.takeDamage(5, null, 'stabber_melee');
    expect(grunt.pendingStabDeath).toBe(true);
    expect(grunt.pendingStabDeathTimer).toBe(12);

    // Simulate enough frames to expire the timer (12 frames at 60fps = 12 * 16.6667ms)
    // Each call to updateSpecificBehavior decrements timer by dt = deltaTimeMs / FRAME_TIME_MS
    const frameTimeMs = CONFIG.GAME_SETTINGS.FRAME_TIME_MS;

    // Run 11 frames - timer should still be active
    for (let i = 0; i < 11; i++) {
      grunt.updateSpecificBehavior(200, 200, frameTimeMs);
    }
    expect(grunt.markedForRemoval).toBe(false);
    expect(grunt.pendingStabDeath).toBe(true);

    // Run 1 more frame to expire
    grunt.updateSpecificBehavior(200, 200, frameTimeMs);

    // Now it should be marked for removal
    expect(grunt.markedForRemoval).toBe(true);
    expect(grunt.pendingStabDeath).toBe(false);

    // collisionSystem.handleEnemyDeath should have been called exactly once
    expect(mockCollisionSystem.handleEnemyDeath).toHaveBeenCalledTimes(1);
    expect(mockCollisionSystem.handleEnemyDeath).toHaveBeenCalledWith(
      grunt,
      'grunt',
      grunt.x,
      grunt.y
    );
  });

  it('scores the kill when the delayed death lands, like any stabber kill', () => {
    grunt.takeDamage(5, null, 'stabber_melee');
    for (let i = 0; i < 12; i++) {
      grunt.updateSpecificBehavior(
        200,
        200,
        CONFIG.GAME_SETTINGS.FRAME_TIME_MS
      );
    }
    expect(mockGameState.addKill).toHaveBeenCalledTimes(1);
    expect(mockGameState.addScore).toHaveBeenCalledWith(STABBER_KILL_POINTS);
  });
});

describe('Grunt shot', () => {
  it('leaves from the drawn gun, which sits artOffsetY off the hit axis', () => {
    const context = { get: () => undefined, set() {} };
    const g = new Grunt(100, 100, 'grunt', { context }, createMockP5(), null);
    g.aimAngle = 0; // aiming +x, so the art's local +y is world +y
    const acquire = vi.spyOn(Bullet, 'acquire');
    g.createBullet();
    const [x, y] = acquire.mock.calls[0];
    expect(x).toBeCloseTo(100 + g.size * 0.9, 5);
    expect(y).toBeCloseTo(100 + g.artOffsetY, 5);
    expect(g.artOffsetY).toBeGreaterThan(0);
  });
});

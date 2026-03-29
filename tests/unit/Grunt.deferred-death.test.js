import { describe, it, expect, vi, beforeEach } from 'vitest';

// Suppress console.log noise from entity constructors
vi.spyOn(console, 'log').mockImplementation(() => {});

// Mock the Bullet module (imported by BaseEnemy)
vi.mock('../../js/entities/bullet.js', () => ({
  Bullet: { acquire: vi.fn(() => ({ ownerId: null })) },
}));

// Mock glowUtils (imported by BaseEnemy)
vi.mock('../../js/effects/glowUtils.js', () => ({
  drawGlow: vi.fn(),
}));

// Mock BaseEnemyHelpers (imported by BaseEnemy)
vi.mock('../../js/entities/BaseEnemyHelpers.js', () => ({
  getEnemyColors: () => ({
    skinColor: {},
    helmetColor: {},
    weaponColor: {},
    eyeColor: {},
  }),
  getGlowColorForType: vi.fn(),
  getGlowSizeForType: vi.fn(() => 10),
  drawEnemyHealthBar: vi.fn(),
  drawEnemySpeechBubble: vi.fn(),
}));

import { Grunt } from '../../js/entities/Grunt.js';
import { CONFIG } from '../../js/config.js';

/**
 * Create a minimal mock p5 instance with the methods BaseEnemy/Grunt need.
 */
function createMockP5() {
  const colorObj = { levels: [100, 200, 100, 255] };
  return {
    color: vi.fn(() => colorObj),
    TWO_PI: Math.PI * 2,
    PI: Math.PI,
    frameCount: 1,
    dist: vi.fn(
      (x1, y1, x2, y2) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    ),
    // Drawing stubs (not needed for logic tests but may be called)
    fill: vi.fn(),
    noFill: vi.fn(),
    stroke: vi.fn(),
    noStroke: vi.fn(),
    ellipse: vi.fn(),
    rect: vi.fn(),
    arc: vi.fn(),
    triangle: vi.fn(),
    line: vi.fn(),
    strokeWeight: vi.fn(),
    push: vi.fn(),
    pop: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    beginShape: vi.fn(),
    endShape: vi.fn(),
    vertex: vi.fn(),
    textAlign: vi.fn(),
    textSize: vi.fn(),
    text: vi.fn(),
    red: vi.fn(() => 100),
    green: vi.fn(() => 200),
    blue: vi.fn(() => 100),
    sin: Math.sin,
    cos: Math.cos,
    MITER: 'miter',
    CLOSE: 'close',
    CENTER: 'center',
  };
}

/**
 * Create a minimal mock audio system.
 */
function createMockAudio() {
  return {
    speak: vi.fn(() => true),
    playSound: vi.fn(),
    playAlienShoot: vi.fn(),
  };
}

describe('Grunt deferred stabber death', () => {
  let grunt;
  let mockP5;
  let mockAudio;
  let mockCollisionSystem;

  beforeEach(() => {
    mockP5 = createMockP5();
    mockAudio = createMockAudio();
    mockCollisionSystem = { handleEnemyDeath: vi.fn() };

    const context = {
      get: vi.fn((key) => {
        if (key === 'audio') return mockAudio;
        if (key === 'collisionSystem') return mockCollisionSystem;
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

  it('returns false (DAMAGED, not DIED) when taking fatal stabber_melee damage', () => {
    // Grunt has 2 health. Dealing 2+ damage from stabber_melee should trigger deferred death.
    const result = grunt.takeDamage(5, null, 'stabber_melee');

    // Should return false (deferred), NOT true (died immediately)
    expect(result).toBe(false);
    // Should NOT be marked for removal yet
    expect(grunt.markedForRemoval).toBe(false);
    // Should have pending death flag set
    expect(grunt.pendingStabDeath).toBe(true);
  });

  it('rejects further damage while pendingStabDeath is true', () => {
    // First fatal hit from stabber
    const firstResult = grunt.takeDamage(5, null, 'stabber_melee');
    expect(firstResult).toBe(false);
    expect(grunt.pendingStabDeath).toBe(true);

    // Second hit while pending death should also return false
    const secondResult = grunt.takeDamage(5, null, 'stabber_melee');
    expect(secondResult).toBe(false);

    // Third hit from a non-stabber source should also be rejected
    const thirdResult = grunt.takeDamage(1, 0, 'player_bullet');
    expect(thirdResult).toBe(false);

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
});

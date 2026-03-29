import { describe, it, expect, vi, beforeEach } from 'vitest';

// Suppress console.log noise from entity constructors and game logic
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

import { Stabber } from '../../js/entities/Stabber.js';

/**
 * Create a minimal mock p5 instance.
 */
function createMockP5() {
  const colorObj = { levels: [255, 215, 0, 255] };
  return {
    color: vi.fn(() => colorObj),
    TWO_PI: Math.PI * 2,
    PI: Math.PI,
    frameCount: 1,
    dist: vi.fn((x1, y1, x2, y2) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)),
    sin: Math.sin,
    cos: Math.cos,
    // Drawing stubs
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
    strokeJoin: vi.fn(),
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

describe('Stabber interrupt preserves stabDirection', () => {
  let stabber;
  let mockP5;
  let mockAudio;

  beforeEach(() => {
    mockP5 = createMockP5();
    mockAudio = createMockAudio();

    const context = {
      get: vi.fn((key) => {
        if (key === 'audio') return mockAudio;
        if (key === 'beatClock') return null;
        if (key === 'rhythmFX') return null;
        if (key === 'visualEffectsManager') return null;
        if (key === 'enemies') return [];
        return undefined;
      }),
      set: vi.fn(),
    };

    stabber = new Stabber(100, 100, 'stabber', { context }, mockP5, mockAudio);
    // Skip spawn animation
    stabber.isSpawning = false;
    stabber.spawnTimer = stabber.spawnDuration;
  });

  it('preserves stabDirection when interrupted during stabPreparing phase', () => {
    // Set up the stabber in a preparing phase with a locked direction
    stabber.stabPreparing = true;
    stabber.stabPreparingTime = 10;
    const originalDirection = Math.PI / 4; // 45 degrees
    stabber.stabDirection = originalDirection;

    // Take damage to trigger interrupt
    stabber.takeDamage(3, Math.PI, 'player_bullet');

    // stabDirection should be preserved (NOT set to null)
    // This is critical for recovery slide - the comment in Stabber.js says:
    // "stabDirection preserved for recovery slide; reset in next handlePreparingPhase"
    expect(stabber.stabDirection).not.toBeNull();
    expect(stabber.stabDirection).toBe(originalDirection);
  });

  it('enters recovery state after interrupt during stabPreparing', () => {
    // Set up the stabber in a preparing phase
    stabber.stabPreparing = true;
    stabber.stabPreparingTime = 10;
    stabber.stabDirection = Math.PI / 3;

    // Take damage to trigger interrupt
    stabber.takeDamage(3, Math.PI, 'player_bullet');

    // Attack phases should be cleared
    expect(stabber.stabPreparing).toBe(false);
    expect(stabber.stabPreparingTime).toBe(0);
    expect(stabber.stabWarning).toBe(false);
    expect(stabber.stabWarningTime).toBe(0);
    expect(stabber.isStabbing).toBe(false);
    expect(stabber.stabAnimationTime).toBe(0);

    // Should be in recovery state
    expect(stabber.stabRecovering).toBe(true);
    expect(stabber.stabRecoveryTime).toBe(0);

    // Should have a cooldown to prevent immediate re-attack
    expect(stabber.stabCooldown).toBe(60);
  });

  it('enters recovery state after interrupt during stabWarning', () => {
    // Set up the stabber in the warning phase
    stabber.stabWarning = true;
    stabber.stabWarningTime = 5;
    stabber.stabDirection = Math.PI / 2;

    // Take damage to trigger interrupt
    stabber.takeDamage(3, 0, 'player_bullet');

    // Should be in recovery state
    expect(stabber.stabRecovering).toBe(true);
    expect(stabber.stabRecoveryTime).toBe(0);

    // stabDirection should be preserved for recovery slide
    expect(stabber.stabDirection).not.toBeNull();
    expect(stabber.stabDirection).toBe(Math.PI / 2);

    // Warning should be cleared
    expect(stabber.stabWarning).toBe(false);
    expect(stabber.stabWarningTime).toBe(0);
  });
});

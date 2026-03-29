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

import { Rusher } from '../../js/entities/Rusher.js';
import { DAMAGE_RESULT } from '../../js/shared/DamageResult.js';

/**
 * Create a minimal mock p5 instance.
 */
function createMockP5() {
  const colorObj = { levels: [255, 20, 147, 255] };
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
    playRusherCharge: vi.fn(),
    playAlienShoot: vi.fn(),
  };
}

describe('Rusher vibrate/explode immunity', () => {
  let rusher;
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

    rusher = new Rusher(100, 100, 'rusher', { context }, mockP5, mockAudio);
    // Skip spawn animation
    rusher.isSpawning = false;
    rusher.spawnTimer = rusher.spawnDuration;
  });

  it('first shot returns EXPLODING and sets vibrating=true', () => {
    expect(rusher.vibrating).toBe(false);
    expect(rusher.exploding).toBe(false);

    const result = rusher.takeDamage(1, 0, 'player_bullet');

    expect(result).toBe(DAMAGE_RESULT.EXPLODING);
    expect(rusher.vibrating).toBe(true);
    expect(rusher.shotTriggered).toBe(true);
  });

  it('second shot during vibrating returns EXPLODING (not DIED)', () => {
    // First shot: enters vibrate state
    const first = rusher.takeDamage(1, 0, 'player_bullet');
    expect(first).toBe(DAMAGE_RESULT.EXPLODING);
    expect(rusher.vibrating).toBe(true);

    // Second shot while vibrating: should be immune, return EXPLODING
    const second = rusher.takeDamage(1, 0, 'player_bullet');
    expect(second).toBe(DAMAGE_RESULT.EXPLODING);

    // Should NOT be marked for removal (committed to exploding)
    expect(rusher.markedForRemoval).toBe(false);
  });

  it('second shot during exploding returns EXPLODING (not DIED)', () => {
    // First shot: enters vibrate state
    rusher.takeDamage(1, 0, 'player_bullet');
    expect(rusher.vibrating).toBe(true);

    // Manually transition to exploding state (simulates beat alignment)
    rusher.vibrating = false;
    rusher.exploding = true;
    rusher.explosionTimer = 0;

    // Shot during exploding: should be immune, return EXPLODING
    const result = rusher.takeDamage(1, 0, 'player_bullet');
    expect(result).toBe(DAMAGE_RESULT.EXPLODING);

    // Should NOT be marked for removal yet
    expect(rusher.markedForRemoval).toBe(false);
  });
});

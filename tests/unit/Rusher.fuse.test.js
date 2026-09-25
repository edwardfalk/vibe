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
import { CONFIG } from '../../js/config.js';

const FRAME_MS = CONFIG.GAME_SETTINGS.FRAME_TIME_MS;

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

describe('Rusher fuse', () => {
  let rusher;
  let mockP5;
  let mockAudio;
  let beatClock;

  /** Run frames with the player far off; returns the first non-null result */
  function runFrames(frames) {
    for (let i = 0; i < frames; i++) {
      const result = rusher.update(1000, 100, FRAME_MS);
      if (result) return { result, frame: i };
    }
    return { result: null, frame: frames };
  }

  beforeEach(() => {
    mockP5 = createMockP5();
    mockAudio = createMockAudio();
    beatClock = null;

    const context = {
      get: vi.fn((key) => {
        if (key === 'audio') return mockAudio;
        if (key === 'beatClock') return beatClock;
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

  it('a shot lights the fuse and returns EXPLODING', () => {
    expect(rusher.vibrating).toBe(false);

    const result = rusher.takeDamage(1, 0, 'player_bullet');

    expect(result).toBe(DAMAGE_RESULT.EXPLODING);
    expect(rusher.vibrating).toBe(true);
  });

  it('a second shot while lit returns EXPLODING (not DIED)', () => {
    rusher.takeDamage(1, 0, 'player_bullet');

    const second = rusher.takeDamage(1, 0, 'player_bullet');
    expect(second).toBe(DAMAGE_RESULT.EXPLODING);

    // Should NOT be marked for removal (committed to exploding)
    expect(rusher.markedForRemoval).toBe(false);
  });

  it('a charging rusher brakes to a stop once shot', () => {
    rusher.velocity = { x: 4.2, y: 0 }; // full charge speed
    rusher.takeDamage(1, 0, 'player_bullet');

    runFrames(30); // half a second

    expect(Math.hypot(rusher.velocity.x, rusher.velocity.y)).toBeLessThan(0.1);
  });

  it('keeps moving toward the player until shot', () => {
    runFrames(10);
    expect(rusher.velocity.x).toBeGreaterThan(0);
  });

  it('never explodes before the minimum fuse, even on beat 1', () => {
    beatClock = { canRusherExplode: () => true };
    rusher.takeDamage(1, 0, 'player_bullet');

    const fuseFrames = CONFIG.RUSHER.FUSE_MIN_MS / FRAME_MS;
    const { result, frame } = runFrames(fuseFrames + 5);

    expect(result?.type).toBe('rusher-explosion');
    expect(frame).toBeGreaterThanOrEqual(Math.floor(fuseFrames) - 1);
    expect(result.radius).toBe(CONFIG.RUSHER.EXPLOSION_RADIUS);
  });

  it('after the fuse, waits for beat 1 or 3', () => {
    let strongBeat = false;
    beatClock = { canRusherExplode: () => strongBeat };
    rusher.takeDamage(1, 0, 'player_bullet');

    const fuseFrames = CONFIG.RUSHER.FUSE_MIN_MS / FRAME_MS;
    expect(runFrames(fuseFrames + 20).result).toBeNull();

    strongBeat = true;
    expect(runFrames(1).result?.type).toBe('rusher-explosion');
  });

  it('a second shot does not restart the fuse', () => {
    rusher.takeDamage(1, 0, 'player_bullet');
    runFrames(30);
    const burnt = rusher.fuseMs;

    rusher.takeDamage(1, 0, 'player_bullet');
    expect(rusher.fuseMs).toBe(burnt);
  });

  it('lights its own fuse at point-blank, unshot', () => {
    rusher.update(rusher.x + 30, rusher.y, FRAME_MS);

    expect(rusher.vibrating).toBe(true);
    expect(mockAudio.playRusherCharge).toHaveBeenCalled();
  });

  it('explodes anyway if no beat 1 or 3 ever comes', () => {
    beatClock = { canRusherExplode: () => false };
    rusher.takeDamage(1, 0, 'player_bullet');

    const limitFrames = (CONFIG.RUSHER.FUSE_MIN_MS + 2000) / FRAME_MS;
    expect(runFrames(limitFrames + 2).result?.type).toBe('rusher-explosion');
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';

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

import { Tank } from '../../js/entities/Tank.js';
import { Stabber } from '../../js/entities/Stabber.js';
import { BeatClock } from '../../js/audio/BeatClock.js';
import { updateStabberBehavior } from '../../js/entities/StabberAttackHandler.js';

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

// A real BeatClock on a fake audio clock, plus a context the entities read
function world() {
  const ctx = { currentTime: 0 };
  const clock = new BeatClock(120, ctx);
  const audio = createMockAudio();
  const context = {
    get: (k) =>
      k === 'audio'
        ? audio
        : k === 'beatClock'
          ? clock
          : k === 'enemies'
            ? []
            : null,
    set() {},
  };
  const at = (ms) => {
    ctx.currentTime = ms / 1000;
    clock.update(true);
  };
  return { clock, audio, context, at };
}

describe('Beat-gated entity behaviour', () => {
  afterEach(() => vi.restoreAllMocks());

  it('tank charge-up sound plays once per beat 1, however many frames the window spans', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // every roll succeeds
    const { audio, context, at } = world();
    const t = new Tank(100, 100, 'tank', { context }, createMockP5(), audio);
    t.isSpawning = false;
    t.spawnTimer = t.spawnDuration;
    t.chargingShot = true;
    t.chargeStartBeat = 0;
    t.chargeDurationBeats = 99;
    for (let ms = 4000; ms < 4120; ms += 10) {
      at(ms); // ~12 frames across beat 1's window
      t.updateSpecificBehavior(700, 100, 10);
    }
    const power = audio.playSound.mock.calls.filter(([n]) => n === 'tankPower');
    expect(power.length).toBe(1);
  });

  it('stabber warns on beat 3 and dashes on the off-beat 3.5', () => {
    const { clock, audio, context, at } = world();
    const s = new Stabber(
      100,
      100,
      'stabber',
      { context },
      createMockP5(),
      audio
    );
    s.isSpawning = false;
    s.spawnTimer = s.spawnDuration;
    s.stabPreparing = true;
    s.stabPreparingTime = 30; // minimum prep already done
    let dashAt = null;
    for (let ms = 2600; ms < 4600 && dashAt === null; ms += 16) {
      at(ms); // from beat 2 of bar 2
      updateStabberBehavior(s, 400, 100, 16);
      if (s.isStabbing) dashAt = ms % 2000;
    }
    expect(dashAt).toBeGreaterThanOrEqual(1250);
    expect(dashAt).toBeLessThanOrEqual(1250 + clock.tolerance + 16);
  });

  it('stabber chatter keeps its old rate: gate open 250 of 2000 ms x 0.2', () => {
    const cfg = Object.create(Stabber.prototype).getAmbientSpeechConfig();
    expect(cfg.chance).toBeCloseTo((250 / 2000) * 0.2, 5);
  });
});

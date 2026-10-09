import { describe, it, expect, vi } from 'vitest';
import { DAMAGE_RESULT } from '../../js/shared/DamageResult.js';
import { handleDamageResult } from '../../js/shared/DamageResultHandler.js';
import { Grunt } from '../../js/entities/Grunt.js';
import { Rusher } from '../../js/entities/Rusher.js';
import { Tank } from '../../js/entities/Tank.js';
import { Stabber } from '../../js/entities/Stabber.js';

// An enemy of this class on a bare context, set up by `before`, hit once:
// the result and every sound it made, in order (a plate's clang as 'clang')
function hit(EnemyClass, type, damageArgs, before = () => {}) {
  const sounds = [];
  const healths = []; // the health each sound was told (its climb)
  const audio = {
    playSound: vi.fn((key, _x, _y, health) => {
      sounds.push(key);
      healths.push(health ?? null);
    }),
    playPlateClang: vi.fn(() => sounds.push('clang')),
    speak: vi.fn(() => true),
  };
  const context = { get: (key) => (key === 'audio' ? audio : undefined) };
  const p = { color: () => ({ levels: [0, 0, 0, 255] }), TWO_PI: Math.PI * 2 };
  const enemy = new EnemyClass(0, 0, type, { context }, p, audio);
  before(enemy);
  const result = enemy.takeDamage(...damageArgs);
  return { result, sounds, healths };
}

// A shot at the nose (aim 0, bullet flying -x) lands on the front plate
const AT_THE_NOSE = Math.PI;

describe('A non-fatal hit plays one sound, the enemy’s own', () => {
  it('grunt', () => {
    const { result, sounds } = hit(Grunt, 'grunt', [1, 0]);
    expect(result).toBe(DAMAGE_RESULT.DAMAGED);
    expect(sounds).toEqual(['gruntHit']);
  });

  it('a grunt already dying of a stab takes bullets silently', () => {
    const { result, sounds } = hit(Grunt, 'grunt', [1, 0], (g) => {
      g.pendingStabDeath = true;
    });
    expect(result).toBe(DAMAGE_RESULT.DAMAGED);
    expect(sounds).toEqual([]);
  });

  it('tank: a blast (no direction) and his bare back play his own hit', () => {
    expect(hit(Tank, 'tank', [1, null]).sounds).toEqual(['tankHit']);
    // From behind: bullet flying +x into a tank facing +x
    expect(hit(Tank, 'tank', [1, 0]).sounds).toEqual(['tankHit']);
  });

  it('tank: a plate that holds plays the plate’s hit', () => {
    const { result, sounds } = hit(Tank, 'tank', [1, AT_THE_NOSE]);
    expect(result).toBe(DAMAGE_RESULT.DAMAGED);
    expect(sounds).toEqual(['tankPlateHit']);
  });

  it('tank: a plate that breaks adds its clang; with damage left over the hit is his', () => {
    const lastPoint = (t) => (t.plates.front.hp = 1);
    expect(hit(Tank, 'tank', [1, AT_THE_NOSE], lastPoint).sounds).toEqual([
      'clang',
      'tankPlateHit',
    ]);
    expect(hit(Tank, 'tank', [3, AT_THE_NOSE], lastPoint).sounds).toEqual([
      'clang',
      'tankHit',
    ]);
  });

  it('stabber', () => {
    const { result, sounds } = hit(Stabber, 'stabber', [3, 0]);
    expect(result).toBe(DAMAGE_RESULT.DAMAGED);
    expect(sounds).toEqual(['stabberHit']);
  });

  it('rusher: any hit lights the fuse (EXPLODING) and sounds, lit or not', () => {
    const unlit = hit(Rusher, 'rusher', [1, 0]);
    expect(unlit.result).toBe(DAMAGE_RESULT.EXPLODING);
    expect(unlit.sounds).toEqual(['rusherHit']);
    const lit = hit(Rusher, 'rusher', [1, 0], (r) => r.light('hit'));
    expect(lit.result).toBe(DAMAGE_RESULT.EXPLODING);
    expect(lit.sounds).toEqual(['rusherHit']);
  });

  it('the damage handler adds the hit’s spark but no sound of its own', () => {
    for (const result of [DAMAGE_RESULT.DAMAGED, DAMAGE_RESULT.EXPLODING]) {
      const audio = { playSound: vi.fn() };
      const explosionManager = { addExplosion: vi.fn() };
      handleDamageResult(
        result,
        { x: 1, y: 2, size: 10 },
        { audio, explosionManager, hitX: 1, hitY: 2 }
      );
      expect(audio.playSound).not.toHaveBeenCalled();
      expect(explosionManager.addExplosion).toHaveBeenCalled();
    }
  });
});

describe('a hit is told the health before it, so it climbs as the enemy weakens', () => {
  it("each enemy's own hit: the grunt's too, though it plays after the damage", () => {
    expect(hit(Grunt, 'grunt', [1, 0]).healths).toEqual([
      { health: 2, maxHealth: 2 },
    ]);
    expect(hit(Stabber, 'stabber', [3, 0]).healths).toEqual([
      { health: 10, maxHealth: 10 },
    ]);
    const hurt = (t) => (t.health = 30);
    expect(hit(Tank, 'tank', [1, 0], hurt).healths).toEqual([
      { health: 30, maxHealth: 60 },
    ]);
  });

  it("the tank's own hit climbs on every branch: a blast, and a plate breaking with damage left over", () => {
    const hurt = (t) => (t.health = 30);
    expect(hit(Tank, 'tank', [1, null], hurt).healths).toEqual([
      { health: 30, maxHealth: 60 },
    ]);
    const lastPoint = (t) => (t.plates.front.hp = 1);
    expect(hit(Tank, 'tank', [3, AT_THE_NOSE], lastPoint).healths).toEqual([
      { health: 60, maxHealth: 60 },
    ]);
  });

  it("a plate breaking with nothing left over plays the plate's hit, which never climbs", () => {
    const lastPoint = (t) => {
      t.plates.front.hp = 1;
      t.health = 5;
    };
    const broken = hit(Tank, 'tank', [1, AT_THE_NOSE], lastPoint);
    expect(broken.sounds).toEqual(['clang', 'tankPlateHit']);
    expect(broken.healths).toEqual([null]);
  });

  it("a plate's hit never climbs, however hurt he is", () => {
    const hurt = (t) => (t.health = 5);
    const plate = hit(Tank, 'tank', [1, AT_THE_NOSE], hurt);
    expect(plate.sounds).toEqual(['tankPlateHit']);
    expect(plate.healths).toEqual([null]);
  });

  it("nor does a rusher's: his health never drops, he blows instead", () => {
    expect(hit(Rusher, 'rusher', [1, 0]).healths).toEqual([null]);
  });
});

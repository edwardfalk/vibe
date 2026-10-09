import { describe, it, expect, vi } from 'vitest';
import { DAMAGE_RESULT } from '../../js/shared/DamageResult.js';
import { Grunt } from '../../js/entities/Grunt.js';
import { Rusher } from '../../js/entities/Rusher.js';
import { Tank } from '../../js/entities/Tank.js';
import { Stabber } from '../../js/entities/Stabber.js';

// An enemy of this class on a bare context, and the sound keys it played
function hit(EnemyClass, type, ...damageArgs) {
  const audio = { playSound: vi.fn(), speak: vi.fn(() => true) };
  const context = { get: (key) => (key === 'audio' ? audio : undefined) };
  const p = { color: () => ({ levels: [0, 0, 0, 255] }), TWO_PI: Math.PI * 2 };
  const enemy = new EnemyClass(0, 0, type, { context }, p, audio);
  const result = enemy.takeDamage(...damageArgs);
  return { result, sounds: audio.playSound.mock.calls.map(([key]) => key) };
}

describe('A non-fatal hit returns DAMAGED and plays the hit sound', () => {
  it('grunt', () => {
    const { result, sounds } = hit(Grunt, 'grunt', 1, 0);
    expect(result).toBe(DAMAGE_RESULT.DAMAGED);
    expect(sounds).toContain('gruntHit');
  });

  it('tank, on its body and on a plate that holds', () => {
    const body = hit(Tank, 'tank', 1, null);
    expect(body.result).toBe(DAMAGE_RESULT.DAMAGED);
    expect(body.sounds).toContain('tankHit');
    // A shot at the nose (aim 0, bullet flying -x) lands on the front plate
    const plate = hit(Tank, 'tank', 1, Math.PI);
    expect(plate.result).toBe(DAMAGE_RESULT.DAMAGED);
    expect(plate.sounds).toEqual(['hit']);
  });

  it('stabber', () => {
    const { result, sounds } = hit(Stabber, 'stabber', 3, 0);
    expect(result).toBe(DAMAGE_RESULT.DAMAGED);
    expect(sounds).toContain('stabberHit');
  });

  it('rusher: any hit lights the fuse, so it returns EXPLODING', () => {
    const { result, sounds } = hit(Rusher, 'rusher', 1, 0);
    expect(result).toBe(DAMAGE_RESULT.EXPLODING);
    expect(sounds).toContain('rusherHit');
  });
});

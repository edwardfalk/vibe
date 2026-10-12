import { describe, it, expect, afterEach } from 'vitest';
import { CONFIG } from '../../js/config.js';
import { DAMAGE_RESULT } from '../../js/shared/DamageResult.js';
import { bassistWorld } from './helpers/bassistWorld.js';

// His four strings are his health: one snaps each HITS_PER_STRING hits, and
// a hit plays one sound (the bassist spec, Fighting him)
const DEFAULTS = { ...CONFIG.BASSIST };

afterEach(() => {
  Object.assign(CONFIG.BASSIST, DEFAULTS);
});

const sounds = (w) => w.audio.playSound.mock.calls.map(([name]) => name);

describe('his strings', () => {
  it('snap one each HITS_PER_STRING hits', () => {
    const { b } = bassistWorld();
    expect(b.strings()).toBe(4);
    for (let i = 0; i < 3; i++) b.takeDamage(1);
    expect(b.strings()).toBe(3);
    CONFIG.BASSIST.HITS_PER_STRING = 2;
    const tuned = bassistWorld().b;
    expect(tuned.maxHealth).toBe(8);
    tuned.takeDamage(1);
    expect(tuned.strings()).toBe(4);
    tuned.takeDamage(1);
    expect(tuned.strings()).toBe(3);
  });

  it('a hit that snaps none plays one sound, his hit, from his health before it', () => {
    const w = bassistWorld();
    expect(w.b.takeDamage(1)).toBe(DAMAGE_RESULT.DAMAGED);
    expect(w.audio.playSound).toHaveBeenCalledTimes(1);
    expect(w.audio.playSound).toHaveBeenCalledWith('bassistHit', 0, 0, {
      health: 12,
      maxHealth: 12,
    });
  });

  it('a hit that snaps one or more plays one twang instead', () => {
    const w = bassistWorld();
    w.b.takeDamage(2);
    w.audio.playSound.mockClear();
    w.b.takeDamage(1); // 9: the first string goes
    expect(sounds(w)).toEqual(['bassistTwang']);
    w.audio.playSound.mockClear();
    w.b.takeDamage(6); // 3: two more at once
    expect(w.b.strings()).toBe(1);
    expect(sounds(w)).toEqual(['bassistTwang']);
  });

  it('a lethal hit plays nothing of its own: his death’s twang is its sound', () => {
    const w = bassistWorld();
    w.b.health = 1;
    expect(w.b.takeDamage(1)).toBe(DAMAGE_RESULT.DIED);
    expect(w.audio.playSound).not.toHaveBeenCalled();
  });
});

import { describe, it, expect } from 'vitest';
import { RusherBlast } from '../../js/effects/explosions/RusherBlast.js';
import { Explosion } from '../../js/effects/explosions/Explosion.js';
import { ExplosionManager } from '../../js/effects/explosions/ExplosionManager.js';
import { BLAST_SEC } from '../../js/entities/RusherRenderer.js';
import { CONFIG } from '../../js/config.js';

describe("the rusher's blast", () => {
  it('ages by the frame time it is given, and ends after BLAST_SEC', () => {
    const b = new RusherBlast(0, 0);
    expect(b.radius).toBe(CONFIG.RUSHER.EXPLOSION_RADIUS);
    b.update(1000);
    expect(b.active).toBe(true);
    b.update(BLAST_SEC * 1000 - 1000);
    expect(b.active).toBe(false);
  });

  it('varies with where it went off, not with random numbers', () => {
    expect(new RusherBlast(10, 20).seed).toBe(new RusherBlast(10, 20).seed);
    expect(new RusherBlast(10, 20).seed).not.toBe(new RusherBlast(11, 20).seed);
  });

  it('the explosion manager keeps it in its list with its chain flag, and passes the frame time on', () => {
    const m = new ExplosionManager();
    m.addExplosion(5, 6, 'rusher-explosion', { chain: true });
    const [b] = m.explosions;
    expect(b).toBeInstanceOf(RusherBlast);
    expect(b.chain).toBe(true);
    m.update(40);
    expect(b.ageMs).toBe(40);
    // [blind review 2026-10-02] and every other type stays a plain explosion
    m.addExplosion(0, 0, 'hit');
    expect(m.explosions[1]).toBeInstanceOf(Explosion);
  });
});

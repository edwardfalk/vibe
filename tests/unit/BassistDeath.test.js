import { describe, it, expect, vi, afterEach } from 'vitest';
import { CONFIG } from '../../js/config.js';
import { BassistDeath, DEATH_SEC } from '../../js/entities/BassistDeath.js';
import {
  EnemyDeathHandler,
  popTime,
} from '../../js/systems/combat/EnemyDeathHandler.js';
import { SOUND_CONFIG } from '../../js/audio/SoundConfig.js';
import { bassistWorld } from './helpers/bassistWorld.js';
import { transformP5 } from './helpers/transformP5.js';

// For now he dies his own simple way: the last string snaps, its twang
// sliding down onto the hum's root, and on the next eighth he goes slack and
// drifts off (the bassist spec, Death)
const DEATHS = { ...CONFIG.DEATHS };
afterEach(() => {
  Object.assign(CONFIG.DEATHS, DEATHS);
  vi.restoreAllMocks();
});

function killed(blow = null) {
  const explosionManager = { fragmentExplosions: [] };
  const w = bassistWorld({ ms0: 4100, values: { explosionManager } });
  w.audio.ensureAudioContext = vi.fn();
  const error = vi.spyOn(console, 'error');
  const diedAt = w.clock.nowSec();
  new EnemyDeathHandler(w.context).handleEnemyDeath(
    w.b,
    'bassist',
    w.b.x,
    w.b.y,
    blow
  );
  return { ...w, explosionManager, error, diedAt };
}

describe('his death', () => {
  it('starts on the next eighth, his own, with the twang sliding onto the root', () => {
    const w = killed({ dir: 0 });
    expect(w.error).not.toHaveBeenCalled();
    const [death] = w.explosionManager.fragmentExplosions;
    expect(death).toBeInstanceOf(BassistDeath);
    const at = popTime(w.diedAt, w.clock);
    expect(w.audio.playSound).toHaveBeenCalledWith('bassistDeath', 0, 0, {
      at,
    });
    expect(SOUND_CONFIG.bassistDeath.sweep.to[0]).toBe('1');
  });

  it('starts with the bang when the bomb killed him', () => {
    const w = killed({ dir: 0, bomb: true, at: 3 });
    expect(w.audio.playSound).toHaveBeenCalledWith('bassistDeath', 0, 0, {
      at: 3,
    });
  });

  it('asks a bassist nearby to answer, from its start', () => {
    const explosionManager = { fragmentExplosions: [] };
    const w = bassistWorld({ ms0: 4100, values: { explosionManager } });
    w.audio.ensureAudioContext = vi.fn();
    const other = { type: 'bassist', onNearbyDeath: vi.fn(() => true) };
    w.values.enemies.push(other);
    const diedAt = w.clock.nowSec();
    new EnemyDeathHandler(w.context).handleEnemyDeath(w.b, 'bassist', 0, 0);
    expect(other.onNearbyDeath).toHaveBeenCalledWith(
      w.b,
      popTime(diedAt, w.clock),
      false
    );
    expect(SOUND_CONFIG.bassistResponse.group).toBe('band');
  });

  it('draws before and after its start, and is gone once its time is up', () => {
    let now = 0;
    const death = new BassistDeath({
      x: 10,
      y: 20,
      size: 30,
      aim: 0.5,
      dir: 1,
      seed: 0.3,
      startsAt: 0.25,
      now: () => now,
    });
    const { p } = transformP5();
    for (now of [0.1, 0.3, 0.25 + DEATH_SEC * 0.9]) {
      death.draw(p);
      expect(death.active).toBe(true);
    }
    expect(p.drawingContext.depth).toBe(0);
    CONFIG.DEATHS.LINGER = 2; // remains stay twice as long
    now = 0.25 + DEATH_SEC * 1.5;
    death.draw(p);
    expect(death.active).toBe(true);
    now = 0.25 + DEATH_SEC * 2.01;
    death.draw(p);
    expect(death.active).toBe(false);
  });
});

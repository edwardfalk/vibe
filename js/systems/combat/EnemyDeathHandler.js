import { createContextAccessor } from '../../shared/ContextAccessor.js';
import { CONFIG } from '../../config.js';
import { GruntDeath } from '../../entities/GruntDeath.js';
import { LEAD_SEC } from '../../audio/speech/Voicebox.js';
import { heardLatencySec } from '../../audio/BeatTrack.js';

const DEATH_SOUND = {
  stabber: 'stabberOhNo',
  rusher: 'rusherOhNo',
};

// Grunts popping together play the chord's next tone each, in order, then
// round again; a grunt alone plays the first, the minor third. Strummed this
// far apart, they read as one chord.
export const GRUNT_CHORD = Object.freeze(
  [
    ['b3', 5],
    ['5', 5],
    ['b7', 5],
    ['1', 6],
    ['2', 6],
  ].map((note) => Object.freeze(note))
);
export const STRUM_SEC = 0.018;

/**
 * When a death at `now` (s, the beat clock's) pops: on the next eighth note,
 * as on the page, at least LEAD_SEC ahead (Voicebox's lead), so its sound
 * can be scheduled on it. Later deaths never pop earlier.
 */
export function popTime(now, clock) {
  const origin = clock.startTime / 1000;
  const eighth = clock.beatInterval / 2000;
  return origin + Math.ceil((now + LEAD_SEC - origin) / eighth) * eighth;
}

export class EnemyDeathHandler {
  constructor(context = {}) {
    this.context = context;
    this.getContextValue = createContextAccessor(() => this.context);
    // The grunts popping at one time: a pop's audio time never comes round
    // again, even across a restart
    this.chord = { at: null, n: 0 };
  }

  /**
   * An enemy has died: its death, its sounds, and its neighbours' answer.
   * blow: { dir (rad), blast } from what killed it, for a death that flies
   * apart; without one it flies the way it faced.
   */
  handleEnemyDeath(enemy, enemyType, x, y, blow = null) {
    // A sound it is still making stops with it (the stabber's tremolo)
    enemy?.silence?.();
    const explosionManager = this.getContextValue('explosionManager');
    const audio = this.getContextValue('audio');
    const cameraSystem = this.getContextValue('cameraSystem');

    if (!explosionManager || !audio) return;

    let popsAt = null;
    if (enemyType === 'grunt') {
      popsAt = this.gruntDies(enemy, blow, explosionManager, audio);
    } else {
      explosionManager.addFragmentExplosion(x, y, enemy);
      if (enemyType === 'tank') {
        if (cameraSystem) {
          cameraSystem.addShake(8, 15);
        }
        audio.playSound('tankOhNo', x, y);
        audio.playSound('explosion', x, y);
      } else {
        audio.playSound(DEATH_SOUND[enemyType] ?? 'enemyOhNo', x, y);
      }
    }

    // Call-and-response: notify nearby same-type enemies
    const enemies = this.getContextValue('enemies');
    if (enemies) {
      let responseCount = 0;
      for (const other of enemies) {
        if (responseCount >= 2) break;
        if (other === enemy || other.markedForRemoval) continue;
        if (other.type === enemyType && other.onNearbyDeath) {
          other.onNearbyDeath(enemy, popsAt);
          responseCount++;
        }
      }
    }
  }

  /**
   * A grunt bursts like a water balloon (GruntDeath.js) when it pops: on the
   * next eighth (popTime), seen when it is heard. Returns the pop's audio time.
   */
  gruntDies(enemy, blow, explosionManager, audio) {
    // Audio first: starting it moves the beat clock onto audio time, and the
    // death's times must be on the clock it is read by
    audio.ensureAudioContext?.();
    const clock = this.getContextValue('beatClock');
    const now = () => clock.nowSec();
    const diedAt = now();
    const at = popTime(diedAt, clock);
    if (at !== this.chord.at) this.chord = { at, n: 0 };
    const k = this.chord.n++;
    explosionManager.fragmentExplosions.push(
      new GruntDeath({
        x: enemy.x,
        y: enemy.y,
        size: enemy.size * CONFIG.GRUNT_LOOK.ART_SCALE,
        pose: enemy.pose(),
        dir: blow?.dir ?? (enemy.facing < 0 ? Math.PI : 0),
        blast: !!blow?.blast,
        seed: enemy.lookSeed,
        diedAt,
        popsAt: at + heardLatencySec(audio.audioContext),
        now,
      })
    );
    audio.playGruntPop(
      enemy.x,
      enemy.y,
      at + k * STRUM_SEC,
      GRUNT_CHORD[k % GRUNT_CHORD.length],
      enemy.lookSeed
    );
    return at;
  }
}

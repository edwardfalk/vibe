import { createContextAccessor } from '../../shared/ContextAccessor.js';
import { CONFIG } from '../../config.js';
import { GruntDeath } from '../../entities/GruntDeath.js';
import { TankDeath, airDarts } from '../../entities/TankDeath.js';
import {
  StabberDeath,
  stabberDeathRecord,
} from '../../entities/StabberDeath.js';
import { BassistDeath } from '../../entities/BassistDeath.js';
import { LEAD_SEC } from '../../audio/speech/Voicebox.js';
import { heardLatencySec, heardKick } from '../../audio/BeatTrack.js';

const TANK_SHAKE = [8, 15]; // a tank's death shakes the camera: px, frames
const MS_PER_SEC = 1000;

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

/**
 * When a tank's or a stabber's death killed at `diedAt` starts, on the audio
 * clock: with the bang when the hero's bomb killed him (its blow says
 * `bomb`; a bang that played nothing has no time), else on the next eighth
 */
export function deathStart(blow, clock, diedAt) {
  return blow?.bomb && blow.at != null ? blow.at : popTime(diedAt, clock);
}

export class EnemyDeathHandler {
  constructor(context = {}) {
    this.context = context;
    this.getContextValue = createContextAccessor(() => this.context);
    // The grunts popping at one time, and whether a neighbour took on their
    // answer: a pop's audio time never comes round again, even across a
    // restart
    this.chord = { at: null, n: 0, answered: false };
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
    } else if (enemyType === 'tank') {
      this.tankDies(enemy, blow, explosionManager, audio);
      cameraSystem?.addShake(...TANK_SHAKE);
    } else if (enemyType === 'stabber') {
      popsAt = this.stabberDies(enemy, blow, explosionManager, audio);
    } else if (enemyType === 'bassist') {
      popsAt = this.bassistDies(enemy, blow, explosionManager, audio);
    } else {
      // Every type that dies has its own death (a rusher never dies of
      // damage: he blows)
      console.error(`No death for a ${enemyType}`);
    }

    // Call-and-response: notify nearby same-type enemies. Grunts popping
    // together share one neighbour's answer: each pop of the chord asks
    // until one takes it on (one who turns it down, too far or dead, doesn't
    // use it up), and if he dies before it plays, another still alive near
    // the pop gives it
    const enemies = this.getContextValue('enemies');
    const grunt = enemyType === 'grunt';
    const answers = grunt ? 1 : 2;
    if (enemies && !(grunt && this.chord.answered)) {
      let responseCount = 0;
      for (const other of enemies) {
        if (responseCount >= answers) break;
        if (other === enemy || other.markedForRemoval) continue;
        if (
          other.type === enemyType &&
          other.onNearbyDeath?.(enemy, popsAt, grunt)
        ) {
          responseCount++;
        }
      }
      if (grunt && responseCount > 0) this.chord.answered = true;
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
    if (at !== this.chord.at) this.chord = { at, n: 0, answered: false };
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
        popsAt: at + heardLatencySec(audio.audioContext, clock),
        now,
      })
    );
    // A crowd popping together (a blast through a swarm) doesn't stack up:
    // each later pop of a chord is quieter, 1/sqrt of its place in it
    audio.playGruntPop(
      enemy.x,
      enemy.y,
      at + k * STRUM_SEC,
      GRUNT_CHORD[k % GRUNT_CHORD.length],
      enemy.lookSeed,
      1 / Math.sqrt(k + 1)
    );
    return at;
  }

  /**
   * A tank's death, All air (TankDeath.js): with the bang when the bomb
   * killed him, else on the next eighth (popTime), seen when it is heard.
   */
  tankDies(enemy, blow, explosionManager, audio) {
    // Audio first, as for a grunt: the death's times are on the clock it is read by
    audio.ensureAudioContext?.();
    const clock = this.getContextValue('beatClock');
    const now = () => clock.nowSec();
    const diedAt = now();
    const at = deathStart(blow, clock, diedAt);
    const latency = () => heardLatencySec(audio.audioContext, clock);
    const beatSec = clock.beatInterval / MS_PER_SEC;
    const death = new TankDeath({
      x: enemy.x,
      y: enemy.y,
      size: enemy.size * CONFIG.TANK_LOOK.ART_SCALE,
      pose: enemy.pose(),
      dir: blow?.dir ?? enemy.facing,
      seed: enemy.lookSeed,
      diedAt,
      startsAt: at + latency(),
      now,
      kickAge: () =>
        heardKick(clock.getBeatPosition(), beatSec, latency(), true).kickAge,
    });
    explosionManager.fragmentExplosions.push(death);
    audio.playTankDeath?.(
      enemy.x,
      enemy.y,
      at,
      death.timing,
      airDarts(death.timing, enemy.lookSeed)
    );
  }

  /**
   * A stabber's death (StabberDeath.js), in the style ?tune has at the kill:
   * as a tank's, with the bang or on the next eighth, seen when it is heard.
   * His neighbours answer an eighth after it starts. Returns its start's
   * audio time.
   */
  stabberDies(enemy, blow, explosionManager, audio) {
    // Audio first, as for a grunt: the death's times are on the clock it is read by
    audio.ensureAudioContext?.();
    const clock = this.getContextValue('beatClock');
    const now = () => clock.nowSec();
    const diedAt = now();
    const at = deathStart(blow, clock, diedAt);
    const record = stabberDeathRecord({
      style: CONFIG.DEATHS.STABBER_STYLE,
      linger: CONFIG.DEATHS.LINGER,
      beatSec: clock.beatInterval / MS_PER_SEC,
      origin: clock.startTime / MS_PER_SEC,
      at,
      // Clean: the killing hit's flash is the death's to draw
      pose: { ...enemy.pose(), hit: 0, hitAge: Infinity },
      scale: enemy.drawScale(),
      dir: blow?.dir ?? enemy.aim,
      blast: blow?.blast,
      seed: enemy.lookSeed,
    });
    const player = this.getContextValue('player');
    explosionManager.fragmentExplosions.push(
      new StabberDeath({
        x: enemy.x,
        y: enemy.y,
        record,
        diedAt,
        startsAt: at + heardLatencySec(audio.audioContext, clock),
        now,
        hero: () => player ?? null,
      })
    );
    audio.playStabberDeath?.(enemy.x, enemy.y, at, record);
    return at;
  }

  /**
   * A bassist's death (BassistDeath.js): as a tank's, with the bang or on
   * the next eighth, seen when it is heard, his last string's twang sliding
   * down onto the hum's root. His kin answer an eighth after it starts.
   * Returns its start's audio time.
   */
  bassistDies(enemy, blow, explosionManager, audio) {
    // Audio first, as for a grunt: the death's times are on the clock it is read by
    audio.ensureAudioContext?.();
    const clock = this.getContextValue('beatClock');
    const diedAt = clock.nowSec();
    const at = deathStart(blow, clock, diedAt);
    explosionManager.fragmentExplosions.push(
      new BassistDeath({
        x: enemy.x,
        y: enemy.y,
        pose: enemy.pose(),
        scale: CONFIG.BASSIST_LOOK.ART_SCALE,
        dir: blow?.dir ?? enemy.aimAngle,
        seed: enemy.lookSeed,
        diedAt,
        startsAt: at + heardLatencySec(audio.audioContext, clock),
        now: () => clock.nowSec(),
      })
    );
    audio.playSound('bassistDeath', enemy.x, enemy.y, { at });
    return at;
  }
}

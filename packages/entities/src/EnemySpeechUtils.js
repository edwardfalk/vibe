/* EnemySpeechUtils.js - Centralised ambient speech helpers for enemies.
 * Avoids each class duplicating probability logic & dialogue arrays.
 *
 * Usage:
 *   import { speakAmbient } from './EnemySpeechUtils.js';
 *   ...
 *   triggerAmbientSpeech() {
 *     speakAmbient(this, 'grunt');
 *   }
 */
import { floor, random } from '@vibe/core';

// ---------------------------------------------------------------------------
// Dialogue line pools per enemy type (extend freely in one place)
// ---------------------------------------------------------------------------
const LINES = {
  grunt: [
    // Threatening but confused
    'KILL HUMAN!',
    'DESTROY TARGET!',
    'ELIMINATE!',
    'ATTACK MODE!',
    'HOSTILE DETECTED!',
    'ENGAGE ENEMY!',
    'FIRE WEAPONS!',
    'DEATH TO HUMANS!',
    // Confused moments
    'WAIT WHAT?',
    'I FORGOT SOMETHING!',
    'WHERE AM I?',
    'HELP!',
    'WRONG PLANET?',
    'NEED BACKUP!',
    'LOST AGAIN!',
    'OOPS!',
    'MY HELMET IS TIGHT!',
    'WIFI PASSWORD?',
    'MOMMY?',
    'SCARED!',
    'IS THAT MY TARGET?',
    'WHICH BUTTON?',
    "I'M CONFUSED!",
  ],
  rusher: [
    'KAMIKAZE TIME!',
    'SUICIDE RUN!',
    'INCOMING!',
    'BOOM!',
    'EXPLOSIVE DIARRHEA!',
    'LEEROY JENKINS!',
    'WHEEE!',
    "CAN'T STOP!",
    'YOLO!',
    'KAMIKAZE PIZZA PARTY!',
  ],
  stabber: ['STAB!', 'FEEL THE BLADE!', 'KNIVES OUT!', 'CUT YOU!', 'SLICING!'],
  tank: ['CRUSH!', 'HEAVY METAL!', 'ROLLING IN!', 'BASS DRUM!', 'BIG BOOM!'],
};

function randomLine(type) {
  const pool = LINES[type] || LINES.grunt;
  return pool[floor(random() * pool.length)];
}

/**
 * Generic ambient-speech trigger.
 * Handles beat-sync probability boosts and cooldown management.
 * Returns true if a line was spoken.
 */
export function speakAmbient(
  enemy,
  type,
  {
    probability = 0.3, // base chance per frame
    beatList = [2, 4], // beats that boost chance
    beatMultiplier = 3, // boost factor when on beat
    audio,
    beatClock,
  } = {}
) {
  // Resolve deps late to avoid ReferenceError in non-browser envs
  const resolvedAudio =
    audio ?? (typeof window !== 'undefined' ? window.audio : undefined);
  const resolvedBeatClock =
    beatClock ?? (typeof window !== 'undefined' ? window.beatClock : undefined);
  const currentCooldown =
    typeof enemy.speechCooldown === 'number' ? enemy.speechCooldown : 0;
  if (!resolvedAudio || currentCooldown > 0) return false;

  let chance = probability;
  if (resolvedBeatClock && resolvedBeatClock.isOnBeat(beatList)) {
    chance *= beatMultiplier;
  }
  // Clamp to [0, 1]
  chance = Math.max(0, Math.min(1, chance));
  if (random() >= chance) return false;

  const line = randomLine(type);
  if (resolvedAudio.speak(enemy, line, type)) {
    const maxCd = Number.isFinite(enemy.maxSpeechCooldown)
      ? enemy.maxSpeechCooldown
      : 60;
    enemy.speechCooldown = maxCd;
    return true;
  }
  return false;
}

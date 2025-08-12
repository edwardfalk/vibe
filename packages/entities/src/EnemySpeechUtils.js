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
    audio = window.audio,
    beatClock = window.beatClock,
  } = {}
) {
  if (!audio || enemy.speechCooldown > 0) return false;

  let chance = probability;
  if (beatClock && beatClock.isOnBeat(beatList)) chance *= beatMultiplier;
  if (random() >= chance) return false;

  const line = randomLine(type);
  if (audio.speak(enemy, line, type)) {
    enemy.speechCooldown = enemy.maxSpeechCooldown;
    return true;
  }
  return false;
}

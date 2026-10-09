// Every pitched preset names a note of the hum's scale, played by a voice
// on its own degrees (docs/superpowers/specs/2026-10-09-audio-pr2-design.md)
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import {
  SOUND_CONFIG,
  VOICE_DEGREES,
  GRUNT_SHOT_NOTES,
} from '../../js/audio/SoundConfig.js';
import { CONFIG } from '../../js/config.js';
import { hz, ROOTS } from '../../js/audio/Harmony.js';

const pitched = Object.entries(SOUND_CONFIG).filter(
  ([, cfg]) => !cfg.synth && cfg.waveform !== 'noise'
);

// Run `check` at every root the game offers, then put the root back
function atEveryRoot(check) {
  const root = CONFIG.HUM.ROOT;
  try {
    for (const r of Object.keys(ROOTS)) {
      CONFIG.HUM.ROOT = r;
      check(r);
    }
  } finally {
    CONFIG.HUM.ROOT = root;
  }
}

describe('presets name notes', () => {
  it('every pitched preset has a voice and a note, and no Hz, random range or stray type', () => {
    expect(pitched.length).toBeGreaterThan(30);
    for (const [name, cfg] of pitched) {
      expect(Object.keys(VOICE_DEGREES), name).toContain(cfg.voice);
      expect(cfg.note, name).toHaveLength(2);
      for (const key of ['frequency', 'frequencyVariationRange', 'type']) {
        expect(cfg, name).not.toHaveProperty(key);
      }
    }
  });

  it("every note and sweep end resolves at every root and uses only its voice's degrees", () => {
    for (const [name, cfg] of pitched) {
      const notes = [cfg.note, ...(cfg.sweep ? [cfg.sweep.to] : [])];
      for (const [degree] of notes) {
        expect(VOICE_DEGREES[cfg.voice], name).toContain(degree);
      }
      atEveryRoot(() => {
        for (const note of notes) {
          expect(hz(note), `${name} ${note}`).toBeGreaterThan(20);
        }
      });
    }
  });

  it("the attacks keep their registers apart: the tank's shot under the grunt's, under the stabber's strings", () => {
    atEveryRoot((r) => {
      const tank = hz(['1', 1]); // his shot's boom lands here (Band.test.js)
      const grunts = GRUNT_SHOT_NOTES.map((n) => hz(n));
      const strings = hz(['b5', 6]); // StabberStrings.js's stab and screech
      expect(tank, r).toBeLessThan(Math.min(...grunts));
      expect(Math.max(...grunts), r).toBeLessThan(strings);
    });
  });

  it("the stabber's strings' b5 in octave 6 is 1.8 to 2.5 kHz at every root", () => {
    atEveryRoot((r) => {
      expect(hz(['b5', 6]), r).toBeGreaterThan(1800);
      expect(hz(['b5', 6]), r).toBeLessThan(2500);
    });
  });

  it('the crash stays a high-passed cymbal above the stabbers and the kick click', () => {
    expect(SOUND_CONFIG.rusherCrash.highpassHz).toBeGreaterThan(2500);
  });

  it("the stabber's hit is on his 5, in key: the sour b5 is his strings' alone", () => {
    expect(SOUND_CONFIG.stabberHit.note).toEqual(['5', 6]);
  });

  it('the sweeps the spec settled: level-up root to octave, kill streak b3 to 5, game over down to the root', () => {
    expect(SOUND_CONFIG.levelUp.note).toEqual(['1', 4]);
    expect(SOUND_CONFIG.levelUp.sweep.to).toEqual(['1', 5]);
    expect(SOUND_CONFIG.killStreak.note).toEqual(['b3', 5]);
    expect(SOUND_CONFIG.killStreak.sweep.to).toEqual(['5', 5]);
    expect(SOUND_CONFIG.gameOver.sweep.to[0]).toBe('1');
  });
});

// The spec's table (2026-10-09-audio-pr2-design.md): each preset's note and
// sweep end, so no sound drifts out of its register unnoticed
const TABLE = {
  gruntAdvance: [['b3', 4], null],
  gruntRetreat: [['5', 3], null],
  gruntMalfunction: [['b3', 3], null],
  gruntBeep: [['b3', 5], null],
  gruntWhir: [['5', 3], null],
  gruntError: [['b3', 3], null],
  gruntGlitch: [['5', 2], null],
  gruntOw: [['5', 4], null],
  gruntHit: [['b3', 4], null],
  gruntResponse: [['b3', 4], null],
  tankBallKill: [
    ['1', 2],
    ['1', 1],
  ],
  tankShove: [
    ['5', 3],
    ['5', 1],
  ],
  tankHit: [['1', 1], null],
  tankPlateHit: [['5', 5], null],
  tankResponse: [['5', 1], null],
  stabberHit: [['5', 6], null],
  stabberOhNo: [
    ['b7', 5],
    ['b6', 3],
  ],
  stabberResponse: [['b6', 6], null],
  rusherCharge: [
    ['b7', 4],
    ['1', 2],
  ],
  rusherOhNo: [
    ['b7', 5],
    ['b7', 2],
  ],
  rusherHit: [['b7', 4], null],
  rusherResponse: [
    ['1', 5],
    ['b7', 4],
  ],
  shieldBreak: [
    ['1', 6],
    ['5', 3],
  ],
  shieldUp: [
    ['1', 4],
    ['1', 6],
  ],
  playerHit: [['5', 3], null],
  lowHealthWarning: [['1', 3], null],
  explosion: [
    ['1', 3],
    ['b3', 1],
  ],
  enemyOhNo: [
    ['1', 5],
    ['1', 3],
  ],
  levelUp: [
    ['1', 4],
    ['1', 5],
  ],
  killStreak: [
    ['b3', 5],
    ['5', 5],
  ],
  gameOver: [
    ['1', 4],
    ['1', 1],
  ],
};

describe("every preset on the spec's note", () => {
  it("each of the table's 31 presets plays its note and sweeps to its end", () => {
    expect(Object.keys(TABLE)).toHaveLength(31);
    for (const [name, [note, to]] of Object.entries(TABLE)) {
      expect(SOUND_CONFIG[name]?.note, name).toEqual(note);
      expect(SOUND_CONFIG[name]?.sweep?.to ?? null, name).toEqual(to);
    }
  });
});

// Every js/ file, read as text
function sources(dir = 'js') {
  return readdirSync(dir, { recursive: true })
    .filter((f) => f.endsWith('.js') && !f.startsWith('vendor'))
    .map((f) => readFileSync(join(dir, f), 'utf8'));
}

describe('every sound the game plays exists', () => {
  it("every name passed to playSound( under js/ is a preset, and so is every enemy's response", () => {
    const names = new Set();
    for (const text of sources()) {
      for (const [, name] of text.matchAll(/playSound\(\s*'([^']+)'/g)) {
        names.add(name);
      }
    }
    expect(names.size).toBeGreaterThan(20);
    for (const name of names) expect(SOUND_CONFIG, name).toHaveProperty(name);
    // BaseEnemy plays `${type}Response`
    for (const type of ['grunt', 'tank', 'stabber', 'rusher']) {
      expect(SOUND_CONFIG).toHaveProperty(`${type}Response`);
    }
    // And the names that reach playSound through a variable
    for (const name of [
      ...['gruntMalfunction', 'gruntBeep', 'gruntWhir', 'gruntError'],
      'gruntGlitch', // the grunt's weird noises
      ...['gruntAdvance', 'gruntRetreat'], // his moveSound
      ...['stabberOhNo', 'rusherOhNo', 'enemyOhNo'], // EnemyDeathHandler
      'explosion', // BulletCollisionResolvers' deathSound
    ]) {
      expect(SOUND_CONFIG, name).toHaveProperty(name);
    }
  });
});

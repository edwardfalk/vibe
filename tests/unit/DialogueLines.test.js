import { describe, it, expect } from 'vitest';
import {
  SPEAKER_LINES,
  GRUNT_OW,
  TANK_FIRE,
  TANK_CHARGING,
  TANK_ANGER_LINES,
  TANK_CALM_LINES,
  STAB_WARNINGS,
  RUSHER_LINES,
  RUSHER_BATTLE_CRIES,
  RUSHER_BLAST_LINES,
  PLAYER_LINES,
  MAX_FIGHT_WORDS,
  getPlayerDialogueLine,
} from '../../js/audio/DialogueLines.js';
import { CONFIG } from '../../js/config.js';

describe('dialogue lines', () => {
  it('lists fixed lines for every speaker the speech config knows', () => {
    expect(Object.keys(SPEAKER_LINES).sort()).toEqual(
      Object.keys(CONFIG.SPEECH.SPEAKERS).sort()
    );
    for (const lines of Object.values(SPEAKER_LINES)) {
      expect(lines.length).toBeGreaterThan(0);
      expect(new Set(lines).size).toBe(lines.length);
      for (const line of lines) expect(line.trim()).not.toBe('');
    }
  });

  it('includes the lines said directly at their call sites', () => {
    expect(SPEAKER_LINES.grunt).toContain(GRUNT_OW);
    expect(SPEAKER_LINES.tank).toEqual(
      expect.arrayContaining([
        TANK_FIRE,
        TANK_CHARGING,
        ...TANK_ANGER_LINES,
        ...TANK_CALM_LINES,
      ])
    );
    expect(SPEAKER_LINES.stabber).toEqual(
      expect.arrayContaining(STAB_WARNINGS)
    );
    expect(SPEAKER_LINES.rusher).toEqual(
      expect.arrayContaining([...RUSHER_BATTLE_CRIES, ...RUSHER_BLAST_LINES])
    );
    // The hero shouts as he plants his bomb, then counts it down (BombSystem.js)
    expect(SPEAKER_LINES.player).toEqual(
      expect.arrayContaining(['TIMEBOMB!', '3', '2', '1'])
    );
    // The Bouncer's lines (docs/superpowers/specs/2026-10-01-bouncer-tank-design.md)
    expect(SPEAKER_LINES.tank).toEqual(
      expect.arrayContaining([
        'NOT ON THE LIST!',
        "YOU'RE NOT GETTING IN!",
        'NO SNEAKERS!',
      ])
    );
    // The stuntman's lines
    expect(SPEAKER_LINES.rusher).toEqual(
      expect.arrayContaining(['WATCH THIS!', 'NO HANDS!', 'TA-DA!'])
    );
    // The Dude's (docs/superpowers/specs/2026-10-03-dude-hero-design.md)
    expect(SPEAKER_LINES.player).toEqual(
      expect.arrayContaining([
        "WHERE'S MY CARPET?!",
        'THAT CARPET REALLY TIED THE ROOM TOGETHER.',
        'NO CARPET HERE EITHER.',
      ])
    );
  });

  it("gives each of the rusher's moments its own lines: chatter, battle cry, punchline", () => {
    const pools = [RUSHER_LINES, RUSHER_BATTLE_CRIES, RUSHER_BLAST_LINES];
    const all = pools.flat();
    expect(new Set(all).size).toBe(all.length);
    expect(RUSHER_BLAST_LINES).toEqual(
      expect.arrayContaining(['TA-DA!', 'NAILED IT!', 'YOLO!'])
    );
  });

  it('gives the hero lines for each moment, short in the fight', () => {
    for (const context of [
      'start',
      'levelUp',
      'damage',
      'lowHealth',
      'death',
    ]) {
      expect(PLAYER_LINES[context].length, context).toBeGreaterThan(0);
      expect(PLAYER_LINES[context]).toContain(
        getPlayerDialogueLine(context, () => 0.5)
      );
    }
    for (const context of ['levelUp', 'damage', 'lowHealth']) {
      for (const line of PLAYER_LINES[context]) {
        expect(line.split(/\s+/).length, line).toBeLessThanOrEqual(
          MAX_FIGHT_WORDS
        );
      }
    }
  });
});

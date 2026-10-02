import { describe, it, expect } from 'vitest';
import {
  SPEAKER_LINES,
  GRUNT_OW,
  TANK_FIRE,
  TANK_CHARGING,
  TANK_ANGER_LINES,
  TANK_CALM_LINES,
  STAB_WARNINGS,
  RUSHER_BATTLE_CRIES,
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
      expect.arrayContaining(RUSHER_BATTLE_CRIES)
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
  });
});

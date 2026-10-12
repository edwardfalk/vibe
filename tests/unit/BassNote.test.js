import { describe, it, expect, vi, afterEach } from 'vitest';
import { CONFIG } from '../../js/config.js';
import { Bullet } from '../../js/entities/bullet.js';
import { NOTE_OWNER } from '../../js/entities/BassNote.js';
import { driveBassNotes, noteSpeed } from '../../js/entities/Bassist.js';
import { CollisionSystem } from '../../js/systems/CollisionSystem.js';
import { bassistWorld } from './helpers/bassistWorld.js';

// His note: fired on the slap along the aim let 3 locked, it glides and
// lurches on each let he plays (the bassist spec, The note)
const DEFAULTS = { ...CONFIG.BASSIST };
const letMs = (n) => (n + CONFIG.SWING.AND_AT) * 500;

afterEach(() => {
  Object.assign(CONFIG.BASSIST, DEFAULTS);
});

describe('the slap fires his note', () => {
  it('along the aim let 3 locked, though the hero moved since', () => {
    const w = bassistWorld({ ms0: 1990, hero: { x: 300, y: 0 } });
    w.run(2000, letMs(6) - 10);
    w.step(letMs(6) + 5); // let 3: his aim locks at the hero
    const locked = w.b.toHero;
    w.hero.y = 300; // he moves before the slap
    const fired = w.run(letMs(6) + 21, 3999).map((e) => e.r);
    expect(fired).toHaveLength(1);
    const [note] = fired;
    expect(note.owner).toBe(NOTE_OWNER);
    expect(note.ownerId).toBe(w.b.id);
    expect(note.angle).toBe(locked); // where the hero was at let 3
    expect(Math.abs(w.b.toHero - locked)).toBeGreaterThan(0.3);
    expect(note.size).toBe(CONFIG.BASSIST.NOTE_SIZE);
    expect(note.damage).toBe(CONFIG.PLAYER.DAMAGE_BASS_NOTE);
  });
});

describe('his note swings', () => {
  const beatSec = 0.5;
  const at = (n, share) => n + CONFIG.SWING.AND_AT + share; // beats

  it('glides between his lets, and is pushed from each let he plays to the next beat', () => {
    const { b } = bassistWorld();
    const { NOTE_GLIDE_PX_S: glide } = CONFIG.BASSIST;
    expect(noteSpeed(b, at(4, -0.1), beatSec)).toBe(glide);
    expect(noteSpeed(b, at(4, 0.01), beatSec)).toBeGreaterThan(glide * 2);
    expect(noteSpeed(b, 5 - 1e-4, beatSec)).toBeCloseTo(glide, 0);
    expect(noteSpeed(b, 5.1, beatSec)).toBe(glide);
  });

  it('each push carries it NOTE_LURCH_PX on top of the glide, whatever AND_AT', () => {
    const { b } = bassistWorld();
    for (const and of [2 / 3, 0.75]) {
      CONFIG.SWING.AND_AT = and;
      let px = 0;
      const dt = 1e-4; // beats
      for (let t = 4 + and; t < 5; t += dt) {
        px +=
          (noteSpeed(b, t, beatSec) - CONFIG.BASSIST.NOTE_GLIDE_PX_S) *
          dt *
          beatSec;
      }
      expect(px).toBeCloseTo(CONFIG.BASSIST.NOTE_LURCH_PX, 0);
    }
    CONFIG.SWING.AND_AT = 2 / 3;
  });

  it('is not pushed on a let whose string has snapped', () => {
    const { b } = bassistWorld();
    b.health = 9; // let 1's string gone
    const glide = CONFIG.BASSIST.NOTE_GLIDE_PX_S;
    expect(noteSpeed(b, at(4, 0.01), beatSec)).toBe(glide); // let 1
    expect(noteSpeed(b, at(5, 0.01), beatSec)).toBeGreaterThan(glide); // let 2
  });
});

describe('the pass that drives his notes', () => {
  const note = (ownerId, angle = 0) => {
    const n = Bullet.acquire(0, 0, angle, 0, NOTE_OWNER);
    n.ownerId = ownerId;
    return n;
  };

  it("sets each note's velocity along its own line, per 60 Hz frame", () => {
    const w = bassistWorld();
    w.at(4.1 * 500);
    const n = note(w.b.id, Math.PI / 2);
    driveBassNotes([n], w.values.enemies, w.clock);
    const speed = noteSpeed(w.b, w.clock.getBeatPosition(), 0.5);
    expect(n.velocity.x).toBeCloseTo(0, 9);
    expect(n.velocity.y).toBeCloseTo(speed / 60, 9);
  });

  it('pops a note whose bassist is gone, silently; leaves the others', () => {
    const w = bassistWorld();
    const mine = note(w.b.id);
    const orphan = note('gone');
    const grunt = Bullet.acquire(0, 0, 0, 4, 'enemy-grunt');
    driveBassNotes([mine, orphan, grunt], w.values.enemies, w.clock);
    expect(orphan._remove).toBe(true);
    expect(mine._remove).toBe(false);
    expect(grunt._remove).toBe(false);
    w.b.markedForRemoval = true; // dead this frame
    driveBassNotes([mine], w.values.enemies, w.clock);
    expect(mine._remove).toBe(true);
    expect(w.audio.playSound).not.toHaveBeenCalled();
  });
});

describe('what his note does', () => {
  it('hurts the hero for CONFIG.PLAYER.DAMAGE_BASS_NOTE', () => {
    const saved = CONFIG.PLAYER.DAMAGE_BASS_NOTE;
    CONFIG.PLAYER.DAMAGE_BASS_NOTE = 13; // not its own damage, to tell them apart
    const player = { x: 0, y: 0, size: 30, hurt: vi.fn() };
    const n = Bullet.acquire(0, 0, 0, 0, NOTE_OWNER);
    new CollisionSystem(
      { get: (k) => ({ enemyBullets: [n], player })[k], set() {} },
      {}
    ).checkEnemyBulletsVsPlayer();
    expect(player.hurt.mock.calls[0][0]).toBe(13);
    CONFIG.PLAYER.DAMAGE_BASS_NOTE = saved;
  });

  it('a recycled bullet carries nothing of a note', () => {
    const n = Bullet.acquire(0, 0, 0, 0, NOTE_OWNER);
    Bullet.release(n);
    const shot = Bullet.acquire(0, 0, 0, 4, 'enemy-grunt');
    expect(shot).toBe(n); // the pool hands it back
    expect(shot.size).toBe(6);
    expect(shot.damage).toBe(1);
    expect(shot.energy).toBeUndefined();
  });
});

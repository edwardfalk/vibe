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
  it('from where he is, at where the hero was on let 3, though both moved since', () => {
    const w = bassistWorld({ ms0: 1990, hero: { x: 300, y: 0 } });
    w.run(2000, letMs(6) - 10);
    w.step(letMs(6) + 5); // let 3: he locks onto the hero's spot
    w.hero.y = 300; // the hero moves before the slap; he drifts on too
    const fired = w.run(letMs(6) + 21, 3999).map((e) => e.r);
    expect(fired).toHaveLength(1);
    const [note] = fired;
    expect(note.owner).toBe(NOTE_OWNER);
    expect(note.ownerId).toBe(w.b.id);
    // It leaves from him at the slap, toward (300, 0)
    expect(note.angle).toBeCloseTo(Math.atan2(0 - note.y, 300 - note.x), 9);
    expect(Math.abs(w.b.toHero - note.angle)).toBeGreaterThan(0.3);
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
    w.at(letMs(4) + 25); // inside let 1's push
    const n = note(w.b.id, Math.PI / 2);
    driveBassNotes([n], w.values.enemies, w.clock);
    const speed = noteSpeed(w.b, w.clock.getBeatPosition(), 0.5);
    expect(speed).toBeGreaterThan(CONFIG.BASSIST.NOTE_GLIDE_PX_S * 2); // pushed
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

// It meets aliens as the tank's ball does, but passes through his kind
// (the bassist spec, The note)
describe("his note meets aliens by the tank ball's rule", () => {
  function hit(enemies) {
    const note = Bullet.acquire(0, 0, 0, 0, NOTE_OWNER);
    note.ownerId = 'his';
    const audio = { playSound: vi.fn() };
    const gameState = { addKill: vi.fn(), addScore: vi.fn(), killStreak: 0 };
    const values = { enemies, enemyBullets: [note], audio, gameState };
    const handleEnemyDeath = vi.fn();
    new CollisionSystem(
      { get: (k) => values[k], set() {} },
      { handleEnemyDeath }
    ).checkEnemyBulletsVsEnemies();
    const sounds = audio.playSound.mock.calls.map(([key]) => key);
    return { note, gameState, handleEnemyDeath, sounds };
  }
  const alien = (type, more) => ({
    type,
    id: type,
    x: 0,
    y: 0,
    size: 20,
    health: 3,
    maxHealth: 3,
    takeDamage: vi.fn(() => 'damaged'),
    ...more,
  });

  it("kills a grunt in its path and goes on; the kill scores as the ball's, without the ball's sounds", () => {
    const grunt = alien('grunt');
    const { note, gameState, handleEnemyDeath, sounds } = hit([grunt]);
    expect(handleEnemyDeath).toHaveBeenCalledWith(grunt, 'grunt', 0, 0, {
      dir: 0,
    });
    expect(grunt.markedForRemoval).toBe(true);
    expect(gameState.addScore).toHaveBeenCalled();
    expect(note._remove).toBe(false); // energy left: on through the swarm
    expect(note.energy).toBeLessThan(100);
    expect(sounds).not.toContain('tankBallKill');
    expect(sounds).not.toContain('enemyFrying');
  });

  it('passes through bassists, its own and others', () => {
    const own = alien('bassist', { id: 'his' });
    const other = alien('bassist', { id: 'another' });
    const { note, handleEnemyDeath } = hit([own, other]);
    expect(own.takeDamage).not.toHaveBeenCalled();
    expect(other.takeDamage).not.toHaveBeenCalled();
    expect(handleEnemyDeath).not.toHaveBeenCalled();
    expect(note._remove).toBe(false);
  });

  it('passes a bassist to reach the grunt behind him', () => {
    const other = alien('bassist', { id: 'another' });
    const grunt = alien('grunt');
    const { handleEnemyDeath } = hit([other, grunt]);
    expect(handleEnemyDeath).toHaveBeenCalledWith(grunt, 'grunt', 0, 0, {
      dir: 0,
    });
  });

  it('dents a tank by its own NOTE_DAMAGE_TO_TANKS, and is spent on him', () => {
    const saved = CONFIG.BASSIST.NOTE_DAMAGE_TO_TANKS;
    CONFIG.BASSIST.NOTE_DAMAGE_TO_TANKS = 7;
    const tank = alien('tank');
    const { note } = hit([tank]);
    expect(tank.takeDamage).toHaveBeenCalledWith(7, 0, 'bassist');
    expect(note._remove).toBe(true);
    CONFIG.BASSIST.NOTE_DAMAGE_TO_TANKS = saved;
  });
});

// Shot down, a note hangs, swelling, until the next let, then bursts with
// its b7 booked at that let (the bassist spec, It can be shot)
describe('the hero shoots his notes down', () => {
  function frame({
    playerBullets,
    enemyBullets,
    enemies = [],
    player,
    gameState,
  }) {
    const values = { playerBullets, enemyBullets, enemies, player, gameState };
    new CollisionSystem(
      { get: (k) => values[k], set() {} },
      { handleEnemyDeath: vi.fn() }
    ).checkBulletCollisions();
    return values;
  }
  const hero = () => ({ x: 0, y: 0, size: 30, hurt: vi.fn() });

  it('a shot that meets a note stops it before it reaches the hero, that frame', () => {
    const note = Bullet.acquire(0, 0, 0, 0, NOTE_OWNER);
    note.ownerId = 'his';
    const shot = Bullet.acquire(-10, 0, 0, 20, 'player');
    shot.update(); // its path crosses the note
    const player = hero();
    const v = frame({ playerBullets: [shot], enemyBullets: [note], player });
    expect(player.hurt).not.toHaveBeenCalled();
    expect(note.hung).not.toBeNull();
    expect(v.playerBullets).toEqual([]); // the shot is spent
    expect(v.enemyBullets).toEqual([note]); // the note hangs on
  });

  it('a shot that stops a note counts as a hit for his accuracy', () => {
    const note = Bullet.acquire(0, 0, 0, 0, NOTE_OWNER);
    const shot = Bullet.acquire(-10, 0, 0, 20, 'player');
    shot.update();
    const gameState = { addShotHit: vi.fn() };
    frame({
      playerBullets: [shot],
      enemyBullets: [note],
      player: hero(),
      gameState,
    });
    expect(gameState.addShotHit).toHaveBeenCalledTimes(1);
  });

  it('a hanging note hurts no one, no alien, and takes no second shot', () => {
    const note = Bullet.acquire(0, 0, 0, 0, NOTE_OWNER);
    note.hung = { at: 4.2, let: 4 };
    const shot = Bullet.acquire(-10, -5, 0, 20, 'player');
    shot.update(); // through the note, past the grunt below it
    const grunt = {
      type: 'grunt',
      id: 'g',
      x: 0,
      y: 15, // in the note's reach, out of the shot's
      size: 20,
      health: 3,
      maxHealth: 3,
    };
    const player = hero();
    const v = frame({
      playerBullets: [shot],
      enemyBullets: [note],
      enemies: [grunt],
      player,
    });
    expect(player.hurt).not.toHaveBeenCalled();
    expect(grunt.markedForRemoval).toBeUndefined();
    expect(v.playerBullets).toEqual([shot]);
  });

  it('hangs, swelling, until the next let, then bursts with its b7 at its grid time', () => {
    const w = bassistWorld();
    const note = Bullet.acquire(0, 0, 0, 0, NOTE_OWNER);
    note.ownerId = w.b.id;
    w.at(4.2 * 500);
    note.hung = { at: 4.2, let: 4 }; // as the shot left it
    w.at(4.5 * 500);
    driveBassNotes([note], w.values.enemies, w.clock);
    expect(note.velocity).toEqual({ x: 0, y: 0 });
    expect(note.swell).toBeGreaterThan(0.5);
    expect(note.swell).toBeLessThan(1);
    expect(w.audio.playSound).not.toHaveBeenCalled();
    w.at(letMs(4) + 10);
    driveBassNotes([note], w.values.enemies, w.clock);
    expect(note._remove).toBe(true);
    const [[name, , , opts]] = w.audio.playSound.mock.calls;
    expect(name).toBe('bassPluck');
    expect(opts.note).toEqual(['b7', CONFIG.BASSIST.OCTAVE]);
    expect(opts.at).toBeCloseTo(
      CONFIG.BEAT_CLOCK.AHEAD_MS / 1000 + letMs(4) / 1000,
      9
    );
    expect(opts.seed).toBe(w.b.lookSeed);
    expect(opts.exact).toBe(true); // on its let, not its nearest eighth
  });

  it('waits for the let after the one it was shot on', () => {
    const w = bassistWorld();
    const shot = Bullet.acquire(-10, -5, 0, 20, 'player');
    shot.update(); // through the note, past the grunt below it
    const note = Bullet.acquire(0, 0, 0, 0, NOTE_OWNER);
    note.ownerId = w.b.id;
    w.at(letMs(4) + 5); // shot just after let 4
    w.values.playerBullets = [shot];
    w.values.enemyBullets = [note];
    new CollisionSystem(w.context, {}).checkBulletCollisions();
    expect(note.hung.let).toBe(5);
  });

  it('pops silently if his bassist dies first', () => {
    const w = bassistWorld();
    const note = Bullet.acquire(0, 0, 0, 0, NOTE_OWNER);
    note.ownerId = w.b.id;
    note.hung = { at: 4.2, let: 4 };
    w.b.markedForRemoval = true;
    w.at(letMs(4) + 10);
    driveBassNotes([note], w.values.enemies, w.clock);
    expect(note._remove).toBe(true);
    expect(w.audio.playSound).not.toHaveBeenCalled();
  });

  it('a recycled bullet does not hang', () => {
    const note = Bullet.acquire(0, 0, 0, 0, NOTE_OWNER);
    note.hung = { at: 4.2, let: 4 };
    note.swell = 0.5;
    Bullet.release(note);
    const again = Bullet.acquire(0, 0, 0, 0, NOTE_OWNER);
    expect(again).toBe(note);
    expect(again.hung).toBeNull();
    expect(again.swell).toBe(0);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { handleContactCollisions } from '../../js/systems/combat/PlayerContactHandlers.js';
import {
  plantBomb,
  updateBombs,
  drawBombs,
} from '../../js/systems/BombSystem.js';
import { tankBackPoint } from '../../js/entities/TankRenderer.js';
import { HazardCloud } from '../../js/effects/explosions/HazardCloud.js';
import { damageEnemiesInRadius } from '../../js/effects/AreaDamageHandler.js';
import { CONFIG } from '../../js/config.js';
import { DAMAGE_RESULT } from '../../js/shared/DamageResult.js';
import { createMockAudio } from './helpers/enemyMocks.js';
import { transformP5 } from './helpers/transformP5.js';
import { tankWorld } from './helpers/tankWorld.js';

const clockAt = (beats) => ({
  getBeatPosition: () => beats,
  beatInterval: 500,
});
const touchingTank = (id, o = {}) => ({
  id,
  type: 'tank',
  x: 0,
  y: 0,
  size: 50,
  facing: 0, // facing +x: his back is -x
  isSpawning: false,
  checkCollision: () => true,
  ...o,
});
const touch = (player, enemies, activeBombs) =>
  handleContactCollisions({
    player,
    enemies,
    activeBombs,
    beatClock: clockAt(9),
  });

describe("planting the hero's bomb", () => {
  it('plants only from behind a tank: not at his front or sides, nor while he spawns', () => {
    for (const [x, y, plants] of [
      [-60, 0, true],
      [60, 0, false],
      [0, 60, false],
      [0, -60, false],
    ]) {
      const activeBombs = [];
      touch({ x, y }, [touchingTank(1)], activeBombs);
      expect(activeBombs.length, `hero at ${x},${y}`).toBe(plants ? 1 : 0);
    }
    const activeBombs = [];
    touch(
      { x: -60, y: 0 },
      [touchingTank(1, { isSpawning: true })],
      activeBombs
    );
    expect(activeBombs).toEqual([]);
  });

  it('touching a tank frame after frame plants one bomb on it', () => {
    const activeBombs = [];
    for (let i = 0; i < 10; i++) {
      touch({ x: -60, y: 0 }, [touchingTank(1)], activeBombs);
    }
    expect(activeBombs).toHaveLength(1);
  });

  it('each tank takes its own', () => {
    const activeBombs = [];
    const enemies = [touchingTank(1), touchingTank(2)];
    for (let i = 0; i < 10; i++) touch({ x: -60, y: 0 }, enemies, activeBombs);
    expect(activeBombs.map((b) => b.tankId).sort()).toEqual([1, 2]);
  });
});

describe('the bomb, on the beat', () => {
  // Planted at beat 10.3: its beat 0 is beat 11. Ticks come under a beat
  // apart, as frames do; a longer gap is a stall (see the last test)
  const setup = () => {
    let beats = 10.3;
    const clock = { getBeatPosition: () => beats, beatInterval: 500 };
    const audio = createMockAudio();
    const tank = {
      id: 't',
      type: 'tank',
      x: 0,
      y: 0,
      size: 50,
      facing: 0,
      markedForRemoval: false,
      takeDamage: vi.fn(() => DAMAGE_RESULT.DAMAGED),
    };
    const activeBombs = [];
    plantBomb(activeBombs, tank, clock);
    const explosionManager = {
      addExplosion: vi.fn(),
      addRadioactiveDebris: vi.fn(),
      addPlasmaCloud: vi.fn(),
    };
    const tick = (b) => {
      beats = b;
      updateBombs({
        activeBombs,
        enemies: [tank],
        audio,
        beatClock: clock,
        explosionManager,
      });
    };
    const ticks = (from, to) => {
      for (let b = from; b <= to + 1e-9; b += 0.25) tick(b);
    };
    return { tank, activeBombs, audio, explosionManager, tick, ticks };
  };
  const said = (audio) =>
    audio.speak.mock.calls.map(([, word, voice, force]) => [
      word,
      voice,
      force,
    ]);

  it('counts 3, 2, 1 on its beats 0, 2 and 4, each forced past the voice cooldown, and blows on beat 6', () => {
    const { activeBombs, audio, ticks, tick } = setup();
    ticks(10.5, 16.75);
    expect(said(audio)).toEqual([
      ['3', 'player', true],
      ['2', 'player', true],
      ['1', 'player', true],
    ]);
    expect(activeBombs).toHaveLength(1);
    tick(17);
    expect(activeBombs).toHaveLength(0);
  });

  it('hurts the tank it is on', () => {
    const { tank, ticks } = setup();
    ticks(10.5, 17);
    expect(tank.takeDamage).toHaveBeenCalledWith(
      expect.any(Number),
      null,
      'bomb'
    );
  });

  it('holds its fuse through beats the game sat out (a hidden tab), then counts on', () => {
    const { activeBombs, audio, ticks, tick } = setup();
    ticks(10.5, 12.25); // "3" said at 11
    tick(22.25); // ten beats went by without a frame
    expect(activeBombs).toHaveLength(1);
    expect(said(audio).map(([w]) => w)).toEqual(['3']);
    ticks(22.5, 26.25); // two beats past where it stopped: "2", then "1"
    expect(said(audio).map(([w]) => w)).toEqual(['3', '2', '1']);
    ticks(26.5, 27.25);
    expect(activeBombs).toHaveLength(0);
  });

  it('rides on his back, and stays where he died, still drawn and still due', () => {
    const { tank, activeBombs, ticks, explosionManager } = setup();
    tank.x = 100;
    tank.facing = Math.PI / 2;
    ticks(10.5, 12);
    const s = 50 * CONFIG.TANK_LOOK.ART_SCALE;
    const back = tankBackPoint(100, 0, s, Math.PI / 2);
    expect(activeBombs[0].x).toBeCloseTo(back.x);
    expect(activeBombs[0].y).toBeCloseTo(back.y);
    tank.y = 30; // he moves on, and is shot dead there before the bang
    tank.markedForRemoval = true;
    const died = tankBackPoint(100, 30, s, Math.PI / 2);
    ticks(12.25, 13);
    tank.x = 400; // whatever happens to the corpse
    ticks(13.25, 14);
    expect(activeBombs[0].x).toBeCloseTo(died.x);
    expect(activeBombs[0].y).toBeCloseTo(died.y);
    const { p, shapes } = transformP5();
    drawBombs(p, activeBombs);
    expect(
      shapes.some(
        (sh) =>
          Math.hypot(sh.centre?.[0] - died.x, sh.centre?.[1] - died.y) < 1e-6
      )
    ).toBe(true);
    ticks(14.25, 17);
    expect(explosionManager.addExplosion).toHaveBeenCalledWith(
      died.x,
      died.y,
      'tank-plasma'
    );
  });
});

describe('a bomb kills the tank it is on', () => {
  it('the blast from his back, then the plasma it leaves, even with him moving at full drift', () => {
    const w = tankWorld({ hero: { x: 3000, y: 0 } }); // far away
    const t = w.tank(); // full health, facing +x
    const clouds = [];
    const explosionManager = {
      addExplosion() {},
      addRadioactiveDebris: (x, y) =>
        clouds.push(new HazardCloud(x, y, 'DEBRIS')),
      addPlasmaCloud: (x, y) => clouds.push(new HazardCloud(x, y, 'PLASMA')),
    };
    w.at(4000); // beat 8: its beat 0 is 9, the bang on 15
    plantBomb(w.values.activeBombs, t, w.clock);
    for (let ms = 4000; ms <= 7600; ms += 100) {
      w.at(ms);
      updateBombs({
        activeBombs: w.values.activeBombs,
        enemies: [t],
        explosionManager,
        beatClock: w.clock,
      });
    }
    expect(w.values.activeBombs).toHaveLength(0);
    expect(t.health).toBeLessThan(t.maxHealth);
    let frames = 0;
    while (t.health > 0 && frames < 120) {
      t.x += CONFIG.TANK.DRIFT_PX_S / 60; // drifting off at full speed
      for (const cloud of clouds) {
        const event = cloud.update();
        if (event) damageEnemiesInRadius(event, [t], {}, 'area');
      }
      frames++;
    }
    expect(t.health).toBeLessThanOrEqual(0);
  });
});

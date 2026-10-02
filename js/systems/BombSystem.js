/**
 * The hero's bomb: his weapon against tanks. He plants it by touching a
 * tank's bare back (PlayerContactHandlers.js). It rides there, counts down
 * "3, 2, 1" on the beat in his voice, and blows on beat CONFIG.BOMB.FUSE_BEATS,
 * hurting everything within reach: the tank it is on, other aliens and the
 * hero. Once its tank is gone it stays where he died and still blows.
 *
 * Its fuse counts BeatClock's beats. A stall the game doesn't run through (a
 * hidden tab, ?tune's "Sound while paused") holds it: whole beats it missed
 * move it on. A pause without ?tune stops the clock itself. It is drawn from
 * its own last update (seenAt), so it holds still when the game does.
 */
import { floor, clamp01 } from '../mathUtils.js';
import { CONFIG } from '../config.js';
import { DAMAGE_RESULT } from '../shared/DamageResult.js';
import { TANK_COLORS, tankBackPoint } from '../entities/TankRenderer.js';

const COUNT_WORDS = ['3', '2', '1'];
const COUNT_EVERY_BEATS = 2;
const AMBER_LEFT = 0.34; // its light goes white-hot for the last third
// Its look, at size 50 (the prototype's numbers, in px): a halo, the body,
// the hero's band, a glint, the light and the blink's ring
const LOOK = {
  HALO: [21, 25],
  BODY: 16,
  BAND: [5, 16],
  GLINT: [-3, -3, 3.5, 2.5],
  LIGHT_AT: -6,
  LIGHT: 5.5,
  LIGHT_GLOW: 25,
  RING: [18, 63],
  INK: 2.2,
};

const backOf = (tank) =>
  tankBackPoint(
    tank.x,
    tank.y,
    tank.size * CONFIG.TANK_LOOK.ART_SCALE,
    tank.facing
  );
// Beats since its beat 0, the first whole beat after it was planted
const fuseOf = (bomb, beats) => beats - (floor(bomb.plantedAt) + 1);
// Its damage at a point: from hi at its centre to lo at its reach, 0 beyond;
// never above hi, so a max of 0 deals none
function blastAt(bomb, x, y, lo, hi) {
  const R = CONFIG.BOMB.RADIUS_PX;
  const d = Math.hypot(x - bomb.x, y - bomb.y);
  if (d >= R) return 0;
  return Math.min(hi, Math.max(lo, floor(hi * (1 - d / R))));
}

/** The hero plants his bomb on a tank's back (one each, MAX_ACTIVE at once) */
export function plantBomb(activeBombs, tank, beatClock) {
  if (!activeBombs || !tank || !beatClock) return;
  if (activeBombs.length >= CONFIG.BOMB.MAX_ACTIVE) return;
  if (activeBombs.some((bomb) => bomb.tankId === tank.id)) return; // one each
  const now = beatClock.getBeatPosition();
  activeBombs.push({
    ...backOf(tank),
    facing: tank.facing,
    plantedAt: now,
    seenAt: now, // the beat position of its last update
    beatSec: beatClock.beatInterval / 1000,
    said: 0, // how many of "3, 2, 1" it has said
    tankId: tank.id,
    tankRef: tank,
  });
}

export function updateBombs(context) {
  const {
    activeBombs,
    enemies,
    player,
    explosionManager,
    audio,
    cameraSystem,
    gameState,
    collisionSystem,
    enemyDeathHandler,
    floatingText,
    beatClock,
  } = context;
  if (!activeBombs || !enemies || !beatClock) return;
  const B = CONFIG.BOMB;
  const beats = beatClock.getBeatPosition();

  for (let i = activeBombs.length - 1; i >= 0; i--) {
    const bomb = activeBombs[i];
    // Whole beats the game sat out move the fuse on, so it holds
    const missed = floor(beats - bomb.seenAt);
    if (missed >= 1) bomb.plantedAt += missed;
    bomb.seenAt = beats;

    // It rides on its tank's back; a dead tank's last back point is kept
    const tank = bomb.tankRef;
    if (tank) {
      Object.assign(bomb, backOf(tank), { facing: tank.facing });
      if (tank.markedForRemoval) bomb.tankRef = null;
    }

    const fuse = fuseOf(bomb, beats);
    if (fuse < B.FUSE_BEATS) {
      // "3", "2", "1" on the last three even beats before the bang, forced
      // past the cooldown all voices share; after a stall only the latest
      const first = B.FUSE_BEATS - COUNT_WORDS.length * COUNT_EVERY_BEATS;
      const due = Math.min(
        COUNT_WORDS.length,
        floor((fuse - first) / COUNT_EVERY_BEATS) + 1
      );
      if (due > bomb.said) {
        bomb.said = due;
        audio?.speak?.(bomb, COUNT_WORDS[due - 1], 'player', true);
      }
      continue;
    }

    if (explosionManager) {
      explosionManager.addExplosion(bomb.x, bomb.y, 'tank-plasma');
      explosionManager.addRadioactiveDebris(bomb.x, bomb.y);
      explosionManager.addPlasmaCloud(bomb.x, bomb.y);
    }
    audio?.playSound?.('explosion', bomb.x, bomb.y);
    cameraSystem?.addShake(20, 40);

    if (player) {
      const hit = blastAt(
        bomb,
        player.x,
        player.y,
        B.PLAYER_DAMAGE_MIN,
        B.PLAYER_DAMAGE_MAX
      );
      if (hit && !player.hurt(hit, 'bomb')) {
        player.knockBack(bomb.x, bomb.y, CONFIG.PLAYER.KNOCKBACK_BOMB);
      }
    }

    // Every live alien in reach, the tank it is on included
    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j];
      if (enemy.markedForRemoval) continue; // killed last frame, not yet removed
      const damage = blastAt(
        bomb,
        enemy.x,
        enemy.y,
        B.ENEMY_DAMAGE_MIN,
        B.ENEMY_DAMAGE_MAX
      );
      if (!damage) continue;
      const damageResult = enemy.takeDamage(damage, null, 'bomb');

      if (damageResult === DAMAGE_RESULT.DAMAGED) {
        if (floatingText) {
          floatingText.addDamage(
            enemy.x,
            enemy.y - (enemy.size || 0) * 0.5,
            damage
          );
        }
      }

      if (damageResult === DAMAGE_RESULT.DIED) {
        if (enemyDeathHandler) {
          enemyDeathHandler.handleEnemyDeath(
            enemy,
            enemy.type,
            enemy.x,
            enemy.y
          );
        } else if (collisionSystem) {
          collisionSystem.handleEnemyDeath(enemy, enemy.type, enemy.x, enemy.y);
        }
        enemy.markedForRemoval = true;
        if (gameState) {
          gameState.addKill();
          gameState.addScore(20);
        }
      } else if (damageResult === DAMAGE_RESULT.EXPLODING) {
        if (explosionManager) {
          explosionManager.addExplosion(enemy.x, enemy.y, 'hit');
        }
      }
    }

    activeBombs.splice(i, 1);
  }
}

/**
 * Every bomb, in the world (call it under the camera), as at its last
 * update: a halo, the bomb with the hero's band and a glint, its light
 * blinking faster as it runs down (amber, then white-hot) with a ring on
 * each blink, and a thin ring at its blast's reach that empties as it runs
 * down. Drawn from the bomb itself, so one whose tank has died still shows.
 */
export function drawBombs(p, activeBombs) {
  if (!activeBombs?.length) return;
  const B = CONFIG.BOMB;
  const C = TANK_COLORS;
  for (const bomb of activeBombs) {
    const tank = bomb.tankRef;
    const at = tank && !tank.markedForRemoval ? backOf(tank) : bomb;
    const facing = tank && !tank.markedForRemoval ? tank.facing : bomb.facing;
    const beats = bomb.seenAt;
    const left = 1 - clamp01(fuseOf(bomb, beats) / B.FUSE_BEATS);
    const age = Math.max(0, (beats - bomb.plantedAt) * bomb.beatSec);
    const blinks = 2 * age + (14 / 27) * age ** 3; // faster and faster
    const on = blinks % 1 < 0.45;
    const lit = left < AMBER_LEFT ? C.hot : C.amber;
    p.push();
    p.translate(at.x, at.y);
    // How far to run and how long you have: the reach, emptying
    if (left > 0) {
      p.noFill();
      p.stroke(...lit, 110);
      p.strokeWeight(2);
      p.arc(
        0,
        0,
        B.RADIUS_PX * 2,
        B.RADIUS_PX * 2,
        -Math.PI / 2,
        -Math.PI / 2 + 2 * Math.PI * left
      );
    }
    p.rotate(facing);
    p.noStroke();
    p.fill(...C.bombHalo, 130);
    p.ellipse(0, 0, ...LOOK.HALO);
    p.fill(...C.ink);
    p.ellipse(0, 0, LOOK.BODY + LOOK.INK);
    p.fill(...C.bomb);
    p.ellipse(0, 0, LOOK.BODY);
    p.fill(...C.heroBand);
    p.rect(-LOOK.BAND[0] / 2, -LOOK.BAND[1] / 2, ...LOOK.BAND);
    p.fill(255, 255, 255, 130);
    p.ellipse(...LOOK.GLINT);
    if (on) {
      p.fill(...lit, 140);
      p.ellipse(LOOK.LIGHT_AT, 0, LOOK.LIGHT_GLOW);
    }
    p.fill(...C.ink);
    p.ellipse(LOOK.LIGHT_AT, 0, LOOK.LIGHT + LOOK.INK);
    p.fill(...(on ? lit : C.bombUnlit));
    p.ellipse(LOOK.LIGHT_AT, 0, LOOK.LIGHT);
    const ring = blinks % 1;
    p.noFill();
    p.stroke(...lit, 220 * (1 - ring));
    p.strokeWeight(1.5);
    p.ellipse(0, 0, LOOK.RING[0] + (LOOK.RING[1] - LOOK.RING[0]) * ring);
    p.pop();
  }
}

/**
 * The hero's bomb: his weapon against tanks. He plants it by touching a
 * tank's bare back (PlayerContactHandlers.js), shouting "TIMEBOMB!". It
 * rides there, counts down "3, 2, 1" on the beat in his voice from its beat
 * 0, the first beat at least COUNT_LEAD_BEATS after his shout starts, and
 * blows on its beat
 * CONFIG.BOMB.FUSE_BEATS,
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
import { hash01 } from '../entities/RusherRenderer.js';
import { COMIC } from '../effects/explosions/BombBlast.js';
import { BOMB_PLANTED, COUNTDOWN, TANK_UH_OH } from '../audio/DialogueLines.js';

const COUNT_EVERY_BEATS = 2;
const SEED_Y = 7.31; // folds y into a bang's seed, so bombs on one row differ
// His "uh oh" comes this many beats before the bang: the eighth after the
// hero's "1" ends (it lasts 0.45 s, measured 2026-10-09; "UH, OH" 0.77 s,
// so its "OH" runs into the bang)
const UH_OH_BEATS = 1;
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
// Beats since its beat 0, the first whole beat at least COUNT_LEAD_BEATS
// after his shout starts (after the touch until Voicebox has scheduled it)
const fuseOf = (bomb, beats) =>
  beats - Math.ceil(bomb.plantedAt + CONFIG.BOMB.COUNT_LEAD_BEATS);
// Its damage at a point: from hi at its centre to lo at its reach, 0 beyond;
// never above hi, so a max of 0 deals none
function blastAt(bomb, x, y, lo, hi) {
  const R = CONFIG.BOMB.RADIUS_PX;
  const d = Math.hypot(x - bomb.x, y - bomb.y);
  if (d >= R) return 0;
  return Math.min(hi, Math.max(lo, floor(hi * (1 - d / R))));
}

/**
 * The hero plants his bomb on a tank's back (one each, MAX_ACTIVE at once)
 * and shouts "TIMEBOMB!", forced past the gap between his lines
 */
export function plantBomb(activeBombs, tank, beatClock, audio = null) {
  if (!activeBombs || !tank || !beatClock) return;
  if (activeBombs.length >= CONFIG.BOMB.MAX_ACTIVE) return;
  if (activeBombs.some((bomb) => bomb.tankId === tank.id)) return; // one each
  const now = beatClock.getBeatPosition();
  const bomb = {
    ...backOf(tank),
    facing: tank.facing,
    plantedAt: now, // its count is timed from here, then from his shout
    seenAt: now, // the beat position of its last update
    beatSec: beatClock.beatInterval / 1000,
    said: 0, // how many of "3, 2, 1" it has said
    tankId: tank.id,
    tankRef: tank,
  };
  activeBombs.push(bomb);
  // From the hero (no speaker is the hero), so it shows over him and not
  // under the count on the bomb. Its count waits for the shout's real start:
  // Voicebox schedules it after this frame, or after a render, and it lands
  // on the eighth after that. Its news comes within MAX_WAIT_MS, before the
  // count's beat 0; a dropped shout leaves the count timed from the touch.
  audio?.speak?.(null, BOMB_PLANTED, 'player', true, (startsAt) => {
    if (!beatClock.audioContext) return; // its beats aren't audio seconds
    const at = (startsAt - beatClock.startTime / 1000) / bomb.beatSec;
    if (at <= bomb.plantedAt) return;
    bomb.plantedAt = at;
    // A stall before this (a hidden tab) is in that start already: the
    // next update mustn't add its beats again as missed
    bomb.seenAt = Math.max(bomb.seenAt, beatClock.getBeatPosition());
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
      // "3", "2", "1" on the last three even beats before the bang, from its
      // beat 0 on (a short fuse drops the first), forced past the gap
      // between the hero's lines; after a stall only the latest
      const first = B.FUSE_BEATS - COUNTDOWN.length * COUNT_EVERY_BEATS;
      const due = Math.min(
        COUNTDOWN.length,
        floor((fuse - first) / COUNT_EVERY_BEATS) + 1
      );
      if (due > bomb.said) {
        bomb.said = due;
        // A word whose beat came before beat 0 counts as said, unspoken
        const wordAt = first + (due - 1) * COUNT_EVERY_BEATS;
        if (wordAt >= 0) {
          audio?.speak?.(bomb, COUNTDOWN[due - 1], 'player', true);
        }
      }
      // His "uh oh": his line, once, forced past the gap between the
      // enemies' lines, and his flinch until the bang (Tank.js draws it);
      // not once he is dead
      const live = bomb.tankRef;
      if (live && fuse >= B.FUSE_BEATS - UH_OH_BEATS) {
        live.flinch = { bang: beats - fuse + B.FUSE_BEATS, beats: UH_OH_BEATS };
        if (!bomb.uhOh) {
          bomb.uhOh = true;
          audio?.speak?.(live, TANK_UH_OH, 'tank', true);
        }
      }
      continue;
    }

    // The bang (the Comic blast), and the cloud it leaves: the plasma and the
    // debris, one picture and one sound
    const seed = hash01(bomb.x + SEED_Y * bomb.y);
    explosionManager?.addBombBlast(bomb.x, bomb.y, seed);
    explosionManager?.addBombCloud(bomb.x, bomb.y, seed);
    audio?.playBombBang?.(bomb.x, bomb.y);
    cameraSystem?.addShake(...COMIC.SHAKE);

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

    // Every live alien in reach; the tank it is on takes enough to die
    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j];
      if (enemy.markedForRemoval) continue; // killed last frame, not yet removed
      const reached = blastAt(
        bomb,
        enemy.x,
        enemy.y,
        B.ENEMY_DAMAGE_MIN,
        B.ENEMY_DAMAGE_MAX
      );
      // Its own tank dies whatever the damage sliders say
      if (!reached && enemy.id !== bomb.tankId) continue;
      const damage =
        enemy.id === bomb.tankId
          ? Math.max(reached, enemy.health || 0)
          : reached;
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
        // A blast, away from the bomb, and the bomb's: a tank it kills starts
        // dying with the bang
        const blow = {
          dir: Math.atan2(enemy.y - bomb.y, enemy.x - bomb.x),
          blast: true,
          bomb: true,
        };
        (enemyDeathHandler ?? collisionSystem)?.handleEnemyDeath(
          enemy,
          enemy.type,
          enemy.x,
          enemy.y,
          blow
        );
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
    // Its blink speeds up from its beat 0, as the prototype's did from a
    // 6-beat fuse's start; it holds lit until then
    const age = Math.max(0, fuseOf(bomb, beats) * bomb.beatSec);
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

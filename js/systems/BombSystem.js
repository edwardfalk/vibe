import { sqrt, max, floor, atan2, cos, sin } from '../mathUtils.js';
import {
  DAMAGE_RESULT,
  normalizeDamageResult,
} from '../shared/contracts/DamageResult.js';

const BOMB_EXPLOSION_RADIUS = 250;
const MIN_PLAYER_BOMB_DAMAGE = 10;
const MAX_PLAYER_BOMB_DAMAGE = 40;
const MIN_ENEMY_BOMB_DAMAGE = 5;
const MAX_ENEMY_BOMB_DAMAGE = 30;
const MAX_ACTIVE_BOMBS = 3;
const WARNING_SECONDS = 3;

export function tryPlaceTankBomb(activeBombs, enemy) {
  if (!activeBombs || !enemy) return;
  if (activeBombs.length >= MAX_ACTIVE_BOMBS) return;
  const timer = 180;
  activeBombs.push({
    x: enemy.x,
    y: enemy.y,
    timer,
    maxTimer: timer,
    tankId: enemy.id,
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
  } = context;
  if (!activeBombs || !enemies) return;

  for (let i = activeBombs.length - 1; i >= 0; i--) {
    const bomb = activeBombs[i];
    bomb.timer--;

    const tank = enemies.find((e) => e.id === bomb.tankId);
    if (tank) {
      bomb.x = tank.x;
      bomb.y = tank.y;
    }

    const secondsLeft = Math.ceil(bomb.timer / 60);
    if (
      secondsLeft <= WARNING_SECONDS &&
      secondsLeft > 0 &&
      bomb.timer % 60 === 0 &&
      audio &&
      audio.speak &&
      tank
    ) {
      audio.speak(tank, secondsLeft.toString(), 'player');
    }

    if (bomb.timer > 0) continue;

    if (explosionManager) {
      explosionManager.addExplosion(bomb.x, bomb.y, 'tank-plasma');
      explosionManager.addRadioactiveDebris(bomb.x, bomb.y);
      explosionManager.addPlasmaCloud(bomb.x, bomb.y);
    }

    if (audio) {
      audio.playBombExplosion(bomb.x, bomb.y);
    }

    if (cameraSystem) {
      cameraSystem.addShake(20, 40);
    }

    const explosionRadiusSq = BOMB_EXPLOSION_RADIUS * BOMB_EXPLOSION_RADIUS;

    if (player) {
      const dx = bomb.x - player.x;
      const dy = bomb.y - player.y;
      const playerDistSq = dx * dx + dy * dy;
      if (playerDistSq < explosionRadiusSq) {
        const playerDistance = sqrt(playerDistSq);
        const damage = max(
          MIN_PLAYER_BOMB_DAMAGE,
          floor(
            MAX_PLAYER_BOMB_DAMAGE *
              (1 - playerDistance / BOMB_EXPLOSION_RADIUS)
          )
        );

        if (audio) {
          audio.playPlayerHit();
        }
        if (gameState) {
          gameState.resetKillStreak();
        }

        if (player.takeDamage(damage, 'tank-bomb')) {
          if (gameState) {
            gameState.setGameState('gameOver');
          }
        } else {
          if (player.velocity) {
            const knockbackAngle = atan2(player.y - bomb.y, player.x - bomb.x);
            const knockbackForce = 15;
            player.velocity.x += cos(knockbackAngle) * knockbackForce;
            player.velocity.y += sin(knockbackAngle) * knockbackForce;
          }
        }
      }
    }

    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j];
      if (enemy.id === bomb.tankId) continue; // originating tank placed the bomb
      const dx = bomb.x - enemy.x;
      const dy = bomb.y - enemy.y;
      const enemyDistSq = dx * dx + dy * dy;
      if (enemyDistSq >= explosionRadiusSq) continue;

      const enemyDistance = sqrt(enemyDistSq);
      const damage = max(
        MIN_ENEMY_BOMB_DAMAGE,
        floor(
          MAX_ENEMY_BOMB_DAMAGE * (1 - enemyDistance / BOMB_EXPLOSION_RADIUS)
        )
      );
      const damageResult = normalizeDamageResult(
        enemy.takeDamage(damage, null, 'bomb')
      );

      if (damageResult === DAMAGE_RESULT.DIED) {
        if (collisionSystem) {
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

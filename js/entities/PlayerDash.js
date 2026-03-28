/**
 * PlayerDash - Encapsulates player dash ability logic.
 * Extracted from player.js for file-size split (~500 line guideline).
 */

import { CONFIG } from '../config.js';
import { atan2, cos, sin } from '../mathUtils.js';

const MIN_DELTA_MS = 1;
const MAX_DELTA_MS = 100;

/** Apply dash movement and update dash timer. Call when player.isDashing. */
export function updateDash(player, deltaTimeMs) {
  const clampedDelta = Math.max(
    MIN_DELTA_MS,
    Math.min(deltaTimeMs, MAX_DELTA_MS)
  );
  const dt = clampedDelta / CONFIG.GAME_SETTINGS.FRAME_TIME_MS;
  player.x += player.dashVelocity.x * dt;
  player.y += player.dashVelocity.y * dt;

  player.dashTimerMs += clampedDelta;
  if (player.dashTimerMs >= player.maxDashTimeMs) {
    player.isDashing = false;
    player.dashTimerMs = 0;
    console.log('💨 Dash completed!');
  }
}

/** Try to start a dash. Returns true if dash started. */
export function tryStartDash(player) {
  if (player.dashCooldownMs > 0 || player.isDashing) return false;

  let dashDirX = 0;
  let dashDirY = 0;
  let dashFromKeyboard = false;

  if (player.p.keyIsDown(87)) {
    dashDirY = -1;
    dashFromKeyboard = true;
  }
  if (player.p.keyIsDown(83)) {
    dashDirY = 1;
    dashFromKeyboard = true;
  }
  if (player.p.keyIsDown(65)) {
    dashDirX = -1;
    dashFromKeyboard = true;
  }
  if (player.p.keyIsDown(68)) {
    dashDirX = 1;
    dashFromKeyboard = true;
  }

  if (dashDirX === 0 && dashDirY === 0 && player.cameraSystem) {
    const worldMouse = player.cameraSystem.screenToWorld(
      player.p.mouseX,
      player.p.mouseY
    );
    const mouseAngle = atan2(worldMouse.y - player.y, worldMouse.x - player.x);
    dashDirX = cos(mouseAngle);
    dashDirY = sin(mouseAngle);
  }

  if (dashFromKeyboard && dashDirX !== 0 && dashDirY !== 0) {
    dashDirX *= 0.707;
    dashDirY *= 0.707;
  }

  // Guard: don't waste dash cooldown on a zero-velocity dash
  if (dashDirX === 0 && dashDirY === 0) return false;

  player.dashVelocity = {
    x: dashDirX * player.dashSpeed,
    y: dashDirY * player.dashSpeed,
  };
  player.isDashing = true;
  player.dashTimerMs = 0;
  player.dashCooldownMs = player.maxDashCooldownMs;
  const audio = player.getContextValue
    ? player.getContextValue('audio')
    : window.audio;
  if (audio) audio.playSound('playerDash', player.x, player.y);

  console.log(
    `💨 Player dashed! Direction: (${dashDirX.toFixed(2)}, ${dashDirY.toFixed(2)})`
  );
  return true;
}

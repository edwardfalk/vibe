/**
 * PlayerDash - Encapsulates player dash ability logic.
 * Extracted from player.js for file-size split (~500 line guideline).
 */

import { atan2, cos, sin } from '../mathUtils.js';

const MAX_DELTA_MS = 100;

/** Apply dash movement and update dash timer. Call when player.isDashing. */
export function updateDash(player, deltaTimeMs) {
  const clampedDelta = Math.min(deltaTimeMs, MAX_DELTA_MS);
  const dt = clampedDelta / 16.6667;
  player.x += player.dashVelocity.x * dt;
  player.y += player.dashVelocity.y * dt;

  player.dashTimerMs += deltaTimeMs;
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

  player.dashVelocity = {
    x: dashDirX * player.dashSpeed,
    y: dashDirY * player.dashSpeed,
  };
  player.isDashing = true;
  player.dashTimerMs = 0;
  player.dashCooldownMs = player.maxDashCooldownMs;

  console.log(
    `💨 Player dashed! Direction: (${dashDirX.toFixed(2)}, ${dashDirY.toFixed(2)})`
  );
  return true;
}

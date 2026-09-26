import { sin, max } from '../mathUtils.js';
import { drawGlow } from '../effects/glowUtils.js';
import { drawPlayerDashEffect } from '../effects/DashEffect.js';

const LOW_HEALTH_GLOW = [255, 100, 100];
const SHIELD_GLOW = [100, 200, 255];

/**
 * Player character rendering — read-only access to player state.
 * Extracted from player.js to separate rendering from game logic.
 */

export function drawPlayer(p, player) {
  // Low-health pulse, and the shield's blue field while it is up
  try {
    const healthPercent = player.health / player.maxHealth;
    if (healthPercent < 0.3) {
      const pulse = sin(p.frameCount * 0.3) * 0.5 + 0.5;
      drawGlow(
        p,
        player.x,
        player.y,
        player.size * 2.5,
        LOW_HEALTH_GLOW,
        pulse * 0.8
      );
    }
    if (player.shieldUp) {
      drawGlow(p, player.x, player.y, player.size * 2, SHIELD_GLOW, 0.6);
    }
  } catch (error) {
    console.error('Player glow error:', error);
  }

  p.push();
  p.translate(player.x, player.y);
  p.rotate(player.aimAngle);
  // Aiming left, mirror him so he stays head-up instead of upside down
  if (Math.cos(player.aimAngle) < 0) p.scale(1, -1);

  const s = player.size;
  const walkBob = player.isMoving ? sin(player.animFrame) * 2 : 0;

  // Body bob
  p.translate(0, walkBob);

  // Draw legs (behind body) - ensure they're always visible
  p.fill(player.pantsColor);
  p.noStroke();

  // Reset any potential rendering state issues that might hide legs
  p.blendMode(p.BLEND);

  const legOffset = player.isMoving ? sin(player.animFrame) * 3 : 0;
  const legWidth = max(s * 0.15, 2);
  const legHeight = max(s * 0.35, 8);
  p.rect(-s * 0.25, s * 0.1 - legOffset, legWidth, legHeight); // Left leg
  p.rect(s * 0.1, s * 0.1 + legOffset, legWidth, legHeight); // Right leg

  // Draw main body with better visibility
  p.fill(player.vestColor);
  p.stroke(255, 255, 255, 100); // Light outline for clarity
  p.strokeWeight(1);
  p.rect(-s * 0.3, -s * 0.1, s * 0.6, s * 0.4);
  p.noStroke();

  // Draw arms
  p.fill(player.skinColor);

  // Left arm (animated)
  p.push();
  p.translate(-s * 0.25, 0);
  p.rotate(player.isMoving ? sin(player.animFrame) * 0.3 : 0);
  p.rect(-s * 0.06, 0, s * 0.12, s * 0.25);
  p.pop();

  // Right arm (gun arm - steady)
  p.rect(s * 0.2, -s * 0.02, s * 0.12, s * 0.25);

  // Draw gun
  p.fill(player.gunColor);
  p.rect(s * 0.25, -s * 0.04, s * 0.4, s * 0.08);

  // Gun barrel
  p.fill(60);
  p.rect(s * 0.65, -s * 0.025, s * 0.12, s * 0.05);

  // Enhanced muzzle flash with glow
  if (player.muzzleFlash > 0) {
    const flashSize = player.muzzleFlash * 0.4;
    const flashIntensity = player.muzzleFlash / 10;

    // Outer glow
    p.push();
    p.blendMode(p.ADD);
    p.fill(255, 255, 100, 100 * flashIntensity);
    p.noStroke();
    p.ellipse(s * 0.8, 0, flashSize * 2);

    // Inner flash
    p.fill(255, 255, 200, 200 * flashIntensity);
    p.ellipse(s * 0.8, 0, flashSize);

    // Core
    p.fill(255, 255, 255, 255 * flashIntensity);
    p.ellipse(s * 0.8, 0, flashSize * 0.4);
    p.blendMode(p.BLEND);
    p.pop();
  }

  // Head: bare, in space. Buzz cut and black shades are all the protection
  // he needs. Drawn big so the look reads in play; features scale with it.
  const headD = s * 0.5;
  const headY = -s * 0.33;
  const u = headD / 10; // one tenth of the head
  p.fill(player.skinColor);
  p.ellipse(0, headY, headD);

  // Buzz cut: a thin cap of hair over the crown
  p.fill(60, 40, 25);
  p.arc(0, headY, headD, headD, p.PI + 0.35, p.TWO_PI - 0.35, p.CHORD);

  // Black shades: two lenses on a bridge, across the whole face
  const lensW = 4.6 * u;
  const lensH = 2.4 * u;
  const lensY = headY - 0.6 * u;
  p.fill(0);
  p.rect(-lensW - 0.3 * u, lensY, lensW, lensH, 0.6 * u, 0.6 * u, u, u);
  p.rect(0.3 * u, lensY, lensW, lensH, 0.6 * u, 0.6 * u, u, u);
  p.rect(-0.6 * u, lensY + 0.3 * u, 1.2 * u, 0.6 * u); // bridge
  // A small white highlight on each lens
  p.fill(255, 255, 255, 190);
  p.rect(-lensW + 0.5 * u, lensY + 0.4 * u, 1.4 * u, 0.5 * u);
  p.rect(1.1 * u, lensY + 0.4 * u, 1.4 * u, 0.5 * u);

  // A smirk
  p.stroke(120, 60, 50);
  p.strokeWeight(1);
  p.line(-0.6 * u, headY + 2.8 * u, 1.8 * u, headY + 2.3 * u);
  p.noStroke();

  drawPlayerDashEffect(p, s, {
    isDashing: player.isDashing,
    dashTimerMs: player.dashTimerMs,
    maxDashTimeMs: player.maxDashTimeMs,
    dashVelocity: player.dashVelocity,
  });

  // Health bar above player (drawn relative to player)
  drawPlayerHealthBar(p, player);

  p.pop();
}

function drawPlayerHealthBar(p, player) {
  const barWidth = player.size * 1.2;
  const barHeight = 4;
  const yOffset = -player.size * 0.8;

  // Background
  p.fill(60);
  p.noStroke();
  p.rect(-barWidth / 2, yOffset, barWidth, barHeight);

  // Health
  const healthPercent = player.health / player.maxHealth;
  p.fill(
    healthPercent > 0.5
      ? player.p.color(100, 200, 100)
      : healthPercent > 0.25
        ? player.p.color(255, 255, 100)
        : player.p.color(255, 100, 100)
  );
  p.rect(-barWidth / 2, yOffset, barWidth * healthPercent, barHeight);
}

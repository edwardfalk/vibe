import { sin, max } from '../mathUtils.js';
import { drawGlow } from '../effects/glowUtils.js';
import { drawPlayerDashEffect } from '../effects/DashEffect.js';

/**
 * Player character rendering — read-only access to player state.
 * Extracted from player.js to separate rendering from game logic.
 */

export function drawPlayer(p, player) {
  // Health-based glow
  try {
    const healthPercent = player.health / player.maxHealth;
    if (healthPercent > 0.7) {
      drawGlow(
        p,
        player.x,
        player.y,
        player.size * 2,
        p.color(100, 200, 255),
        0.6
      );
    } else if (healthPercent < 0.3) {
      const pulse = sin(p.frameCount * 0.3) * 0.5 + 0.5;
      drawGlow(
        p,
        player.x,
        player.y,
        player.size * 2.5,
        p.color(255, 100, 100),
        pulse * 0.8
      );
    }
  } catch (error) {
    console.error('Player glow error:', error);
  }

  p.push();
  p.translate(player.x, player.y);
  p.rotate(player.aimAngle);

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

  // Draw head
  p.fill(player.skinColor);
  p.ellipse(0, -s * 0.25, s * 0.3);

  // Draw bandana
  p.fill(player.bandanaColor);
  p.rect(-s * 0.15, -s * 0.35, s * 0.3, s * 0.08);

  // Bandana tails
  p.rect(-s * 0.12, -s * 0.27, s * 0.04, s * 0.15);
  p.rect(s * 0.08, -s * 0.25, s * 0.04, s * 0.12);

  // Mysterious eyes
  p.fill(0);
  const eyeOffset = s * 0.07;
  const eyeSize = s * 0.06;
  p.ellipse(-eyeOffset, -s * 0.25, eyeSize);
  p.ellipse(eyeOffset, -s * 0.25, eyeSize);

  // Small cosmic horns for flair
  p.fill(128, 0, 128);
  p.triangle(-s * 0.12, -s * 0.35, -s * 0.05, -s * 0.55, -s * 0.01, -s * 0.35);
  p.triangle(s * 0.12, -s * 0.35, s * 0.05, -s * 0.55, s * 0.01, -s * 0.35);

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

/**
 * BackgroundEffects.js - Merged from 3 source files:
 *   BeatPulseOverlay.js, InteractiveBackgroundEffects.js, AuroraWisps.js
 */

// ─── BeatPulseOverlay (module-private) ───────────────────────────────────────

let cachedVignette = null;

export function resetBeatPulseCache() {
  if (cachedVignette) {
    cachedVignette.remove();
    cachedVignette = null;
  }
}

function drawBeatPulseOverlay(p, beatClock, healthOverlayColor) {
  if (!beatClock) return;

  const phase = beatClock.getBeatPhase();
  const intensity = beatClock.getBeatIntensity(8);
  const currentBeat = beatClock.getCurrentBeat();
  const isDownbeat = currentBeat === 0;

  // 1. Calculate beat flash color
  let flashR = 0,
    flashG = 0,
    flashB = 0,
    flashA = 0;
  // Significantly reduced full-screen flash intensity so environment reactivity stands out
  const rawFlashAlpha = isDownbeat ? intensity * 15 : intensity * 5;
  if (rawFlashAlpha > 1) {
    if (isDownbeat) {
      flashR = 200;
      flashG = 180;
      flashB = 255;
    } else {
      flashR = 138;
      flashG = 43;
      flashB = 226;
    }
    flashA = rawFlashAlpha;
  }

  // Combine with health overlay
  if (healthOverlayColor || flashA > 0) {
    let finalR = flashR;
    let finalG = flashG;
    let finalB = flashB;
    let finalA = flashA;

    if (healthOverlayColor) {
      // Simple additive color mixing for the overlay
      finalR = p.constrain(finalR + healthOverlayColor.r, 0, 255);
      finalG = p.constrain(finalG + healthOverlayColor.g, 0, 255);
      finalB = p.constrain(finalB + healthOverlayColor.b, 0, 255);
      finalA = p.constrain(finalA + healthOverlayColor.a, 0, 255);
    }

    if (finalA > 0) {
      p.fill(finalR, finalG, finalB, finalA);
      p.noStroke();
      p.rect(0, 0, p.width, p.height);
    }
  }

  // 2. Beat ring — expanding circle from screen center
  if (phase < 0.6) {
    const ringProgress = phase / 0.6;
    const ringRadius = 40 + ringProgress * 350;
    const ringAlpha = (1 - ringProgress) * (isDownbeat ? 70 : 30);
    const ringWeight = (1 - ringProgress) * 2.5 + 0.5;

    p.noFill();
    p.stroke(180, 140, 255, ringAlpha);
    p.strokeWeight(ringWeight);
    p.ellipse(p.width / 2, p.height / 2, ringRadius * 2, ringRadius * 2);
  }

  // 3. Vignette pulse using cached graphics
  const vigAlpha = intensity * 0.12;
  if (vigAlpha > 0.005) {
    if (
      !cachedVignette ||
      cachedVignette.width !== p.width ||
      cachedVignette.height !== p.height
    ) {
      if (cachedVignette) cachedVignette.remove();
      cachedVignette = p.createGraphics(p.width, p.height);
      const ctx2d = cachedVignette.drawingContext;
      const grad = ctx2d.createRadialGradient(
        p.width / 2,
        p.height / 2,
        p.width * 0.25,
        p.width / 2,
        p.height / 2,
        p.width * 0.72
      );
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(20,10,40,1)'); // Full opacity
      ctx2d.fillStyle = grad;
      ctx2d.fillRect(0, 0, p.width, p.height);
    }

    p.push();
    p.tint(255, vigAlpha * 255);
    p.imageMode(p.CORNER);
    p.image(cachedVignette, 0, 0);
    p.pop();
  }
}

// ─── InteractiveBackgroundEffects ────────────────────────────────────────────

export function drawInteractiveBackgroundEffectsLayer(
  p,
  player,
  gameState,
  beatClock,
  randomRangeFn
) {
  p.push();

  let healthOverlayColor = null;

  if (player) {
    const healthPercent =
      player.maxHealth > 0
        ? Math.max(0, Math.min(1, player.health / player.maxHealth))
        : 0;
    if (healthPercent < 0.3) {
      const dangerPulse = p.sin(p.frameCount * 0.2) * 0.5 + 0.5;
      healthOverlayColor = {
        r: 255,
        g: 0,
        b: 0,
        a: dangerPulse * 15 * (1 - healthPercent),
      };
    } else if (healthPercent > 0.9) {
      healthOverlayColor = {
        r: 0,
        g: 150,
        b: 255,
        a: 8,
      };
    }
  }

  // Draw beat pulse overlay and pass health color to avoid multiple full-screen rects
  drawBeatPulseOverlay(p, beatClock, healthOverlayColor);

  if (player && player.isMoving) {
    const rippleIntensity = p.map(player.speed, 0, 5, 0, 1);
    for (let i = 0; i < 3; i++) {
      const rippleRadius = (p.frameCount * 2 + i * 20) % 100;
      const rippleAlpha = p.map(rippleRadius, 0, 100, 30 * rippleIntensity, 0);
      p.stroke(64, 224, 208, rippleAlpha);
      p.strokeWeight(2);
      p.noFill();
      p.ellipse(player.x, player.y, rippleRadius, rippleRadius);
    }
  }

  if (gameState && gameState.score > 0) {
    const energyLevel = p.min(gameState.score / 1000, 1);
    for (let i = 0; i < 5; i++) {
      const energyX = randomRangeFn(p.width);
      const energyY = randomRangeFn(p.height);
      const energySize = randomRangeFn(10, 30) * energyLevel;
      const energyAlpha = randomRangeFn(5, 15) * energyLevel;
      p.fill(255, 215, 0, energyAlpha);
      p.noStroke();
      p.ellipse(energyX, energyY, energySize, energySize);
    }
  }

  if (gameState && gameState.killStreak >= 5) {
    const streakIntensity = p.min(gameState.killStreak / 10, 1);
    const borderPulse = p.sin(p.frameCount * 0.3) * 0.5 + 0.5;
    p.stroke(255, 100, 255, borderPulse * 100 * streakIntensity);
    p.strokeWeight(4);
    p.noFill();
    p.rect(5, 5, p.width - 10, p.height - 10);

    for (let i = 0; i < gameState.killStreak && i < 15; i++) {
      const orbX = 50 + (i % 5) * 40;
      const orbY = 50 + p.floor(i / 5) * 30;
      const orbPulse = p.sin(p.frameCount * 0.1 + i) * 0.5 + 0.5;
      p.fill(255, 100, 255, orbPulse * 150);
      p.noStroke();
      p.ellipse(orbX, orbY, 8 + orbPulse * 4, 8 + orbPulse * 4);
    }
  }
  p.pop();
}

// ─── AuroraWisps ─────────────────────────────────────────────────────────────

/** Base wisp ellipse size before modulation */
const AURORA_WISP_BASE_SIZE = 100;
/** Amplitude of cosine size modulation */
const AURORA_WISP_MODULATION = 35;
/** Phase speed for size oscillation */
const AURORA_PHASE_SPEED = 0.006;

export function drawAuroraWispsLayer(wisps, p, beatClock = null) {
  if (!wisps || !Array.isArray(wisps) || wisps.length === 0) return;
  p.push();
  p.noStroke();
  const auroraBeatPulse = beatClock ? beatClock.getBeatIntensity(6) * 20 : 0;

  for (let i = 0; i < wisps.length; i++) {
    const wisp = wisps[i];
    const wispX = wisp.x;
    const wispY = wisp.y;
    const beatModulation =
      p.sin(p.frameCount * 0.1 + wisp.phase) * auroraBeatPulse;
    const wispSize =
      AURORA_WISP_BASE_SIZE +
      p.cos(p.frameCount * AURORA_PHASE_SPEED + wisp.phase) *
        AURORA_WISP_MODULATION +
      beatModulation;
    const colorPhase = p.frameCount * 0.01 + wisp.phase;

    const r = 138 + p.sin(colorPhase) * 50 + auroraBeatPulse * 0.5;
    const g = 43 + p.cos(colorPhase * 1.3) * 40 + auroraBeatPulse * 0.3;
    const b = 226 + p.sin(colorPhase * 0.7) * 30 + auroraBeatPulse * 0.8;

    const baseAlpha = 15 + auroraBeatPulse * 0.4;
    p.fill(r, g, b, baseAlpha);
    p.ellipse(wispX, wispY, wispSize, wispSize * 0.4);

    p.fill(r * 0.8, g * 0.8, b * 0.8, baseAlpha * 0.5);
    p.ellipse(wispX - 20, wispY, wispSize * 0.7, wispSize * 0.3);
  }
  p.pop();
}

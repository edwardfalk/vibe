let cachedVignette = null;

export function resetBeatPulseCache() {
  if (cachedVignette) {
    cachedVignette.remove();
    cachedVignette = null;
  }
}

export function drawBeatPulseOverlay(p, beatClock, healthOverlayColor) {
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
    if (!cachedVignette || cachedVignette.width !== p.width || cachedVignette.height !== p.height) {
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

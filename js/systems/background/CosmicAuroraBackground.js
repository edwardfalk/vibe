const instanceCache = new WeakMap();

export function drawCosmicAuroraBackgroundLayer(p, beatClock = null) {
  p.push();

  const beatIntensity = beatClock ? beatClock.getBeatIntensity(4) : 0;
  const downbeatIntensity = beatClock ? beatClock.getDownbeatIntensity(3) : 0;

  let cache = instanceCache.get(p);
  if (!cache) {
    cache = {
      aurora: null,
      lastWidth: 0,
      lastHeight: 0,
      overlayR: -1,
      overlayG: -1,
      overlayB: -1,
      overlayA: -1,
    };
    instanceCache.set(p, cache);
  }

  if (
    !cache.aurora ||
    cache.lastWidth !== p.width ||
    cache.lastHeight !== p.height
  ) {
    if (cache.aurora) cache.aurora.remove();
    cache.aurora = p.createGraphics(p.width, p.height);
    cache.lastWidth = p.width;
    cache.lastHeight = p.height;

    const gradientSteps = 8;
    const stepHeight = p.height / gradientSteps;

    for (let i = 0; i < gradientSteps; i++) {
      const inter = i / (gradientSteps - 1);

      let r;
      let g;
      let b;
      if (inter < 0.3) {
        const t = p.map(inter, 0, 0.3, 0, 1);
        r = p.lerp(8, 25, t);
        g = p.lerp(5, 15, t);
        b = p.lerp(20, 45, t);
      } else if (inter < 0.7) {
        const t = p.map(inter, 0.3, 0.7, 0, 1);
        r = p.lerp(25, 20, t);
        g = p.lerp(15, 30, t);
        b = p.lerp(45, 65, t);
      } else {
        const t = p.map(inter, 0.7, 1, 0, 1);
        r = p.lerp(20, 30, t);
        g = p.lerp(30, 20, t);
        b = p.lerp(65, 50, t);
      }

      cache.aurora.fill(r, g, b);
      cache.aurora.noStroke();
      cache.aurora.rect(0, i * stepHeight, p.width, stepHeight + 1);
    }
  }

  p.imageMode(p.CORNER);
  p.image(cache.aurora, 0, 0);

  // Global overlay for dynamic shift and beat intensity (reduces fill-rate overhead)
  const timeShift = p.sin(p.frameCount * 0.005) * 8;
  const rShift = p.constrain(timeShift * 0.5 + beatIntensity * 15, 0, 255);
  const gShift = p.constrain(timeShift * 0.3 + beatIntensity * 10, 0, 255);
  const bShift = p.constrain(timeShift * 0.8 + downbeatIntensity * 20, 0, 255);
  const overlayAlpha = 20 + beatIntensity * 30 + downbeatIntensity * 40;

  // Cache overlay color and skip redundant fill/rect when values are stable
  const threshold = 2;
  if (
    Math.abs(rShift - cache.overlayR) > threshold ||
    Math.abs(gShift - cache.overlayG) > threshold ||
    Math.abs(bShift - cache.overlayB) > threshold ||
    Math.abs(overlayAlpha - cache.overlayA) > threshold
  ) {
    cache.overlayR = rShift;
    cache.overlayG = gShift;
    cache.overlayB = bShift;
    cache.overlayA = overlayAlpha;
  }

  const prevBlendMode = p.drawingContext.globalCompositeOperation;
  p.blendMode(p.BLEND);
  p.fill(cache.overlayR, cache.overlayG, cache.overlayB, cache.overlayA);
  p.noStroke();
  p.rect(0, 0, p.width, p.height);
  p.drawingContext.globalCompositeOperation = prevBlendMode;

  p.pop();
}

export function resetCosmicAuroraCache() {
  // WeakMap handles garbage collection based on p5 instance lifecycle
}

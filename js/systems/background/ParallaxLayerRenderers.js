export function drawDistantStarsLayer(stars, p, beatClock = null) {
  const beatBoost = beatClock ? beatClock.getBeatIntensity(10) * 80 : 0;

  p.noStroke();
  for (const star of stars) {
    const twinkle = p.sin(p.frameCount * star.twinkleSpeed) * 0.5 + 0.5;
    const alpha = Math.min(255, star.brightness * twinkle * 255 + beatBoost);

    p.fill(255, 255, 255, alpha);
    p.ellipse(star.x, star.y, star.size, star.size);
  }
}

export function drawNebulaCloudLayer(clouds, p, beatClock = null) {
  const beatPulse = beatClock ? beatClock.getBeatIntensity(6) : 0;

  p.noStroke();
  for (const cloud of clouds) {
    const drift = p.sin(p.frameCount * cloud.driftSpeed) * 20;
    const boost = beatPulse * 0.7;
    const r = Math.min(255, cloud.color.r + boost * 60);
    const g = Math.min(255, cloud.color.g + boost * 30);
    const b = Math.min(255, cloud.color.b + boost * 80);
    const alpha = Math.min(255, cloud.alpha * 255 * (1 + boost * 2.5));

    p.fill(r, g, b, alpha);
    p.ellipse(cloud.x + drift, cloud.y, cloud.size, cloud.size * 0.6);
  }
}

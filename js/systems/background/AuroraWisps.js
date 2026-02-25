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

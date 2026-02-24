export function drawAuroraWisps(p, beatClock = null) {
  const auroraBeatPulse = beatClock ? beatClock.getBeatIntensity(6) * 20 : 0;

  for (let i = 0; i < 8; i++) {
    const wispX = ((i * 127 + p.frameCount * 0.08) % (p.width + 100)) - 50;
    const wispY = (i * 179) % p.height;
    const beatModulation = p.sin(p.frameCount * 0.1 + i) * auroraBeatPulse;
    const wispSize =
      100 + p.cos(p.frameCount * 0.006 + i) * 35 + beatModulation;
    const colorPhase = p.frameCount * 0.01 + i;

    const r = 138 + p.sin(colorPhase) * 50 + auroraBeatPulse * 0.5;
    const g = 43 + p.cos(colorPhase * 1.3) * 40 + auroraBeatPulse * 0.3;
    const b = 226 + p.sin(colorPhase * 0.7) * 30 + auroraBeatPulse * 0.8;

    const baseAlpha = 15 + auroraBeatPulse * 0.4;
    p.fill(r, g, b, baseAlpha);
    p.ellipse(wispX, wispY, wispSize, wispSize * 0.4);

    p.fill(r * 0.8, g * 0.8, b * 0.8, baseAlpha * 0.5);
    p.ellipse(wispX - 20, wispY, wispSize * 0.7, wispSize * 0.3);
  }
}

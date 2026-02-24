export function drawCosmicAuroraBackgroundLayer(p, beatClock = null) {
  p.push();

  const beatIntensity = beatClock ? beatClock.getBeatIntensity(4) : 0;
  const downbeatIntensity = beatClock ? beatClock.getDownbeatIntensity(3) : 0;
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
      b += downbeatIntensity * 20;
      g += beatIntensity * 10;
    } else {
      const t = p.map(inter, 0.7, 1, 0, 1);
      r = p.lerp(20, 30, t);
      g = p.lerp(30, 20, t);
      b = p.lerp(65, 50, t);
      r += beatIntensity * 15;
      b += beatIntensity * 10;
    }

    const timeShift = p.sin(p.frameCount * 0.005 + inter) * 8;
    r += timeShift * 0.5;
    g += timeShift * 0.3;
    b += timeShift * 0.8;

    p.fill(r, g, b);
    p.noStroke();
    p.rect(0, i * stepHeight, p.width, stepHeight + 1);
  }

  p.pop();
}

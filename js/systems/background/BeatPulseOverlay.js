export function drawBeatPulseOverlay(p, beatClock) {
  if (!beatClock) return;

  const phase = beatClock.getBeatPhase();
  const intensity = beatClock.getBeatIntensity(8);
  const currentBeat = beatClock.getCurrentBeat();
  const isDownbeat = currentBeat === 0;

  // 1. Screen flash overlay — warm white on downbeat, purple on others
  const flashAlpha = isDownbeat ? intensity * 45 : intensity * 18;
  if (flashAlpha > 1) {
    if (isDownbeat) {
      p.fill(200, 180, 255, flashAlpha);
    } else {
      p.fill(138, 43, 226, flashAlpha);
    }
    p.noStroke();
    p.rect(0, 0, p.width, p.height);
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

  // 3. Vignette pulse — edges darken briefly on beat for "breathing" feel
  const vigAlpha = intensity * 0.12;
  if (vigAlpha > 0.005) {
    const ctx2d = p.drawingContext;
    ctx2d.save();
    const grad = ctx2d.createRadialGradient(
      p.width / 2,
      p.height / 2,
      p.width * 0.25,
      p.width / 2,
      p.height / 2,
      p.width * 0.72
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(20,10,40,${vigAlpha})`);
    ctx2d.fillStyle = grad;
    ctx2d.fillRect(0, 0, p.width, p.height);
    ctx2d.restore();
  }
}

import { randomRange } from '../mathUtils.js';

const FADE_OUT_DURATION_FRAMES = 30;

export function updateActiveTexts(activeTexts) {
  for (let i = activeTexts.length - 1; i >= 0; i--) {
    const textObj = activeTexts[i];
    textObj.timer--;

    if (textObj.entity) {
      textObj.x = textObj.entity.x;
      textObj.y = textObj.entity.y - 30;
    }

    if (textObj.shakeTimer > 0) textObj.shakeTimer--;
    if (textObj.wobbleTimer > 0) textObj.wobbleTimer--;

    if (textObj.timer <= 0) {
      activeTexts.splice(i, 1);
    }
  }
}

export function drawActiveTexts(
  p,
  activeTexts,
  showBeatIndicator,
  beatX,
  beatY,
  drawGlowFn
) {
  p.push();
  p.textAlign(p.CENTER, p.CENTER);

  for (const textObj of activeTexts) {
    const alpha =
      textObj.timer <= FADE_OUT_DURATION_FRAMES
        ? (textObj.timer / FADE_OUT_DURATION_FRAMES) * 255
        : 255;
    const clampedAlpha = Math.max(0, Math.min(255, alpha));

    const isPlayer = textObj.voiceType === 'player';
    let textColor = [255, 255, 255];
    let textSizeValue = 10;
    let strokeWeightValue = 2;

    if (isPlayer) {
      textColor = [255, 255, 0];
      textSizeValue = 11;
    } else if (textObj.isAggressive) {
      strokeWeightValue = 3;
    }

    p.textSize(textSizeValue);
    let screenX = textObj.x;
    let screenY = textObj.y;

    if (textObj.shakeTimer > 0) {
      screenX += randomRange(-2, 2);
      screenY += randomRange(-1, 1);
    }

    if (textObj.wobbleTimer > 0) {
      const wobble = p.sin(p.frameCount * 0.3) * 1.5;
      screenX += wobble;
      screenY += p.sin(p.frameCount * 0.2) * 0.8;
    }

    p.stroke(0, 0, 0, clampedAlpha);
    p.strokeWeight(strokeWeightValue);
    p.fill(textColor[0], textColor[1], textColor[2], clampedAlpha);
    p.text(textObj.text, screenX, screenY);
  }

  if (showBeatIndicator && typeof drawGlowFn === 'function') {
    drawGlowFn(p, beatX, beatY, 40, p.color(255, 255, 100), 0.5);
  }

  p.pop();
}

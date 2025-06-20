import EffectsProfiler from './EffectsProfiler.js';
import { effectsConfig } from './effectsConfig.js';

// Simple singleton overlay – toggled via ProfilerOverlay.toggle()
class ProfilerOverlay {
  constructor() {
    this.visible = false;
  }

  toggle() {
    this.visible = !this.visible;
  }

  draw(p) {
    if (!this.visible) return;
    const stats = EffectsProfiler.getStats();
    if (!stats || !stats.fps) return;

    p.push();
    p.textFont('monospace');
    p.textAlign(p.LEFT, p.TOP);
    p.textSize(12);

    const pad = 6;
    const lineHeight = 14;
    let boxHeight = lineHeight * 7; // base lines (fps + LOD)
    const counterKeys = Object.keys(stats.counters);
    const maxCountersToShow = 4;
    boxHeight += Math.min(counterKeys.length, maxCountersToShow) * lineHeight;

    const boxWidth = 180;

    // Background rect
    p.noStroke();
    p.fill(0, 0, 0, 140);
    p.rect(pad, pad, boxWidth, boxHeight, 4);

    // Text
    p.fill(0, 255, 0);
    let y = pad + 2;
    p.text(`FPS   : ${stats.fps}`, pad + 4, y);
    y += lineHeight;
    p.text(`avg ms: ${stats.avg}`, pad + 4, y);
    y += lineHeight;
    p.text(`min ms: ${stats.min}`, pad + 4, y);
    y += lineHeight;
    p.text(`max ms: ${stats.max}`, pad + 4, y);
    y += lineHeight;
    p.text(`LOD  : ${effectsConfig.global.lodMultiplier.toFixed(2)}`, pad + 4, y);

    // Counters
    y += lineHeight / 2;
    p.text('burst counts:', pad + 4, y);
    y += lineHeight;

    const entries = counterKeys.slice(0, maxCountersToShow);
    for (const key of entries) {
      p.text(`${key}: ${stats.counters[key]}`, pad + 4, y);
      y += lineHeight;
    }

    p.pop();
  }
}

const overlay = new ProfilerOverlay();
export default overlay; 
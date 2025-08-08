import EffectsProfiler from './EffectsProfiler.js';
import { min } from '@vibe/core';
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
    let boxHeight = lineHeight * 11; // more lines for subsystem timings
    const counterKeys = Object.keys(stats.counters);
    const maxCountersToShow = 4;
    boxHeight += min(counterKeys.length, maxCountersToShow) * lineHeight;

    const boxWidth = 220;

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
    p.text(
      `LOD  : ${effectsConfig.global.lodMultiplier.toFixed(2)}`,
      pad + 4,
      y
    );
    y += lineHeight;

    // Subsystem timings (averaged over last N frames)
    const timings = stats.counters;
    p.fill(255, 255, 0);
    p.text('Subsystem timings (ms):', pad + 4, y);
    y += lineHeight;
    const subsystems = [
      'enemy-update-draw',
      'bullet-update-draw',
      'vfx-draw',
      'collision-check',
    ];
    for (const key of subsystems) {
      if (timings[key]) {
        p.text(
          `${key}: ${timings[key].toFixed ? timings[key].toFixed(2) : timings[key]}`,
          pad + 8,
          y
        );
        y += lineHeight;
      }
    }

    // Counters
    p.fill(0, 255, 0);
    y += lineHeight / 2;
    p.text('burst counts:', pad + 4, y);
    y += lineHeight;

    const entries = counterKeys.slice(0, min(counterKeys.length, maxCountersToShow));
    for (const key of entries) {
      p.text(`${key}: ${stats.counters[key]}`, pad + 4, y);
      y += lineHeight;
    }

    p.pop();
  }
}

const overlay = new ProfilerOverlay();
export default overlay;

import { vi } from 'vitest';

// The p5 surface enemy logic touches outside draw(); the unit tests never draw
export function createMockP5() {
  return {
    color: vi.fn(() => ({ levels: [255, 255, 255, 255] })),
    TWO_PI: Math.PI * 2,
    PI: Math.PI,
    frameCount: 1,
    dist: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
    sin: Math.sin,
    cos: Math.cos,
  };
}

export function createMockAudio() {
  return {
    speak: vi.fn(() => true),
    playSound: vi.fn(),
  };
}

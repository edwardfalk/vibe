import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Ambient drone', () => {
  it('Audio should expose startDrone() and stopDrone() methods', async () => {
    const { Audio } = await import('../../js/Audio.js');
    expect(typeof Audio.prototype.startDrone).toBe('function');
    expect(typeof Audio.prototype.stopDrone).toBe('function');
  });

  it('Audio should expose duckDrone() for tank sub-bass ducking', async () => {
    const { Audio } = await import('../../js/Audio.js');
    expect(typeof Audio.prototype.duckDrone).toBe('function');
  });
});

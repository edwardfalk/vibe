import { describe, it, expect, beforeEach } from 'vitest';
import { Player } from '../../js/entities/player.js';

const p = {
  color: () => ({}),
  keyIsDown: () => false,
  constrain: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
  cos: Math.cos,
  sin: Math.sin,
  mouseX: 0,
  mouseY: 0,
};

describe('Player held fire', () => {
  beforeEach(() => {
    globalThis.window = { playerIsShooting: true };
  });

  it('fires once when the eighth-note window opens before a queued shot is due', () => {
    let onEighth = false;
    const playerBullets = [];
    const beatClock = {
      isOnEighthNote: () => onEighth,
      getTimeToNextEighthNote: () => 30,
    };
    const player = new Player(p, 100, 100, null, { playerBullets, beatClock });
    let fired = 0;
    const fire = player.fireBullet.bind(player);
    player.fireBullet = () => (fired++, fire());

    player.shoot(); // first shot: immediate
    player.update(250); // cooldown over
    player.shoot(); // off the grid: queues a shot 30 ms ahead
    expect(fired).toBe(1);

    onEighth = true; // 16 ms later, inside the window before the note
    player.update(16);
    player.shoot(); // on-grid shot fires now
    player.update(16); // the queued shot comes due on this frame
    expect(fired).toBe(2);
  });
});

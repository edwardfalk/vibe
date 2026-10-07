import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Player } from '../../js/entities/player.js';
import { CONFIG } from '../../js/config.js';
import {
  heroMuzzle,
  heroShoulder,
  PROTO_SIZE,
  FEET_Y,
  CRACK_AHEAD,
} from '../../js/entities/PlayerRenderer.js';

const MS_PER_BEAT = 500;
const FRAME_MS = 16;
const KEY = { W: 87, A: 65, S: 83, D: 68 };
const KICK_DEFAULTS = { ...CONFIG.BEAT_TRACK.KICK };
const LOOK_DEFAULTS = { ...CONFIG.PLAYER_LOOK };

// A hero at (0, 0) on a clock we set by hand (beats), with the keys in
// `held` down and the mouse (no camera: world coordinates) at `mouse`
function hero() {
  const held = new Set();
  const mouse = { x: 300, y: 0 };
  const clock = {
    beats: 4,
    beatInterval: MS_PER_BEAT,
    getBeatPosition() {
      return this.beats;
    },
    isOnBeat: () => true,
  };
  const p = {
    color: () => ({}),
    keyIsDown: (code) => held.has(code),
    constrain: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
    cos: Math.cos,
    sin: Math.sin,
    get mouseX() {
      return mouse.x;
    },
    get mouseY() {
      return mouse.y;
    },
  };
  const beatTrack = {
    isPlaying: true,
    ctx: { state: 'running', baseLatency: 0, outputLatency: 0 },
  };
  const audio = { playSound: vi.fn(), speakPlayerLine: vi.fn() };
  const gameState = { gameState: 'playing', resetKillStreak: vi.fn() };
  const context = {
    playerBullets: [],
    audio,
    gameState,
    beatClock: clock,
    beatTrack,
  };
  const player = new Player(p, 0, 0, null, context);
  player.update(0); // keeps the clock's beat position
  // Update every frame from the clock's beats up to `to`
  const run = (to) => {
    while (clock.beats < to) {
      clock.beats = Math.min(to, clock.beats + FRAME_MS / MS_PER_BEAT);
      player.update(FRAME_MS);
    }
  };
  return { player, clock, held, mouse, beatTrack, run };
}

describe('the hero’s state for his look', () => {
  beforeEach(() => {
    globalThis.window = { playerIsShooting: false };
  });
  afterEach(() => {
    Object.assign(CONFIG.BEAT_TRACK.KICK, KICK_DEFAULTS);
    Object.assign(CONFIG.PLAYER_LOOK, LOOK_DEFAULTS);
  });

  it('records a footfall on each new eighth he walks into, the feet by the eighth’s parity', () => {
    const { player, held, run } = hero();
    held.add(KEY.D);
    run(4.01); // sets off mid-eighth: no footfall yet
    expect(player.footfalls).toEqual([]);
    run(4.6);
    expect(player.footfalls.map((f) => f.at)).toEqual([4.5]);
    run(5.6);
    expect(player.footfalls.map((f) => f.at)).toEqual([4.5, 5, 5.5]);
    expect(player.footfalls.map((f) => f.foot)).toEqual([1, 0, 1]);
    run(6.6); // he keeps the last three
    expect(player.footfalls.map((f) => f.at)).toEqual([5.5, 6, 6.5]);
  });

  it('records one footfall when the clock jumps several eighths', () => {
    const { player, clock, held, run } = hero();
    held.add(KEY.D);
    run(4.1);
    clock.beats = 6.2; // a stall: four eighths at once
    player.update(FRAME_MS);
    expect(player.footfalls.map((f) => f.at)).toEqual([6]);
  });

  it('records no footfall standing, or when only a knockback moves him', () => {
    const { player, run } = hero();
    run(5);
    player.knockBack(-100, 0, 8);
    run(6);
    expect(player.x).toBeGreaterThan(0);
    expect(player.footfalls).toEqual([]);
  });

  it('stores where the crack goes, ahead of him at the facing he had, at his feet', () => {
    const { player, held, mouse, run } = hero();
    CONFIG.PLAYER_LOOK.ART_SCALE = 1.4;
    held.add(KEY.D);
    run(4.5); // the update that lands on 4.5 records it
    const [f] = player.footfalls;
    const k = (player.size * 1.4) / PROTO_SIZE;
    expect(f.x).toBeCloseTo(player.x + CRACK_AHEAD * k, 6);
    expect(f.y).toBeCloseTo(player.y + FEET_Y * k, 6);
    const kept = { ...f };
    mouse.x = -300; // he turns round
    held.clear();
    run(4.9);
    expect(player.facing).toBe(-1);
    expect(player.footfalls[0]).toEqual(kept);
  });

  it('puts the crack ahead of him facing left too', () => {
    const { player, held, mouse, run } = hero();
    mouse.x = -300;
    player.update(FRAME_MS);
    expect(player.facing).toBe(-1);
    held.add(KEY.A);
    run(4.5);
    const [f] = player.footfalls;
    const k = player.drawnSize() / PROTO_SIZE;
    expect(f.x).toBeCloseTo(player.x - CRACK_AHEAD * k, 6);
  });

  it('stamps his shot, a hit to his health and the shield coming back', () => {
    const { player, clock, run } = hero();
    run(4.5);
    player.fireBullet();
    expect(player.shotAt).toBe(4.5);
    expect(player.pose().shatterAge).toBe(Infinity);
    player.takeDamage(10, 'enemy-bullet'); // the shield takes it: no flinch
    expect(player.hurtAt).toBe(null);
    run(5);
    // Its shatter runs on the time it has been down, not on a stamp
    expect(player.pose().shatterAge).toBeCloseTo(player.shieldDownMs / 1000, 6);
    expect(player.pose().shatterAge).toBeGreaterThan(0);
    player.takeDamage(10, 'enemy-bullet');
    expect(player.hurtAt).toBe(5);
    clock.beats = 5 + CONFIG.PLAYER.SHIELD_RECHARGE_MS / MS_PER_BEAT + 1;
    player.update(CONFIG.PLAYER.SHIELD_RECHARGE_MS + FRAME_MS);
    expect(player.shieldUp).toBe(true);
    expect(player.shieldBackAt).toBe(clock.beats);
  });

  it('restamps contact ticks at most every 0.35 s, and every tick still hurts', () => {
    const { player, run } = hero();
    player.shieldUp = false;
    run(4);
    player.takeDamage(1, 'grunt-contact');
    expect(player.hurtAt).toBe(4);
    run(4.4); // 0.2 s later
    player.takeDamage(1, 'grunt-contact');
    expect(player.hurtAt).toBe(4);
    expect(player.health).toBe(98);
    player.takeDamage(5, 'enemy-bullet'); // not contact: always stamps
    expect(player.hurtAt).toBe(4.4);
    run(5.2); // 0.4 s after the bullet
    player.takeDamage(1, 'grunt-contact');
    expect(player.hurtAt).toBe(5.2);
  });

  it('starts a new run clean: stamps from before a clock reset are dropped and never replay', () => {
    const { player, clock, held, run } = hero();
    held.add(KEY.D);
    run(100.6);
    player.fireBullet();
    player.shieldUp = false;
    player.takeDamage(10, 'enemy-bullet');
    expect([player.shotAt, player.hurtAt]).toEqual([100.6, 100.6]);
    expect(player.footfalls.length).toBeGreaterThan(0);
    clock.beats = 0.1; // restart() resets the beat clock
    player.update(FRAME_MS);
    expect([player.shotAt, player.hurtAt]).toEqual([null, null]);
    expect(player.footfalls).toEqual([]);
    held.clear();
    run(100.7); // the new run's clock passes the old stamps
    const look = player.pose();
    expect(look.hurtAge).toBe(Infinity);
    expect(look.shotAge).toBe(Infinity);
    // contact ticks flinch him in the new run
    player.takeDamage(1, 'grunt-contact');
    expect(player.hurtAt).toBe(100.7);
  });

  it('reads the dash’s progress from its own timer, so a hitstop holds it', () => {
    const { player, clock, held, run } = hero();
    held.add(KEY.D);
    run(4);
    expect(player.dash()).toBe(true);
    run(4.2); // 100 ms
    const dash = player.pose().dash;
    expect(dash).toBeCloseTo(player.dashTimerMs / player.maxDashTimeMs, 6);
    clock.beats += 0.2; // a hitstop: the clock runs, update() doesn't
    expect(player.pose().dash).toBe(dash);
  });

  it('leaves no cracks during the dash’s leap', () => {
    const { player, held, run } = hero();
    held.add(KEY.D);
    expect(player.dash()).toBe(true);
    run(4.52); // past an eighth, 272 ms in: still leaping
    expect(player.isDashing).toBe(true);
    expect(player.footfalls).toEqual([]);
  });

  it('hands the drawing his stride, his facing, his hits and his shield', () => {
    const { player, held, mouse, run } = hero();
    held.add(KEY.D);
    run(4.25); // walking right, halfway through an eighth
    let look = player.pose();
    expect([look.moving, look.back, look.stepFoot, look.stepPhase]).toEqual([
      true,
      false,
      0,
      0.5,
    ]);
    mouse.x = -300; // he faces left, still walking right: backing off
    run(4.75);
    look = player.pose();
    expect([look.side, look.back, look.stepFoot, look.stepPhase]).toEqual([
      -1,
      true,
      1,
      0.5,
    ]);
    player.takeDamage(10, 'enemy-bullet'); // the shield takes it
    player.takeDamage(40, 'enemy-bullet');
    player.fireBullet();
    run(4.85);
    look = player.pose();
    expect([look.shield, look.hp, look.firing]).toEqual([false, 0.6, true]);
    expect(look.hurtAge).toBeCloseTo(0.05, 6);
    expect(look.shotAge).toBeCloseTo(0.05, 6);
    expect(look.footfalls.at(-1).age).toBeCloseTo(0.175, 6); // landed on 4.5
  });

  it('holds his pose while paused: update() is what moves it', () => {
    const { player, clock, held, run } = hero();
    held.add(KEY.D);
    run(4.3);
    const before = player.pose();
    clock.beats += 1.3; // paused: no update()
    const after = player.pose();
    expect(after.stepPhase).toBe(before.stepPhase);
    expect(after.stepFoot).toBe(before.stepFoot);
    expect(player.footfalls).toEqual([]);
  });

  it('turns round only past FLIP_COS, and holds his facing inside it', () => {
    const { player, mouse, run } = hero();
    const aimAt = (deg) => {
      const a = (deg * Math.PI) / 180;
      mouse.x = Math.cos(a) * 300;
      mouse.y = Math.sin(a) * 300;
      run(player.poseBeats + 0.05);
    };
    const flip = (Math.acos(-CONFIG.PLAYER_LOOK.FLIP_COS) * 180) / Math.PI;
    aimAt(0);
    expect(player.facing).toBe(1);
    aimAt(flip - 3); // past straight up, inside the dead zone
    expect(player.facing).toBe(1);
    aimAt(flip + 3);
    expect(player.facing).toBe(-1);
    aimAt(180 - flip + 3); // back inside it
    expect(player.facing).toBe(-1);
  });

  it('pulses on the kick he hears, not on a beat the kick skips', () => {
    const { player, clock } = hero();
    clock.beats = 5.05; // just after the kick on beat 2
    player.update(FRAME_MS);
    expect(player.pose().kick).toBeGreaterThan(0.5);
    CONFIG.BEAT_TRACK.KICK.PATTERN = 'oneThree';
    clock.beats = 7.05; // beat 4: oneThree plays no kick there
    player.update(FRAME_MS);
    expect(player.pose().kick).toBeLessThan(0.05); // beat 3's, a beat gone
    CONFIG.BEAT_TRACK.KICK.ENABLED = false;
    clock.beats = 4.05;
    player.update(FRAME_MS);
    expect(player.pose().kick).toBe(0);
    expect(player.pose().beat).toBeGreaterThan(0.5); // his nod still moves
  });

  it('pulses on beat 1 only for the glint', () => {
    const { player, clock } = hero();
    clock.beats = 4.05; // beat 1
    player.update(FRAME_MS);
    expect(player.pose().downbeatKick).toBeGreaterThan(0.5);
    clock.beats = 5.05;
    player.update(FRAME_MS);
    expect(player.pose().downbeatKick).toBe(0);
  });

  it('stands still in his pose without a beat clock, keys or not', () => {
    for (const clock of [null, { isOnBeat: () => true, beatInterval: 500 }]) {
      const { player, held } = hero();
      player.context.beatClock = clock; // none, or one like PlayerShield.test's
      held.add(KEY.D);
      player.update(FRAME_MS);
      const look = player.pose();
      expect(player.x).toBeGreaterThan(0); // he still moves
      expect(look.moving).toBe(false);
      expect([look.stepPhase, look.kick, look.beat]).toEqual([0, 0, 0]);
      expect(look.hurtAge).toBe(Infinity);
      expect(player.footfalls).toEqual([]);
    }
  });
});

describe('his muzzle', () => {
  const s = PROTO_SIZE * 1.4;
  const k = s / PROTO_SIZE;
  it('is the shoulder plus the gun’s reach, mirrored with his facing', () => {
    for (const facing of [1, -1]) {
      const sh = heroShoulder(10, 20, facing, s);
      expect(sh).toEqual({ x: 10 + facing * 2.4 * k, y: 20 - 7 * k });
      // Aiming level, the muzzle is 24 px out and 1 px up the gun's top
      const level = heroMuzzle(10, 20, facing > 0 ? 0 : Math.PI, facing, s);
      expect(level.x).toBeCloseTo(sh.x + facing * 24 * k, 6);
      expect(level.y).toBeCloseTo(sh.y - 1 * k, 6);
      // Aiming straight down, the gun's top faces his front
      const down = heroMuzzle(10, 20, Math.PI / 2, facing, s);
      expect(down.x).toBeCloseTo(sh.x + facing * 1 * k, 6);
      expect(down.y).toBeCloseTo(sh.y + 24 * k, 6);
    }
  });
});

describe('his pose at a given beat', () => {
  it('takes his kick from that beat: his death scene runs on after update() stops', () => {
    const { player, run } = hero();
    run(10.6); // update() keeps 10.6
    expect(player.pose().kickAge).toBeCloseTo(0.3, 9); // the kick on 10
    expect(player.poseAt(12.05).kickAge).toBeCloseTo(0.025, 9); // the kick on 12
  });
});

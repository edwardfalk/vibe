import { describe, it, expect, vi, afterEach } from 'vitest';
import { createMockP5, createMockAudio } from './helpers/enemyMocks.js';
import { Tank } from '../../js/entities/Tank.js';
import { Stabber } from '../../js/entities/Stabber.js';
import { BeatClock } from '../../js/audio/BeatClock.js';
import { updateStabberBehavior } from '../../js/entities/StabberAttackHandler.js';

// A real BeatClock on a fake audio clock, plus a context the entities read
function world() {
  const ctx = { currentTime: 0 };
  const clock = new BeatClock(120, ctx);
  const audio = createMockAudio();
  const context = {
    get: (k) =>
      k === 'audio'
        ? audio
        : k === 'beatClock'
          ? clock
          : k === 'enemies'
            ? []
            : null,
    set() {},
  };
  const at = (ms) => {
    ctx.currentTime = ms / 1000;
    clock.update(true);
  };
  return { clock, audio, context, at };
}

describe('Beat-gated entity behaviour', () => {
  afterEach(() => vi.restoreAllMocks());

  it('tank charge-up sound plays once per beat 1, however many frames the window spans', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // every roll succeeds
    const { audio, context, at } = world();
    const t = new Tank(100, 100, 'tank', { context }, createMockP5(), audio);
    t.isSpawning = false;
    t.spawnTimer = t.spawnDuration;
    t.chargingShot = true;
    t.chargeStartBeat = 0;
    t.chargeDurationBeats = 99;
    for (let ms = 4000; ms < 4120; ms += 10) {
      at(ms); // ~12 frames across beat 1's window
      t.updateSpecificBehavior(700, 100, 10);
    }
    const power = audio.playSound.mock.calls.filter(([n]) => n === 'tankPower');
    expect(power.length).toBe(1);
  });

  it('stabber warns on beat 3 and dashes on the off-beat 3.5', () => {
    const { clock, audio, context, at } = world();
    const s = new Stabber(
      100,
      100,
      'stabber',
      { context },
      createMockP5(),
      audio
    );
    s.isSpawning = false;
    s.spawnTimer = s.spawnDuration;
    s.stabPreparing = true;
    s.stabPreparingTime = 30; // minimum prep already done
    let dashAt = null;
    for (let ms = 2600; ms < 4600 && dashAt === null; ms += 16) {
      at(ms); // from beat 2 of bar 2
      updateStabberBehavior(s, 400, 100, 16);
      if (s.isStabbing) dashAt = ms % 2000;
    }
    expect(dashAt).toBeGreaterThanOrEqual(1250);
    expect(dashAt).toBeLessThanOrEqual(1250 + clock.tolerance + 16);
  });

  it('stabber chatter keeps its old rate: gate open 250 of 2000 ms x 0.2', () => {
    const cfg = Object.create(Stabber.prototype).getAmbientSpeechConfig();
    expect(cfg.chance).toBeCloseTo((250 / 2000) * 0.2, 5);
  });

  it('tank says CHARGING! at charge start and FIRE! 8 beats later, both clear of the speech cooldown', () => {
    const { audio, context, at } = world();
    // Record when each line is said: every tank line must clear the 2.5 s
    // cooldown all voices share (Audio.js), or the next one is dropped
    let now = 0;
    const said = [];
    audio.speak.mockImplementation(
      (_e, line) => (said.push({ line, now }), true)
    );
    const t = new Tank(100, 100, 'tank', { context }, createMockP5(), audio);
    t.isSpawning = false;
    t.spawnTimer = t.spawnDuration;
    t._lastTankFireBeat = -100;
    for (now = 4000; now <= 8000; now += 1000) {
      at(now); // beat 1 of bar 3 (charge starts), then every beat 1 and 3
      t.updateSpecificBehavior(300, 100, 16);
    }
    expect(said.map((s) => s.line)).toEqual(['CHARGING!', 'FIRE!']);
    expect(audio.playSound).toHaveBeenCalledWith('tankCharging', 100, 100);
    expect(audio.playSound).toHaveBeenCalledWith('tankPowerUp', 100, 100);
    for (let i = 1; i < said.length; i++) {
      expect(said[i].now - said[i - 1].now).toBeGreaterThanOrEqual(2500);
    }
  });

  it("tank's shot layers a nuclear boom and an electric zap", async () => {
    const { AMBIENT_SOUNDS } =
      await import('../../js/audio/AmbientSoundProfile.js');
    const { audio, context } = world();
    const t = new Tank(100, 100, 'tank', { context }, createMockP5(), audio);
    t.createBullet();
    const played = audio.playSound.mock.calls.map(([name]) => name);
    expect(played).toEqual(['tankEnergy', 'tankZap', 'tankArc']);
    expect(AMBIENT_SOUNDS.has('tankEnergy')).toBe(true); // reverb tail
  });

  it('tank tones are not pure sines (inaudible on laptop speakers)', async () => {
    const { SOUND_CONFIG } = await import('../../js/audio/SoundConfig.js');
    for (const name of [
      'tankEnergy',
      'tankCharging',
      'tankPower',
      'tankPowerUp',
      'tankHit',
      'tankResponse',
    ]) {
      expect(SOUND_CONFIG[name].waveform, name).not.toBe('sine');
    }
  });

  it('tank armour comes from CONFIG.TANK_ARMOR (tunable live)', async () => {
    const { CONFIG } = await import('../../js/config.js');
    const saved = { ...CONFIG.TANK_ARMOR };
    CONFIG.TANK_ARMOR = { FRONT: 7, SIDE: 3 };
    try {
      const { audio, context } = world();
      const t = new Tank(100, 100, 'tank', { context }, createMockP5(), audio);
      expect([t.plates.front.hp, t.plates.left.hp, t.plates.right.hp]).toEqual([
        7, 3, 3,
      ]);
    } finally {
      CONFIG.TANK_ARMOR = saved;
    }
  });
});

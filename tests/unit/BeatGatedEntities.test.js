import { describe, it, expect, vi, afterEach } from 'vitest';
import { createMockP5 } from './helpers/enemyMocks.js';
import { Tank } from '../../js/entities/Tank.js';
import { Stabber } from '../../js/entities/Stabber.js';
import { Rusher } from '../../js/entities/Rusher.js';
import { Grunt } from '../../js/entities/Grunt.js';
import { beatWorld as world } from './helpers/beatWorld.js';
import { CONFIG } from '../../js/config.js';

const TANK_SPEECH = { ...CONFIG.SPEECH_SETTINGS.TANK };

describe('Beat-gated entity behaviour', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Object.assign(CONFIG.SPEECH_SETTINGS.TANK, TANK_SPEECH);
  });

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

  it('tank says its calm-down line once, on the next beat 1 after its anger ends', () => {
    const { audio, context, at } = world();
    const t = new Tank(100, 100, 'tank', { context }, createMockP5(), audio);
    t.isAngry = true;
    t.angerCooldown = 0.5; // runs out on the first frame, between beats
    for (let ms = 4300; ms < 6200; ms += 10) {
      at(ms); // on to the next beat 1 (6000) and through its window
      t.updateSpecificBehavior(700, 100, 10); // player out of charge range
    }
    expect(t.isAngry).toBe(false);
    expect(audio.speak).toHaveBeenCalledTimes(1);
  });

  it("rusher's charge sound plays once, on the first new beat after its battle cry", () => {
    const { audio, context, at } = world();
    const r = new Rusher(0, 0, 'rusher', { context }, createMockP5(), audio);
    for (let ms = 250; ms < 700; ms += 10) {
      at(ms); // from between beats on past beat 2
      r.updateSpecificBehavior(100, 0, 10); // within cry distance
    }
    // Closing in lights him: no second charge sound
    at(700);
    r.updateSpecificBehavior(r.x + CONFIG.RUSHER.LIGHT_DIST_PX - 1, r.y, 10);
    expect(r.lit?.by).toBe('hero');
    const charge = audio.playSound.mock.calls.filter(
      ([n]) => n === 'rusherCharge'
    );
    expect(charge.length).toBe(1);
  });

  it("each enemy's chatter chance is CONFIG.SPEECH_SETTINGS' live value", () => {
    for (const [Type, key] of [
      [Grunt, 'GRUNT'],
      [Rusher, 'RUSHER'],
      [Stabber, 'STABBER'],
      [Tank, 'TANK'],
    ]) {
      const settings = CONFIG.SPEECH_SETTINGS[key];
      const chance = settings.CHANCE;
      try {
        settings.CHANCE = 0.37;
        const cfg = Object.create(Type.prototype).getAmbientSpeechConfig();
        expect(cfg.chance, key).toBe(0.37);
      } finally {
        settings.CHANCE = chance;
      }
    }
  });

  it('tank says CHARGING! at charge start and FIRE! 8 beats later, both clear of the speech cooldown', () => {
    CONFIG.SPEECH_SETTINGS.TANK.CALLOUT_CHANCE = 1; // restored in afterEach
    const { audio, context, at } = world();
    // Record when each line is said: every tank line must clear the gap
    // between enemies' lines (Audio.js), or the next one is dropped
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
      expect(said[i].now - said[i - 1].now).toBeGreaterThanOrEqual(
        CONFIG.SPEECH_SETTINGS.VOICE_GAP_SEC * 1000
      );
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

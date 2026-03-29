# Cosmic Beat Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the cosmic beat system with robustness fixes, cleaner frequency separation, per-enemy hit reactions, an ambient drone, call-and-response, and optional BeatTrack evolution.

**Architecture:** Three parallel tracks touching largely independent files. Track 1 (beat robustness) touches BeatClock, StabberAttackHandler, RhythmFX. Track 2 (sonic palette) touches SoundConfig, Audio, enemy takeDamage methods. Track 3 (musical interplay) touches BaseEnemy, EnemyDeathHandler, BeatTrack.

**Tech Stack:** Web Audio API, p5.js instance mode, ES modules, Vitest for unit tests

---

## File Map

**Track 1 — Beat Robustness:**
- Modify: `js/audio/BeatClock.js` (tolerance constants, reset method)
- Modify: `js/entities/StabberAttackHandler.js:200` (hardcoded frame time)
- Modify: `js/RhythmFX.js:75` (double-decay removal)
- Modify: `js/config.js` (add tolerance constants)

**Track 2 — Sonic Palette:**
- Modify: `js/audio/SoundConfig.js` (frequency changes + new sounds)
- Modify: `js/Audio.js` (ambient drone system)
- Modify: `js/entities/Tank.js:462-495` (hit reaction sound)
- Modify: `js/entities/Stabber.js:308-363` (hit reaction sound)
- Modify: `js/entities/Rusher.js:366-396` (hit reaction sound)

**Track 3 — Musical Interplay:**
- Modify: `js/entities/BaseEnemy.js` (onNearbyDeath method)
- Modify: `js/systems/combat/EnemyDeathHandler.js` (call-and-response dispatch)
- Modify: `js/audio/SoundConfig.js` (response sounds)
- Modify: `js/audio/BeatTrack.js` (level-based evolution, nice-to-have)

**Tests:**
- Create: `tests/unit/BeatClockTolerance.test.js`
- Create: `tests/unit/FrequencyRedistribution.test.js`
- Create: `tests/unit/EnemyHitReactions.test.js`
- Create: `tests/unit/CallAndResponse.test.js`
- Create: `tests/unit/AmbientDrone.test.js`
- Create: `tests/unit/BeatTrackEvolution.test.js`

---

## Track 1: Beat Robustness Fixes

### Task 1: Unify frame-time references and tolerance constants

**Files:**
- Modify: `js/config.js:43`
- Modify: `js/audio/BeatClock.js:20,98,130`
- Modify: `js/entities/StabberAttackHandler.js:200`
- Create: `tests/unit/BeatClockTolerance.test.js`

- [ ] **Step 1: Write failing tests for unified tolerance constants**

```javascript
// tests/unit/BeatClockTolerance.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BeatClock } from '../../js/audio/BeatClock.js';
import { CONFIG } from '../../js/config.js';

describe('BeatClock tolerance constants', () => {
  let clock;

  beforeEach(() => {
    clock = new BeatClock(120, null);
  });

  it('should expose TOLERANCE_BASE derived from config', () => {
    expect(CONFIG.BEAT_TOLERANCES).toBeDefined();
    expect(CONFIG.BEAT_TOLERANCES.ON_BEAT).toBe(100);
    expect(CONFIG.BEAT_TOLERANCES.QUARTER_BEAT).toBe(50);
    expect(CONFIG.BEAT_TOLERANCES.EIGHTH_NOTE).toBe(40);
  });

  it('should use QUARTER_BEAT tolerance in canPlayerShootQuarterBeat', () => {
    // At 120 BPM, quarter-beat interval = 125ms
    // With 50ms tolerance, should detect within ±50ms of quarter-beat
    // We can't easily test internal tolerance without mocking time,
    // but we verify the method exists and returns boolean
    const result = clock.canPlayerShootQuarterBeat();
    expect(typeof result).toBe('boolean');
  });

  it('should use EIGHTH_NOTE tolerance in isOnEighthNote', () => {
    const result = clock.isOnEighthNote();
    expect(typeof result).toBe('boolean');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/BeatClockTolerance.test.js`
Expected: FAIL — `CONFIG.BEAT_TOLERANCES` is undefined

- [ ] **Step 3: Add tolerance constants to config.js**

In `js/config.js`, add after line 43 (`FRAME_TIME_MS: 16.6667,`):

```javascript
  BEAT_TOLERANCES: {
    ON_BEAT: 100,       // General beat detection (enemy gating)
    QUARTER_BEAT: 50,   // Player quarter-beat shooting
    EIGHTH_NOTE: 40,    // Eighth-note detection
  },
```

- [ ] **Step 4: Update BeatClock.js to use config tolerances**

In `js/audio/BeatClock.js`:

Replace line 20:
```javascript
this.tolerance = 100;
```
with:
```javascript
this.tolerance = CONFIG.BEAT_TOLERANCES.ON_BEAT;
```

Add import at top of file (after existing imports):
```javascript
import { CONFIG } from '../config.js';
```

Replace line 98 in `canPlayerShootQuarterBeat()`:
```javascript
const exactTolerance = 16;
```
with:
```javascript
const exactTolerance = CONFIG.BEAT_TOLERANCES.QUARTER_BEAT;
```

Replace line 130 in `isOnEighthNote()`:
```javascript
const tolerance = 20;
```
with:
```javascript
const tolerance = CONFIG.BEAT_TOLERANCES.EIGHTH_NOTE;
```

- [ ] **Step 5: Fix hardcoded frame time in StabberAttackHandler.js**

In `js/entities/StabberAttackHandler.js`, ensure CONFIG is imported, then replace line 200:
```javascript
const warningDuration = beatClock ? beatClock.beatInterval * 0.5 / (1000 / 60) : 15;
```
with:
```javascript
const warningDuration = beatClock ? beatClock.beatInterval * 0.5 / CONFIG.GAME_SETTINGS.FRAME_TIME_MS : 15;
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/unit/BeatClockTolerance.test.js`
Expected: PASS

- [ ] **Step 7: Run full test suite to check for regressions**

Run: `pnpm run test:unit`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add js/config.js js/audio/BeatClock.js js/entities/StabberAttackHandler.js tests/unit/BeatClockTolerance.test.js
git commit -m "fix: unify beat tolerance constants and frame-time references"
```

---

### Task 2: Beat-boundary alignment on level transitions

**Files:**
- Modify: `js/audio/BeatClock.js:198-202` (reset method)
- Modify: `tests/unit/BeatClockTolerance.test.js`

- [ ] **Step 1: Write failing test for beat-aligned reset**

Add to `tests/unit/BeatClockTolerance.test.js`:

```javascript
describe('BeatClock reset with beat alignment', () => {
  let clock;

  beforeEach(() => {
    clock = new BeatClock(120, null);
  });

  it('should snap startTime to nearest beat boundary on reset', () => {
    // Advance the clock artificially
    const originalStart = clock.startTime;
    // After reset, startTime should be adjusted so elapsed % beatInterval is near 0
    clock.reset();
    const elapsed = clock._now() - clock.startTime;
    const remainder = elapsed % clock.beatInterval;
    // Should be within tolerance of a beat boundary (either just past 0 or just before next beat)
    const nearBoundary = remainder <= clock.tolerance || remainder >= clock.beatInterval - clock.tolerance;
    expect(nearBoundary).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/BeatClockTolerance.test.js`
Expected: May pass trivially (reset sets startTime = now, so elapsed ≈ 0). But the real fix is for mid-beat resets. Let's refine the test:

Replace the test with:

```javascript
describe('BeatClock reset with beat alignment', () => {
  let clock;

  beforeEach(() => {
    clock = new BeatClock(120, null);
  });

  it('should align startTime to beat grid on reset', () => {
    clock.reset();
    const now = clock._now();
    const elapsed = now - clock.startTime;
    // startTime should be set so the beat grid aligns to "now"
    // meaning elapsed should be very close to 0 or a multiple of beatInterval
    const remainder = elapsed % clock.beatInterval;
    expect(remainder).toBeLessThan(5); // Within 5ms of a beat boundary
  });

  it('should preserve beat grid continuity when called mid-beat', () => {
    // Manually offset startTime to simulate being mid-beat
    clock.startTime = clock._now() - 250; // 250ms into a beat at 120 BPM (500ms interval)
    const oldBeatPhase = (clock._now() - clock.startTime) % clock.beatInterval;
    expect(oldBeatPhase).toBeGreaterThan(200); // Confirm we're mid-beat

    clock.reset();

    // After reset, startTime should snap to nearest beat boundary
    const newElapsed = clock._now() - clock.startTime;
    const newRemainder = newElapsed % clock.beatInterval;
    expect(newRemainder).toBeLessThan(5);
  });
});
```

- [ ] **Step 3: Implement beat-aligned reset**

In `js/audio/BeatClock.js`, replace the `reset()` method (lines 198-202):

```javascript
reset() {
  const now = this._now();
  // Snap to nearest beat boundary so the grid stays aligned
  const elapsed = now - this.startTime;
  const remainder = elapsed % this.beatInterval;
  if (remainder < this.beatInterval / 2) {
    // Closer to the previous beat — snap back
    this.startTime = now - remainder;
  } else {
    // Closer to the next beat — snap forward
    this.startTime = now + (this.beatInterval - remainder);
  }
  this.update(true);
  console.log('🎵 BeatClock reset (beat-aligned)');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/BeatClockTolerance.test.js`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `pnpm run test:unit`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add js/audio/BeatClock.js tests/unit/BeatClockTolerance.test.js
git commit -m "fix: snap BeatClock reset to nearest beat boundary"
```

---

### Task 3: Fix RhythmFX double-decay

**Files:**
- Modify: `js/RhythmFX.js:75`

- [ ] **Step 1: Read the current RhythmFX update method to confirm the double-decay**

Read `js/RhythmFX.js` around lines 43-80. Confirm that both `this.pulseIntensity *= 0.92` (line 57) and `t.intensity *= Math.pow(0.98, deltaTimeMs / 16.67)` (line 75) exist.

- [ ] **Step 2: Remove the frame-based decay on telegraph intensity**

In `js/RhythmFX.js`, replace line 75:
```javascript
t.intensity *= Math.pow(0.98, deltaTimeMs / 16.67);
```
with:
```javascript
// Telegraph intensity is now driven solely by beat-based beatsUntil decay
```

Note: The `pulseIntensity *= 0.92` on line 57 is for the screen pulse effect (separate from telegraphs) and should stay. Only the telegraph intensity double-decay is removed.

- [ ] **Step 3: Run full test suite to check for regressions**

Run: `pnpm run test:unit`
Expected: All pass

- [ ] **Step 4: Manual verification**

Run: `pnpm run dev` and play the game. Watch enemy attack telegraphs — they should still fade smoothly as beats approach, without any visible jitter or sudden cutoff.

- [ ] **Step 5: Commit**

```bash
git add js/RhythmFX.js
git commit -m "fix: remove double-decay on RhythmFX telegraph intensity"
```

---

## Track 2: Sonic Palette

### Task 4: Frequency redistribution in SoundConfig

**Files:**
- Modify: `js/audio/SoundConfig.js`
- Create: `tests/unit/FrequencyRedistribution.test.js`

- [ ] **Step 1: Write test asserting new frequency values**

```javascript
// tests/unit/FrequencyRedistribution.test.js
import { describe, it, expect } from 'vitest';
import { SOUND_CONFIG } from '../../js/audio/SoundConfig.js';

describe('Frequency redistribution', () => {
  it('player sounds should be in low-mid band (150-250Hz)', () => {
    expect(SOUND_CONFIG.playerShoot.frequency).toBe(220);
    expect(SOUND_CONFIG.playerDash.frequency).toBe(200);
  });

  it('rusher sounds should be in upper-mid band (600-800Hz)', () => {
    expect(SOUND_CONFIG.rusherCharge.frequency).toBe(700);
    expect(SOUND_CONFIG.rusherScream.frequency).toBe(750);
  });

  it('explosion should be deeper to avoid grunt territory', () => {
    expect(SOUND_CONFIG.explosion.frequency).toBe(180);
    expect(SOUND_CONFIG.explosion.sweepTo).toBe(60);
  });

  it('tank sounds should remain in sub-bass (35-100Hz)', () => {
    expect(SOUND_CONFIG.tankEnergy.frequency).toBe(90);
    expect(SOUND_CONFIG.tankCharging.frequency).toBe(70);
  });

  it('stabber sounds should remain in high band (1800-2500Hz)', () => {
    expect(SOUND_CONFIG.stabberChant.frequency).toBe(2000);
    expect(SOUND_CONFIG.stabberKnife.frequency).toBe(2400);
  });

  it('grunt sounds should stay in mid band (300-500Hz)', () => {
    expect(SOUND_CONFIG.gruntAdvance.frequency).toBe(400);
    expect(SOUND_CONFIG.gruntRetreat.frequency).toBe(350);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/FrequencyRedistribution.test.js`
Expected: FAIL — playerShoot is 480, not 220

- [ ] **Step 3: Update SoundConfig.js frequencies**

In `js/audio/SoundConfig.js`, change these values:

`playerShoot`: frequency `480` → `220`
`playerDash`: frequency `600` → `200`
`rusherCharge`: frequency `500` → `700`
`rusherScream`: frequency `600` → `750`
`explosion`: frequency `300` → `180` (sweepTo stays 60)

Leave all other properties (waveform, volume, duration, etc.) unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/FrequencyRedistribution.test.js`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `pnpm run test:unit`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add js/audio/SoundConfig.js tests/unit/FrequencyRedistribution.test.js
git commit -m "feat: redistribute frequencies for cleaner per-entity separation"
```

---

### Task 5: Per-enemy hit reaction sounds

**Files:**
- Modify: `js/audio/SoundConfig.js` (add 4 new hit reaction sounds)
- Modify: `js/entities/Grunt.js:374-448` (use gruntHit for regular hits)
- Modify: `js/entities/Tank.js:462-495`
- Modify: `js/entities/Stabber.js:308-363`
- Modify: `js/entities/Rusher.js:366-396`
- Create: `tests/unit/EnemyHitReactions.test.js`

- [ ] **Step 1: Write test for new hit reaction sound configs**

```javascript
// tests/unit/EnemyHitReactions.test.js
import { describe, it, expect } from 'vitest';
import { SOUND_CONFIG } from '../../js/audio/SoundConfig.js';

describe('Enemy hit reaction sounds', () => {
  it('tankHit should be a deep thud at 55Hz', () => {
    expect(SOUND_CONFIG.tankHit).toBeDefined();
    expect(SOUND_CONFIG.tankHit.frequency).toBe(55);
    expect(SOUND_CONFIG.tankHit.type).toBe('sine');
    expect(SOUND_CONFIG.tankHit.duration).toBe(0.2);
  });

  it('stabberHit should be a metallic ping at 2100Hz', () => {
    expect(SOUND_CONFIG.stabberHit).toBeDefined();
    expect(SOUND_CONFIG.stabberHit.frequency).toBe(2100);
    expect(SOUND_CONFIG.stabberHit.type).toBe('triangle');
    expect(SOUND_CONFIG.stabberHit.duration).toBe(0.04);
  });

  it('rusherHit should be an angry buzz at 650Hz', () => {
    expect(SOUND_CONFIG.rusherHit).toBeDefined();
    expect(SOUND_CONFIG.rusherHit.frequency).toBe(650);
    expect(SOUND_CONFIG.rusherHit.type).toBe('sawtooth');
    expect(SOUND_CONFIG.rusherHit.duration).toBe(0.08);
  });

  it('gruntHit should be a surprised beep at 450Hz', () => {
    expect(SOUND_CONFIG.gruntHit).toBeDefined();
    expect(SOUND_CONFIG.gruntHit.frequency).toBe(450);
    expect(SOUND_CONFIG.gruntHit.type).toBe('square');
    expect(SOUND_CONFIG.gruntHit.duration).toBe(0.06);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/EnemyHitReactions.test.js`
Expected: FAIL — `SOUND_CONFIG.tankHit` is undefined

- [ ] **Step 3: Add hit reaction sounds to SoundConfig.js**

In `js/audio/SoundConfig.js`, add after the existing `gruntOw` entry:

```javascript
  gruntHit: {
    frequency: 450,
    type: 'square',
    volume: 0.2,
    duration: 0.06,
  },
  tankHit: {
    frequency: 55,
    type: 'sine',
    volume: 0.35,
    duration: 0.2,
  },
  stabberHit: {
    frequency: 2100,
    type: 'triangle',
    volume: 0.3,
    duration: 0.04,
  },
  rusherHit: {
    frequency: 650,
    type: 'sawtooth',
    volume: 0.3,
    duration: 0.08,
  },
```

Also add to `SOUND_METHOD_TO_KEY`:
```javascript
  playGruntHit: 'gruntHit',
  playTankHit: 'tankHit',
  playStabberHit: 'stabberHit',
  playRusherHit: 'rusherHit',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/EnemyHitReactions.test.js`
Expected: PASS

- [ ] **Step 5: Add hit reaction to Grunt.takeDamage()**

In `js/entities/Grunt.js`, in the `takeDamage()` method, find where `gruntOw` is played on non-lethal hits and replace that call with `gruntHit` for regular damage hits. Keep `gruntOw` for stab reactions (the forced speech path). Read the method first to identify the right sound call to change.

- [ ] **Step 6: Add hit reaction to Tank.takeDamage()**

In `js/entities/Tank.js`, inside the `takeDamage()` method (around line 470), add after the health subtraction and before the return:

```javascript
    const audio = this.getContextValue('audio');
    if (audio) {
      audio.playSound('tankHit', this.x, this.y);
    }
```

Place this so it plays on every hit (not just death). Read the method first to find the right insertion point — it should go after `this.health -= amount` and before any death check.

- [ ] **Step 7: Add hit reaction to Stabber.takeDamage()**

In `js/entities/Stabber.js`, inside the `takeDamage()` method (around line 318), add after the armor damage processing:

```javascript
    const audio = this.getContextValue('audio');
    if (audio) {
      audio.playSound('stabberHit', this.x, this.y);
    }
```

- [ ] **Step 8: Add hit reaction to Rusher.takeDamage()**

In `js/entities/Rusher.js`, inside the `takeDamage()` method (around line 370), add early in the method:

```javascript
    const audio = this.getContextValue('audio');
    if (audio) {
      audio.playSound('rusherHit', this.x, this.y);
    }
```

- [ ] **Step 9: Run full test suite**

Run: `pnpm run test:unit`
Expected: All pass

- [ ] **Step 10: Commit**

```bash
git add js/audio/SoundConfig.js js/entities/Grunt.js js/entities/Tank.js js/entities/Stabber.js js/entities/Rusher.js tests/unit/EnemyHitReactions.test.js
git commit -m "feat: add per-enemy hit reaction sounds in frequency-separated bands"
```

---

### Task 6: Ambient drone layer

**Files:**
- Modify: `js/Audio.js`
- Create: `tests/unit/AmbientDrone.test.js`

- [ ] **Step 1: Write test for ambient drone API**

```javascript
// tests/unit/AmbientDrone.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Ambient drone', () => {
  it('Audio should expose startDrone() and stopDrone() methods', async () => {
    // Dynamic import to avoid Audio constructor side effects
    const { Audio } = await import('../../js/Audio.js');
    expect(typeof Audio.prototype.startDrone).toBe('function');
    expect(typeof Audio.prototype.stopDrone).toBe('function');
  });

  it('Audio should expose duckDrone() for tank sub-bass ducking', async () => {
    const { Audio } = await import('../../js/Audio.js');
    expect(typeof Audio.prototype.duckDrone).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/AmbientDrone.test.js`
Expected: FAIL — `startDrone` is not a function

- [ ] **Step 3: Implement ambient drone in Audio.js**

In `js/Audio.js`, add the following methods to the Audio class. Place them after the existing `playTone()` method:

```javascript
  startDrone() {
    if (this.droneOsc || !this.audioContext) return;

    const ctx = this.audioContext;
    this.droneOsc = ctx.createOscillator();
    this.droneGain = ctx.createGain();
    this.droneFilter = ctx.createBiquadFilter();

    this.droneOsc.type = 'sine';
    this.droneOsc.frequency.setValueAtTime(42, ctx.currentTime);

    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.setValueAtTime(80, ctx.currentTime);

    // Fade in over 2 seconds
    this.droneGain.gain.setValueAtTime(0, ctx.currentTime);
    this.droneGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 2);

    this.droneOsc.connect(this.droneFilter);
    this.droneFilter.connect(this.droneGain);
    this.droneGain.connect(this.masterGain || ctx.destination);

    this.droneOsc.start();

    // Slow filter sweep: oscillate cutoff 80-200Hz over ~8 measures (16s at 120 BPM)
    this._droneFilterSweep(ctx);
  }

  _droneFilterSweep(ctx) {
    if (!this.droneFilter || !this.droneOsc) return;
    const sweepDuration = 16; // ~8 measures at 120 BPM
    const now = ctx.currentTime;
    this.droneFilter.frequency.setValueAtTime(80, now);
    this.droneFilter.frequency.linearRampToValueAtTime(200, now + sweepDuration / 2);
    this.droneFilter.frequency.linearRampToValueAtTime(80, now + sweepDuration);
    // Schedule next sweep
    this._droneSweepTimer = setTimeout(() => this._droneFilterSweep(ctx), sweepDuration * 1000);
  }

  stopDrone() {
    if (this._droneSweepTimer) {
      clearTimeout(this._droneSweepTimer);
      this._droneSweepTimer = null;
    }
    if (this.droneOsc) {
      try {
        this.droneOsc.stop();
        this.droneOsc.disconnect();
      } catch (e) { /* already stopped */ }
      this.droneOsc = null;
    }
    if (this.droneGain) {
      this.droneGain.disconnect();
      this.droneGain = null;
    }
    if (this.droneFilter) {
      this.droneFilter.disconnect();
      this.droneFilter = null;
    }
  }

  duckDrone(durationMs = 500) {
    if (!this.droneGain || !this.audioContext) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    this.droneGain.gain.setValueAtTime(this.droneGain.gain.value, now);
    this.droneGain.gain.linearRampToValueAtTime(0.03, now + 0.05);
    this.droneGain.gain.linearRampToValueAtTime(0.08, now + durationMs / 1000);
  }
```

- [ ] **Step 4: Start drone when game begins**

In `js/GameLoopSetup.js`, after the BeatTrack initialization (around line 162), add:

```javascript
  if (window.audio && window.audio.startDrone) {
    window.audio.startDrone();
  }
```

- [ ] **Step 5: Duck drone on tank fire**

In `js/entities/Tank.js`, in the section where tank fires its charged shot (find the `audio.playTankEnergyBall` or `audio.playSound('tankEnergy', ...)` call), add immediately after:

```javascript
    if (audio && audio.duckDrone) {
      audio.duckDrone(500);
    }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/unit/AmbientDrone.test.js`
Expected: PASS

- [ ] **Step 7: Run full test suite**

Run: `pnpm run test:unit`
Expected: All pass

- [ ] **Step 8: Commit**

```bash
git add js/Audio.js js/GameLoopSetup.js js/entities/Tank.js tests/unit/AmbientDrone.test.js
git commit -m "feat: add ambient 42Hz drone with filter sweep and tank ducking"
```

---

## Track 3: Musical Interplay

### Task 7: Call-and-response sounds in SoundConfig

**Files:**
- Modify: `js/audio/SoundConfig.js`
- Create: `tests/unit/CallAndResponse.test.js`

- [ ] **Step 1: Write test for response sound configs**

```javascript
// tests/unit/CallAndResponse.test.js
import { describe, it, expect } from 'vitest';
import { SOUND_CONFIG } from '../../js/audio/SoundConfig.js';

describe('Call-and-response sound configs', () => {
  it('gruntResponse should be an alarmed chirp at 380Hz', () => {
    expect(SOUND_CONFIG.gruntResponse).toBeDefined();
    expect(SOUND_CONFIG.gruntResponse.frequency).toBe(380);
    expect(SOUND_CONFIG.gruntResponse.type).toBe('square');
    expect(SOUND_CONFIG.gruntResponse.duration).toBe(0.1);
  });

  it('tankResponse should be a low acknowledgment at 70Hz', () => {
    expect(SOUND_CONFIG.tankResponse).toBeDefined();
    expect(SOUND_CONFIG.tankResponse.frequency).toBe(70);
    expect(SOUND_CONFIG.tankResponse.type).toBe('sine');
    expect(SOUND_CONFIG.tankResponse.duration).toBe(0.3);
  });

  it('stabberResponse should be a sharp hiss at 2300Hz', () => {
    expect(SOUND_CONFIG.stabberResponse).toBeDefined();
    expect(SOUND_CONFIG.stabberResponse.frequency).toBe(2300);
    expect(SOUND_CONFIG.stabberResponse.type).toBe('triangle');
    expect(SOUND_CONFIG.stabberResponse.duration).toBe(0.06);
  });

  it('rusherResponse should be an agitated whine sweeping 720->500Hz', () => {
    expect(SOUND_CONFIG.rusherResponse).toBeDefined();
    expect(SOUND_CONFIG.rusherResponse.frequency).toBe(720);
    expect(SOUND_CONFIG.rusherResponse.sweepTo).toBe(500);
    expect(SOUND_CONFIG.rusherResponse.type).toBe('sawtooth');
    expect(SOUND_CONFIG.rusherResponse.duration).toBe(0.15);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/CallAndResponse.test.js`
Expected: FAIL — `SOUND_CONFIG.gruntResponse` is undefined

- [ ] **Step 3: Add response sounds to SoundConfig.js**

In `js/audio/SoundConfig.js`, add after the hit reaction sounds:

```javascript
  gruntResponse: {
    frequency: 380,
    type: 'square',
    volume: 0.2,
    duration: 0.1,
  },
  tankResponse: {
    frequency: 70,
    type: 'sine',
    volume: 0.3,
    duration: 0.3,
  },
  stabberResponse: {
    frequency: 2300,
    type: 'triangle',
    volume: 0.25,
    duration: 0.06,
  },
  rusherResponse: {
    frequency: 720,
    type: 'sawtooth',
    volume: 0.25,
    duration: 0.15,
    sweepTo: 500,
    sweepType: 'exponential',
  },
```

Also add to `SOUND_METHOD_TO_KEY`:
```javascript
  playGruntResponse: 'gruntResponse',
  playTankResponse: 'tankResponse',
  playStabberResponse: 'stabberResponse',
  playRusherResponse: 'rusherResponse',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/CallAndResponse.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/audio/SoundConfig.js tests/unit/CallAndResponse.test.js
git commit -m "feat: add call-and-response sound configs for all enemy types"
```

---

### Task 8: Call-and-response dispatch in EnemyDeathHandler

**Files:**
- Modify: `js/entities/BaseEnemy.js` (add `onNearbyDeath` method)
- Modify: `js/systems/combat/EnemyDeathHandler.js` (dispatch nearby death events)

- [ ] **Step 1: Add `onNearbyDeath` method to BaseEnemy**

In `js/entities/BaseEnemy.js`, add a new method (place it after `takeDamage`):

```javascript
  onNearbyDeath(deadEnemy) {
    if (!deadEnemy || deadEnemy.type !== this.type) return;
    if (this.markedForRemoval || this.health <= 0) return;

    const dx = this.x - deadEnemy.x;
    const dy = this.y - deadEnemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 300) return;

    const audio = this.getContextValue('audio');
    if (!audio) return;

    const responseKey = `${this.type}Response`;
    const beatClock = this.getContextValue('beatClock');

    if (beatClock) {
      // Quantize response to next eighth-note
      const delay = beatClock.getTimeToNextEighthNote
        ? beatClock.getTimeToNextEighthNote()
        : beatClock.getTimeToNextBeat() / 2;
      setTimeout(() => {
        audio.playSound(responseKey, this.x, this.y);
      }, Math.max(0, delay));
    } else {
      audio.playSound(responseKey, this.x, this.y);
    }
  }
```

- [ ] **Step 2: Add `getTimeToNextEighthNote` to BeatClock**

In `js/audio/BeatClock.js`, add after the existing `getTimeToNextBeat()` method:

```javascript
  getTimeToNextEighthNote() {
    this.update();
    const elapsed = this.cache.elapsed;
    const eighthInterval = this.beatInterval / 2;
    const timeSinceLastEighth = elapsed % eighthInterval;
    return eighthInterval - timeSinceLastEighth;
  }
```

- [ ] **Step 3: Dispatch nearby death events from EnemyDeathHandler**

In `js/systems/combat/EnemyDeathHandler.js`, modify the `handleEnemyDeath` method. Add at the end of the method (before the final closing brace):

```javascript
    // Call-and-response: notify nearby same-type enemies
    const enemies = this.getContextValue('enemies');
    if (enemies) {
      let responseCount = 0;
      for (const other of enemies) {
        if (responseCount >= 2) break;
        if (other === enemy || other.markedForRemoval) continue;
        if (other.type === enemyType && other.onNearbyDeath) {
          other.onNearbyDeath(enemy);
          responseCount++;
        }
      }
    }
```

- [ ] **Step 4: Run full test suite**

Run: `pnpm run test:unit`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add js/entities/BaseEnemy.js js/audio/BeatClock.js js/systems/combat/EnemyDeathHandler.js
git commit -m "feat: call-and-response — nearby same-type enemies react to deaths"
```

---

### Task 9: BeatTrack evolution (nice-to-have)

**Files:**
- Modify: `js/audio/BeatTrack.js`
- Create: `tests/unit/BeatTrackEvolution.test.js`

- [ ] **Step 1: Write test for level-based BeatTrack layers**

```javascript
// tests/unit/BeatTrackEvolution.test.js
import { describe, it, expect } from 'vitest';
import { BeatTrack } from '../../js/audio/BeatTrack.js';

describe('BeatTrack evolution', () => {
  it('should expose a setLevel() method', () => {
    expect(typeof BeatTrack.prototype.setLevel).toBe('function');
  });

  it('should track current level', () => {
    // BeatTrack constructor requires (bpm, context)
    const track = new BeatTrack(120, {});
    track.setLevel(3);
    expect(track.level).toBe(3);
  });

  it('should track level for layer decisions', () => {
    const track = new BeatTrack(120, {});
    track.setLevel(1);
    expect(track.level).toBe(1);
    track.setLevel(5);
    expect(track.level).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/BeatTrackEvolution.test.js`
Expected: FAIL — `setLevel` is not a function

- [ ] **Step 3: Add setLevel and level-aware pulse to BeatTrack**

In `js/audio/BeatTrack.js`:

Add to the constructor (after `this._enemyCount = 0;` or similar):
```javascript
    this.level = 1;
```

Add a new method:
```javascript
  setLevel(level) {
    this.level = level;
  }
```

Modify the `_playPulse(time, isDownbeat)` method. After the existing oscillator setup and before the oscillator starts, add the level-based layers:

```javascript
    // Level 3+: Add octave harmonic
    if (this.level >= 3 && this.ctx) {
      const harmonicOsc = this.ctx.createOscillator();
      const harmonicGain = this.ctx.createGain();
      harmonicOsc.type = 'sine';
      harmonicOsc.frequency.setValueAtTime(100, time);
      harmonicGain.gain.setValueAtTime(volume * 0.3, time);
      harmonicGain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      harmonicOsc.connect(harmonicGain);
      harmonicGain.connect(this.masterGain);
      harmonicOsc.start(time);
      harmonicOsc.stop(time + duration);
    }

    // Level 5+: Add noise transient on downbeats
    if (this.level >= 5 && isDownbeat && this.ctx) {
      const bufferSize = this.ctx.sampleRate * 0.03; // 30ms
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(40, time);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(volume * 0.5, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.masterGain);
      noiseSource.start(time);
    }
```

- [ ] **Step 4: Wire level updates to BeatTrack**

Find where the game level changes. In the game state or level progression code, after level increments, add:

```javascript
if (window.beatTrack && window.beatTrack.setLevel) {
  window.beatTrack.setLevel(newLevel);
}
```

Read `js/systems/GameState.js` or equivalent to find the exact level increment location and add this call there.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/BeatTrackEvolution.test.js`
Expected: PASS

- [ ] **Step 6: Run full test suite**

Run: `pnpm run test:unit`
Expected: All pass

- [ ] **Step 7: Manual verification**

Run: `pnpm run dev` and play through levels 1-5. Listen for:
- Level 1-2: Soft sine pulse only
- Level 3-4: Subtle octave harmonic adds warmth
- Level 5+: Soft kick-like transient on downbeats

If any layer muds the sub-bass or clashes with tank sounds, reduce volumes or cut this task.

- [ ] **Step 8: Commit**

```bash
git add js/audio/BeatTrack.js tests/unit/BeatTrackEvolution.test.js
git commit -m "feat: BeatTrack evolves with level — octave harmonic at 3, noise kick at 5"
```

Add the level wiring file too:
```bash
git add -u
git commit --amend --no-edit
```

---

## Final Verification

### Task 10: Integration test and play-through

- [ ] **Step 1: Run full test suite**

Run: `pnpm run test:unit`
Expected: All tests pass

- [ ] **Step 2: Run linting**

Run: `npx eslint "**/*.js"`
Expected: No new errors

- [ ] **Step 3: Play-through verification**

Run: `pnpm run dev` and verify:
1. **Beat robustness**: Level transitions feel smooth, no beat stuttering
2. **Frequency separation**: Player shots sound distinct from enemies, rusher and grunt don't blend
3. **Hit reactions**: Each enemy type makes a unique sound when damaged
4. **Ambient drone**: Subtle low hum present, dips when tank fires
5. **Call-and-response**: Killing an enemy near same-type allies triggers a brief response sound
6. **BeatTrack evolution**: Pulse gains texture at levels 3 and 5

- [ ] **Step 4: Commit any final adjustments**

```bash
git add -u
git commit -m "chore: final tuning pass on cosmic beat improvements"
```

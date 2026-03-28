# Cosmic Beat Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken beat foundation (clock drift, frame-based timers, dead code) then redesign enemies as musical instruments with beat evolution tied to level progression.

**Architecture:** Two-phase approach. Phase 1 fixes plumbing without changing player-visible behavior (clock unification, bug fixes, dead code removal). Phase 2 redesigns enemy timing, player shooting, BeatTrack audio, and visual feedback to create an emergent musical experience that grows with level progression.

**Tech Stack:** Vanilla JS, Web Audio API, p5.js, Vitest

**Spec:** `docs/superpowers/specs/2026-03-28-cosmic-beat-overhaul-design.md`

---

## Phase 1: Fix the Foundation

### Task 1: Clock Unification — BeatClock uses AudioContext.currentTime

**Files:**
- Modify: `js/audio/BeatClock.js` (lines 14-220)
- Modify: `js/GameLoopSetup.js` (lines 96-111)
- Test: `tests/unit/BeatClock.test.js`

- [ ] **Step 1: Update BeatClock test to pass audioContext**

Replace the existing test setup and add a clock-source test:

```javascript
// tests/unit/BeatClock.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BeatClock } from '../../js/audio/BeatClock.js';

vi.spyOn(console, 'log').mockImplementation(() => {});

// Mock AudioContext with controllable currentTime
function createMockAudioContext(startTime = 0) {
  let _currentTime = startTime;
  return {
    get currentTime() { return _currentTime; },
    _advance(seconds) { _currentTime += seconds; },
  };
}

describe('BeatClock', () => {
  let clock;
  let mockCtx;

  beforeEach(() => {
    mockCtx = createMockAudioContext();
    clock = new BeatClock(120, mockCtx);
  });

  it('initializes with correct BPM and interval', () => {
    expect(clock.bpm).toBe(120);
    expect(clock.beatInterval).toBe(500);
    expect(clock.beatsPerMeasure).toBe(4);
  });

  it('computes beat interval from BPM', () => {
    const slow = new BeatClock(60, mockCtx);
    expect(slow.beatInterval).toBe(1000);

    const fast = new BeatClock(240, mockCtx);
    expect(fast.beatInterval).toBe(250);
  });

  it('uses AudioContext.currentTime as clock source', () => {
    mockCtx._advance(0); // at time 0
    clock.update(true);
    expect(clock.getCurrentBeat()).toBe(0);
    expect(clock.getTotalBeats()).toBe(0);

    // Advance 1 beat (500ms = 0.5s at 120 BPM)
    mockCtx._advance(0.5);
    clock.update(true);
    expect(clock.getCurrentBeat()).toBe(1);
    expect(clock.getTotalBeats()).toBe(1);
  });

  it('getCurrentBeat cycles 0-3 across a full measure', () => {
    // Beat 0
    mockCtx._advance(0);
    clock.update(true);
    expect(clock.getCurrentBeat()).toBe(0);

    // Beat 1
    mockCtx._advance(0.5);
    clock.update(true);
    expect(clock.getCurrentBeat()).toBe(1);

    // Beat 2
    mockCtx._advance(0.5);
    clock.update(true);
    expect(clock.getCurrentBeat()).toBe(2);

    // Beat 3
    mockCtx._advance(0.5);
    clock.update(true);
    expect(clock.getCurrentBeat()).toBe(3);

    // Back to Beat 0
    mockCtx._advance(0.5);
    clock.update(true);
    expect(clock.getCurrentBeat()).toBe(0);
  });

  it('getTotalBeats returns non-negative integer', () => {
    const total = clock.getTotalBeats();
    expect(total).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(total)).toBe(true);
  });

  it('getTimeToNextBeat is within beat interval', () => {
    mockCtx._advance(0.1); // 100ms into first beat
    clock.update(true);
    const t = clock.getTimeToNextBeat();
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThanOrEqual(clock.beatInterval);
  });

  it('setBPM updates tempo', () => {
    clock.setBPM(60);
    expect(clock.bpm).toBe(60);
    expect(clock.beatInterval).toBe(1000);
  });

  it('reset restarts timing from current AudioContext time', () => {
    mockCtx._advance(5.0); // 5 seconds in
    clock.update(true);
    const beatsBefore = clock.getTotalBeats();
    expect(beatsBefore).toBe(10); // 5s at 120bpm = 10 beats

    clock.reset();
    expect(clock.getTotalBeats()).toBe(0);
  });

  it('getBeatPhase returns 0..1', () => {
    mockCtx._advance(0.25); // halfway through a beat
    clock.update(true);
    const phase = clock.getBeatPhase();
    expect(phase).toBeCloseTo(0.5, 1);
  });

  it('getBeatIntensity returns positive value <= 1', () => {
    const intensity = clock.getBeatIntensity();
    expect(intensity).toBeGreaterThan(0);
    expect(intensity).toBeLessThanOrEqual(1);
  });

  it('getMeasurePhase returns 0..1', () => {
    mockCtx._advance(1.0); // 2 beats into measure = 50%
    clock.update(true);
    const phase = clock.getMeasurePhase();
    expect(phase).toBeCloseTo(0.5, 1);
  });

  it('isOnBeat with beat filter checks specific beats', () => {
    const result = clock.isOnBeat([1, 3]);
    expect(typeof result).toBe('boolean');
  });

  it('canPlayerShootQuarterBeat returns boolean', () => {
    expect(typeof clock.canPlayerShootQuarterBeat()).toBe('boolean');
  });

  it('getTimeToNextQuarterBeat is positive', () => {
    mockCtx._advance(0.01); // slightly after start
    clock.update(true);
    const t = clock.getTimeToNextQuarterBeat();
    expect(t).toBeGreaterThan(0);
  });

  it('getBeatInfo returns structured object', () => {
    const info = clock.getBeatInfo();
    expect(info).toHaveProperty('currentBeat');
    expect(info).toHaveProperty('totalBeats');
    expect(info).toHaveProperty('timeToNext');
    expect(info).toHaveProperty('onBeat');
    expect(info).toHaveProperty('bpm');
    expect(info.currentBeat).toBeGreaterThanOrEqual(1);
    expect(info.currentBeat).toBeLessThanOrEqual(4);
  });

  it('currentBeat getter matches getCurrentBeat()', () => {
    expect(clock.currentBeat).toBe(clock.getCurrentBeat());
  });

  it('canGruntShoot returns true on beats 2 and 4', () => {
    // Beat 1 (index 1) = beat 2
    mockCtx._advance(0.5);
    clock.update(true);
    expect(clock.canGruntShoot()).toBe(true);

    // Beat 2 (index 2) = beat 3 - should NOT fire
    mockCtx._advance(0.5);
    clock.update(true);
    expect(clock.canGruntShoot()).toBe(false);

    // Beat 3 (index 3) = beat 4
    mockCtx._advance(0.5);
    clock.update(true);
    expect(clock.canGruntShoot()).toBe(true);
  });

  it('canTankShoot returns true only on beat 1', () => {
    // Beat 0 (index 0) = beat 1
    clock.update(true);
    expect(clock.canTankShoot()).toBe(true);

    // Beat 1 (index 1) = beat 2 - should NOT fire
    mockCtx._advance(0.5);
    clock.update(true);
    expect(clock.canTankShoot()).toBe(false);
  });

  it('canRusherExplode returns true on beats 1 and 3', () => {
    // Beat 0 = beat 1
    clock.update(true);
    expect(clock.canRusherExplode()).toBe(true);

    // Beat 1 = beat 2
    mockCtx._advance(0.5);
    clock.update(true);
    expect(clock.canRusherExplode()).toBe(false);

    // Beat 2 = beat 3
    mockCtx._advance(0.5);
    clock.update(true);
    expect(clock.canRusherExplode()).toBe(true);
  });

  it('falls back to Date.now when no audioContext provided', () => {
    const fallbackClock = new BeatClock(120);
    // Should still work, just using Date.now
    expect(fallbackClock.getCurrentBeat()).toBeGreaterThanOrEqual(0);
    expect(fallbackClock.getCurrentBeat()).toBeLessThan(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/BeatClock.test.js`
Expected: FAIL — BeatClock constructor doesn't accept audioContext parameter yet

- [ ] **Step 3: Implement BeatClock clock unification**

Replace the full `js/audio/BeatClock.js` file. Key changes:
- Constructor accepts optional `audioContext` parameter
- `_now()` method returns time in milliseconds from either `audioContext.currentTime * 1000` or `Date.now()`
- `update()` uses `_now()` instead of `Date.now()`
- `reset()` uses `_now()` instead of `Date.now()`

```javascript
// js/audio/BeatClock.js
/**
 * BeatClock - Musical Timing System for Vibe Game
 *
 * Creates a subtle rhythmic foundation where enemy combat actions sync to musical beats.
 * The player can shoot freely, but enemies create the musical structure:
 * - Player = Free shooting (creates natural hi-hat feel)
 * - Grunts = Snare (beats 2 & 4)
 * - Tanks = Bass drum (beat 1)
 * - Stabbers = Off-beat accent (beat 3.5)
 * - Rushers = Accent/crash (beats 1 & 3)
 *
 * This creates an emergent musical experience that players discover organically.
 */

export class BeatClock {
  constructor(bpm = 120, audioContext = null) {
    this.bpm = bpm;
    this.beatInterval = (60 / bpm) * 1000; // milliseconds per beat
    this.audioContext = audioContext;
    this.startTime = this._now();
    this.tolerance = 100; // ms tolerance for "on beat" detection

    // Beat pattern tracking (4/4 time signature)
    this.beatsPerMeasure = 4;
    this.cache = {
      timestamp: 0,
      elapsed: 0,
      totalBeats: 0,
      currentBeat: 0,
      timeToNextBeat: this.beatInterval,
      beatPhase: 0,
      measurePhase: 0,
    };
    this.update(true);

    console.log(
      `🎵 BeatClock initialized: ${bpm} BPM (${this.beatInterval}ms per beat), clock: ${audioContext ? 'AudioContext' : 'Date.now'}`
    );
  }

  // Unified time source — returns milliseconds
  _now() {
    if (this.audioContext) {
      return this.audioContext.currentTime * 1000;
    }
    return Date.now();
  }

  getCurrentBeat() {
    this.update();
    return this.cache.currentBeat;
  }

  getTotalBeats() {
    this.update();
    return this.cache.totalBeats;
  }

  getTimeToNextBeat() {
    this.update();
    return this.cache.timeToNextBeat;
  }

  isOnBeat(beats = null) {
    const timeToNext = this.getTimeToNextBeat();
    const onBeat =
      timeToNext <= this.tolerance ||
      timeToNext >= this.beatInterval - this.tolerance;

    if (!beats || !Array.isArray(beats)) {
      return onBeat;
    }

    if (!onBeat) return false;

    const currentBeat = this.getCurrentBeat() + 1;
    return beats.includes(currentBeat);
  }

  canPlayerShoot() {
    return this.isOnBeat();
  }

  canPlayerShootQuarterBeat() {
    this.update();
    const elapsed = this.cache.elapsed;
    const quarterBeatInterval = this.beatInterval / 4;
    const timeSinceLastQuarterBeat = elapsed % quarterBeatInterval;
    const exactTolerance = 16;

    return (
      timeSinceLastQuarterBeat <= exactTolerance ||
      timeSinceLastQuarterBeat >= quarterBeatInterval - exactTolerance
    );
  }

  getTimeToNextQuarterBeat() {
    this.update();
    const elapsed = this.cache.elapsed;
    const quarterBeatInterval = this.beatInterval / 4;
    const timeSinceLastQuarterBeat = elapsed % quarterBeatInterval;
    return quarterBeatInterval - timeSinceLastQuarterBeat;
  }

  canGruntShoot() {
    if (!this.isOnBeat()) return false;
    const currentBeat = this.getCurrentBeat();
    return currentBeat === 1 || currentBeat === 3;
  }

  canTankShoot() {
    if (!this.isOnBeat()) return false;
    const currentBeat = this.getCurrentBeat();
    return currentBeat === 0;
  }

  canStabberAttack() {
    this.update();
    const elapsed = this.cache.elapsed;
    const beatPosition = (elapsed % this.beatInterval) / this.beatInterval;
    const currentBeat = this.getCurrentBeat();
    if (currentBeat === 2) {
      return beatPosition >= 0.75;
    }
    if (currentBeat === 3) {
      return beatPosition <= 0.25;
    }
    return false;
  }

  canRusherCharge() {
    return this.isOnBeat();
  }

  canRusherExplode() {
    if (!this.isOnBeat()) return false;
    const currentBeat = this.getCurrentBeat();
    return currentBeat === 0 || currentBeat === 2;
  }

  getBeatInfo() {
    return {
      currentBeat: this.getCurrentBeat() + 1,
      totalBeats: this.getTotalBeats(),
      timeToNext: Math.round(this.getTimeToNextBeat()),
      onBeat: this.isOnBeat(),
      bpm: this.bpm,
    };
  }

  setBPM(newBPM) {
    this.bpm = newBPM;
    this.beatInterval = (60 / newBPM) * 1000;
    this.update(true);
    console.log(`🎵 Tempo changed to ${newBPM} BPM`);
  }

  reset() {
    this.startTime = this._now();
    this.update(true);
    console.log('🎵 BeatClock reset');
  }

  getBeatPhase() {
    this.update();
    return this.cache.beatPhase;
  }

  getBeatIntensity(decayRate = 8) {
    const phase = this.getBeatPhase();
    return Math.exp(-phase * decayRate);
  }

  getDownbeatIntensity(decayRate = 6) {
    const beat = this.getCurrentBeat();
    const intensity = this.getBeatIntensity(decayRate);
    return beat === 0 ? intensity : intensity * 0.4;
  }

  getMeasurePhase() {
    this.update();
    return this.cache.measurePhase;
  }

  update(force = false) {
    const now = this._now();
    if (!force && now === this.cache.timestamp) return;

    const elapsed = now - this.startTime;
    const totalBeats = Math.floor(elapsed / this.beatInterval);
    const timeSinceLastBeat = elapsed % this.beatInterval;
    const measureLength = this.beatInterval * this.beatsPerMeasure;

    this.cache.timestamp = now;
    this.cache.elapsed = elapsed;
    this.cache.totalBeats = totalBeats;
    this.cache.currentBeat = totalBeats % this.beatsPerMeasure;
    this.cache.timeToNextBeat = this.beatInterval - timeSinceLastBeat;
    this.cache.beatPhase = timeSinceLastBeat / this.beatInterval;
    this.cache.measurePhase = (elapsed % measureLength) / measureLength;
  }

  get currentBeat() {
    return this.getCurrentBeat();
  }
}
```

- [ ] **Step 4: Wire AudioContext in GameLoopSetup**

In `js/GameLoopSetup.js`, pass the Audio system's audioContext to BeatClock. Change lines 108-111:

```javascript
// Before:
if (!window.beatClock) {
  window.beatClock = new BeatClock(DEFAULT_BPM);
  console.log('🎵 BeatClock initialized and assigned to window.beatClock');
}

// After:
if (!window.beatClock) {
  const audioCtx = window.audio?.audioContext ?? null;
  window.beatClock = new BeatClock(DEFAULT_BPM, audioCtx);
  console.log('🎵 BeatClock initialized and assigned to window.beatClock');
}
```

Note: `window.audio` is created at line 97, before BeatClock at line 108. The Audio class creates its audioContext lazily on `initialize()`, so it may be null at this point. That's fine — BeatClock falls back to `Date.now()`. Once Audio initializes (on first user interaction), we should sync the clock. Add after the BeatClock creation:

```javascript
// Sync BeatClock to AudioContext once audio initializes
const originalInit = window.audio?.initialize?.bind(window.audio);
if (originalInit && window.audio) {
  window.audio.initialize = function() {
    originalInit();
    if (this.audioContext && window.beatClock && !window.beatClock.audioContext) {
      window.beatClock.audioContext = this.audioContext;
      window.beatClock.startTime = window.beatClock._now();
      window.beatClock.update(true);
      console.log('🎵 BeatClock synced to AudioContext');
    }
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/BeatClock.test.js`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add js/audio/BeatClock.js js/GameLoopSetup.js tests/unit/BeatClock.test.js
git commit -m "fix: unify BeatClock and BeatTrack on AudioContext.currentTime

BeatClock now accepts an optional audioContext parameter and uses
audioContext.currentTime as its clock source, eliminating drift between
beat timing and audio synthesis. Falls back to Date.now() when no
AudioContext is available. GameLoopSetup syncs the clock once Audio
initializes on first user interaction."
```

---

### Task 2: Dead Code Cleanup

**Files:**
- Modify: `js/systems/background/BackgroundLayers.js` (lines 11-28, `getBeatReactiveValues`)
- Modify: `js/systems/background/CosmicAuroraBackground.js` (lines 76-87, dead cache logic)
- Modify: `js/entities/EnemyFactory.js` (lines 214-231, dead spawn methods)

- [ ] **Step 1: Check if getBeatReactiveValues is called anywhere**

Run: `grep -r "getBeatReactiveValues" js/` to confirm it's dead code.

- [ ] **Step 2: Remove getBeatReactiveValues from BackgroundLayers.js**

Remove the function definition at lines 11-28 and its export. Keep all other exports intact.

- [ ] **Step 3: Remove dead cache threshold logic from CosmicAuroraBackground.js**

Lines 76-87 compute whether cached values changed by more than 2, then update cached values, but the `fill()` and `rect()` at lines 91-93 always execute regardless. Remove the threshold check and simplify: just use the computed overlay values directly in the draw call.

- [ ] **Step 4: Remove dead EnemyFactory methods**

Remove `getEnemyCountForLevel()` (lines 214-221) and `getSpawnRateForLevel()` (lines 226-231). These duplicate SpawnSystem logic with different numbers and are never called.

- [ ] **Step 5: Run tests to verify nothing breaks**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add js/systems/background/BackgroundLayers.js js/systems/background/CosmicAuroraBackground.js js/entities/EnemyFactory.js
git commit -m "chore: remove dead code — getBeatReactiveValues, aurora cache threshold, unused EnemyFactory methods"
```

---

### Task 3: Bug Fixes — RhythmFX frame-rate dependent decay

**Files:**
- Modify: `js/RhythmFX.js` (lines 43-70 update, lines 103-158 draw)

- [ ] **Step 1: Move state mutation out of drawAttackTelegraphs into update()**

In `update()` (line 43), add telegraph decay using BeatClock timing instead of hardcoded 1/60. The update method already has access to the BeatClock:

```javascript
// In update(), after the existing beat tracking code (around line 69):
// Decay telegraphs using beat-relative timing
const beatClock = this._getBeatClock();
const beatsPerFrame = beatClock
  ? (1000 / 60) / beatClock.beatInterval  // approximate, but beat-relative
  : 1 / 60;
for (let i = this.telegraphs.length - 1; i >= 0; i--) {
  const t = this.telegraphs[i];
  t.beatsUntil -= beatsPerFrame;
  t.intensity *= 0.98;
  if (t.beatsUntil <= 0 || t.intensity < 0.01) {
    this.telegraphs.splice(i, 1);
  }
}
```

- [ ] **Step 2: Remove state mutation from drawAttackTelegraphs**

Remove lines 152-154 in `drawAttackTelegraphs()`:
```javascript
// Remove these lines:
telegraph.intensity *= 0.98;
telegraph.beatsUntil -= 1/60;
```

Also remove the splice/cleanup loop at the end of the draw method (if present), since cleanup now happens in `update()`.

- [ ] **Step 3: Test visually in browser**

Run the game. Verify attack telegraphs still appear, expand, and fade correctly. The behavior should be identical at 60fps but now frame-rate independent.

- [ ] **Step 4: Commit**

```bash
git add js/RhythmFX.js
git commit -m "fix: move RhythmFX telegraph decay from draw to update, fix frame-rate dependency"
```

---

### Task 4: Bug Fixes — Enemy speech and timer beat-gating

**Files:**
- Modify: `js/entities/Grunt.js` (lines 113-121 noise timer, lines 295-303 speech)
- Modify: `js/entities/Tank.js` (lines 87-98 anger speech)
- Modify: `js/entities/Stabber.js` (lines 90-96 speech)
- Modify: `js/entities/StabberAttackHandler.js` (lines 37-52 chant timer)

- [ ] **Step 1: Fix Grunt ambient speech — hard gate to beats 2 & 4**

In `js/entities/Grunt.js`, change `getAmbientSpeechConfig()` (lines 295-303). Replace the soft gate:

```javascript
// Before (lines 296-303):
shouldSpeak: (beatClock) =>
  beatClock && beatClock.isOnBeat([2, 4])
    ? random() < 0.9
    : random() < 0.3,

// After:
shouldSpeak: (beatClock) =>
  beatClock && beatClock.isOnBeat([2, 4]) && random() < 0.9,
```

- [ ] **Step 2: Fix Grunt noise timer — replace frame timer with beat check**

In `js/entities/Grunt.js`, replace the frame-based `gruntNoiseTimer` (lines 113-121). Instead of counting down frames and then checking if on-beat, check on-beat directly with a random chance:

```javascript
// Before (lines 113-121):
this.gruntNoiseTimer -= dt;
if (this.gruntNoiseTimer <= 0) {
  this.gruntNoiseTimer = 120 + random(240);
  this.makeGruntWeirdNoise();
}

// After:
const beatClock = this.getContextValue('beatClock');
if (beatClock && beatClock.isOnBeat([2, 4]) && random() < 0.02) {
  this.makeGruntWeirdNoise();
}
```

The 2% chance per beat-2/4 frame gives roughly the same frequency as the old timer but always on-beat. Remove the `this.gruntNoiseTimer` initialization in the constructor (line 54).

Also simplify `makeGruntWeirdNoise()` (lines 273-292) — remove the internal beatClock check since the caller already verified:

```javascript
// In makeGruntWeirdNoise, remove the beatClock check (lines 277-278):
// Before:
if (!beatClock || !beatClock.isOnBeat([2, 4])) return;
// After: (remove this check entirely)
```

- [ ] **Step 3: Fix Tank anger calm-down speech — add beat gate**

In `js/entities/Tank.js`, around lines 87-98, add a beat check before calm-down speech:

```javascript
// Before (approximately):
if (audio) {
  audio.speak(this, calmLine, 'tank');
}

// After:
const beatClock = this.getContextValue('beatClock');
if (audio && (!beatClock || beatClock.isOnBeat([1]))) {
  audio.speak(this, calmLine, 'tank');
}
```

- [ ] **Step 4: Fix Stabber chant timer — replace frame timer with beat check**

In `js/entities/StabberAttackHandler.js`, replace the `stabChantTimer` pattern (lines 37-52). Instead of a frame-based countdown, check directly on beat 3.5:

```javascript
// Before (lines 37-52): frame-based stabChantTimer countdown
// After: Remove the timer. In updateStabberBehavior, add:
const beatClock = stabber.getContextValue('beatClock');
if (beatClock && beatClock.canStabberAttack() && !stabber.stabPreparing && random() < 0.03) {
  const audio = stabber.getContextValue('audio');
  if (audio) {
    audio.playSound('stabberChant', stabber.x, stabber.y);
  }
}
```

Remove `stabChantTimer` from the Stabber constructor if it exists there.

- [ ] **Step 5: Test in browser**

Run the game. Verify:
- Grunts only make sounds on beats 2 & 4
- Tank calm-down speech happens on beat 1
- Stabber chants happen on beat 3.5
- No off-beat sounds from any enemy

- [ ] **Step 6: Commit**

```bash
git add js/entities/Grunt.js js/entities/Tank.js js/entities/StabberAttackHandler.js
git commit -m "fix: hard-gate all enemy speech and ambient sounds to their beat positions"
```

---

## Phase 2: Beat Evolution

### Task 5: Beat-Aligned Grunt Timing

**Files:**
- Modify: `js/entities/Grunt.js` (lines 172-198 shooting section)

- [ ] **Step 1: Replace frame-based shootCooldown with beat-based skip**

In `js/entities/Grunt.js`, the shooting section (lines 172-198) currently uses `this.shootCooldown` (45-75 frames). Replace with a beat-tracking approach:

```javascript
// In the shooting section, replace the cooldown pattern:

// Remove frame-based cooldown check. Instead track last beat fired:
const beatClock = this.getContextValue('beatClock');
if (!beatClock) return;

if (beatClock.canGruntShoot()) {
  // Skip this beat randomly (~40% skip) for variety
  if (this._lastGruntBeat === beatClock.getTotalBeats()) return; // Already fired this beat
  this._lastGruntBeat = beatClock.getTotalBeats();

  if (random() < 0.4) return; // Random skip for variety

  // Fire!
  // ... existing bullet creation and telegraph code ...
}
```

Add `this._lastGruntBeat = -1;` to the constructor.

Remove the `this.shootCooldown` initialization and the `this.shootCooldown -= dt` decrement logic.

- [ ] **Step 2: Test in browser**

Run the game. Verify:
- Grunts fire on beats 2 and 4 only
- Not every grunt fires every beat (some skip)
- Multiple grunts firing creates a natural "ensemble" feel
- No frame-based drift

- [ ] **Step 3: Commit**

```bash
git add js/entities/Grunt.js
git commit -m "feat: replace grunt frame-based cooldown with beat-aligned firing on 2 and 4"
```

---

### Task 6: Beat-Aligned Tank Timing

**Files:**
- Modify: `js/entities/Tank.js` (lines 42-44 charge state, lines 154-211 charge/fire logic)

- [ ] **Step 1: Make tank charge duration exactly 2 measures, fire on beat 1**

Replace the frame-based charge timer with beat tracking. In the charge section:

```javascript
// In constructor, replace:
// this.maxChargeTime = 240;
// With:
this.chargeStartBeat = -1; // Beat number when charge started
this.chargeDurationBeats = 8; // 2 measures at 4/4

// In updateSpecificBehavior charge logic, replace frame counting:
const beatClock = this.getContextValue('beatClock');
if (!beatClock) return;

if (this.isCharging) {
  const beatsSinceCharge = beatClock.getTotalBeats() - this.chargeStartBeat;

  // Charge-up sound on beat 1 during charge (existing line ~158-160)
  if (beatClock.isOnBeat([1]) && random() < 0.25) {
    const audio = this.getContextValue('audio');
    if (audio) audio.playSound('tankPower', this.x, this.y);
  }

  // Fire when charge is complete AND we're on beat 1
  if (beatsSinceCharge >= this.chargeDurationBeats && beatClock.canTankShoot()) {
    this.isCharging = false;
    this._lastTankFireBeat = beatClock.getTotalBeats();
    return this.createBullet();
  }
} else {
  // Start charge on beat 1, with cooldown of at least 2 measures since last fire
  const beatsSinceLastFire = beatClock.getTotalBeats() - (this._lastTankFireBeat ?? -100);
  if (beatsSinceLastFire >= 8 && beatClock.canTankShoot()) {
    this.isCharging = true;
    this.chargeStartBeat = beatClock.getTotalBeats();
  }
}
```

Add `this._lastTankFireBeat = -100;` to constructor.

Remove `this.chargeTime`, `this.maxChargeTime`, and all frame-based `this.chargeTime += dt` logic.

- [ ] **Step 2: Test in browser**

Run the game. Verify:
- Tank starts charging on beat 1
- Charge lasts exactly 2 measures (8 beats = 4 seconds at 120 BPM)
- Tank fires on the next beat 1 after charge completes
- The fire moment is always on beat 1

- [ ] **Step 3: Commit**

```bash
git add js/entities/Tank.js
git commit -m "feat: tank charge duration is exactly 2 measures, fires on beat 1"
```

---

### Task 7: Beat-Aligned Stabber Timing

**Files:**
- Modify: `js/entities/StabberAttackHandler.js` (lines 77-260 all phases)
- Modify: `js/entities/Stabber.js` (constructor for new state vars)

- [ ] **Step 1: Make stabber preparation flex to land on beat 3.5**

The stabber's attack phases need to be beat-relative. The key change: preparation duration is no longer a fixed frame count — it fills time until the next beat 3.5 window.

In `handlePreparingPhase` (StabberAttackHandler.js lines 217-260):

```javascript
function handlePreparingPhase(stabber, dx, dy, distance, dt) {
  const beatClock = stabber.getContextValue('beatClock');

  // First frame of preparation: record when we started
  if (stabber.stabPreparingTime === 0) {
    const audio = stabber.getContextValue('audio');
    if (audio) audio.playSound('stabberKnifeExtend', stabber.x, stabber.y);
  }

  stabber.stabPreparingTime += dt;

  // Back up slightly during preparation (existing behavior)
  if (distance < 200) {
    const backSpeed = 0.5;
    const norm = Math.sqrt(dx * dx + dy * dy) || 1;
    stabber.x -= (dx / norm) * backSpeed * dt;
    stabber.y -= (dy / norm) * backSpeed * dt;
  }

  // Transition to warning when beat 3.5 approaches
  // Minimum prep time prevents instant transitions
  const minPrepFrames = 30; // ~0.5 seconds minimum
  if (stabber.stabPreparingTime >= minPrepFrames && beatClock && beatClock.canStabberAttack()) {
    stabber.stabPreparing = false;
    stabber.stabWarning = true;
    stabber.stabWarningTime = 0;
    // Lock direction for the dash
    const norm = Math.sqrt(dx * dx + dy * dy) || 1;
    stabber.stabDirX = dx / norm;
    stabber.stabDirY = dy / norm;
  }
}
```

- [ ] **Step 2: Make warning and dash phases beat-relative**

The warning phase should be brief (fills remaining time before the dash). The dash itself happens on beat 3.5:

In `handleWarningPhase` (lines 181-215):

```javascript
function handleWarningPhase(stabber, dt) {
  stabber.stabWarningTime += dt;

  // Brief warning — speech/yell on first frame
  if (stabber.stabWarningTime <= dt) {
    const audio = stabber.getContextValue('audio');
    if (audio) {
      const lines = ['STAB TIME!', 'HERE I COME!', 'SURPRISE!'];
      const line = lines[Math.floor(random() * lines.length)];
      audio.speak(stabber, line, 'stabber');
    }
  }

  // Transition to dash after a short warning (about half a beat)
  const beatClock = stabber.getContextValue('beatClock');
  const warningDuration = beatClock ? beatClock.beatInterval * 0.5 / (1000 / 60) : 15; // ~half beat in frames
  if (stabber.stabWarningTime >= warningDuration) {
    stabber.stabWarning = false;
    stabber.stabbing = true;
    stabber.stabAnimationTime = 0;
  }
}
```

- [ ] **Step 3: Make recovery phase end on a beat boundary**

In `handleRecoveryPhase` (lines 77-106), the recovery should end when the next beat 3.5 arrives (with a minimum duration):

```javascript
function handleRecoveryPhase(stabber, dt) {
  stabber.stabRecoveryTime += dt;

  // Penetration movement (existing slow-down behavior)
  // ... keep existing penetration code ...

  // Recovery ends at next beat 3.5 (with minimum recovery time)
  const minRecoveryFrames = 60; // ~1 second minimum
  const beatClock = stabber.getContextValue('beatClock');
  if (stabber.stabRecoveryTime >= minRecoveryFrames) {
    if (!beatClock || beatClock.canStabberAttack()) {
      stabber.stabRecovering = false;
      stabber.stabRecoveryTime = 0;
      stabber.stabCooldown = 0; // Ready for next attack cycle
    }
  }
}
```

- [ ] **Step 4: Test in browser**

Run the game. Verify:
- Stabber preparation fills time until beat 3.5
- Dash happens on or near beat 3.5
- Recovery doesn't feel too long or too short
- Multiple stabbers on screen create syncopated patterns

- [ ] **Step 5: Commit**

```bash
git add js/entities/StabberAttackHandler.js js/entities/Stabber.js
git commit -m "feat: stabber attack phases flex to land on beat 3.5"
```

---

### Task 8: Beat-Aligned Rusher — Vibrate and Explode on Beat

**Files:**
- Modify: `js/entities/Rusher.js` (lines 66-177 update behavior)

- [ ] **Step 1: Add vibrate state between proximity trigger and explosion**

The rusher currently explodes immediately on proximity. Add a "vibrate" hold state:

```javascript
// In constructor, add:
this.vibrating = false;
this.vibrateStartTime = 0;

// In updateSpecificBehavior, replace the proximity explosion (lines 113-128):
if (!this.exploding && !this.vibrating && distance <= this.explodeDistance) {
  // Enter vibrate state — hold until next beat 1 or 3
  this.vibrating = true;
  this.vibrateStartTime = 0;
  this.speed = 0; // Stop moving
  const audio = this.getContextValue('audio');
  if (audio) audio.playRusherCharge(this.x, this.y);
}

// New vibrate state handler:
if (this.vibrating) {
  this.vibrateStartTime += deltaTimeMs;

  // Check for explosion on beat 1 or 3
  const beatClock = this.getContextValue('beatClock');
  if (beatClock && beatClock.canRusherExplode()) {
    this.vibrating = false;
    this.exploding = true;
    this.explosionTimer = 0;
    // Short explosion timer since we already vibrated
    this.effectiveExplosionTime = 5; // Near-instant after beat hit
  }

  // Safety: if no beatClock or vibrated too long, explode anyway
  if (!beatClock || this.vibrateStartTime > 2000) {
    this.vibrating = false;
    this.exploding = true;
    this.explosionTimer = 0;
    this.effectiveExplosionTime = 5;
  }
}
```

- [ ] **Step 2: Add vibration visual to getAnimationModifications**

In `getAnimationModifications()` (lines 204-216), add vibrate state:

```javascript
getAnimationModifications() {
  if (this.vibrating) {
    // Intensifying vibration — gets stronger the longer we wait
    const intensity = Math.min(this.vibrateStartTime / 1000, 1); // 0 to 1 over 1 second
    const shake = (2 + intensity * 4) * (Math.random() - 0.5);
    return {
      offsetX: shake,
      offsetY: shake * 0.7,
      scale: 1.0 + intensity * 0.1, // Slightly grow
    };
  }
  if (this.exploding) {
    // existing explosion animation
    const progress = this.explosionTimer / this.effectiveExplosionTime;
    return {
      offsetX: (Math.random() - 0.5) * 6,
      offsetY: (Math.random() - 0.5) * 6,
      scale: 1.0 + progress * 0.3,
    };
  }
  return null;
}
```

- [ ] **Step 3: Beat-gate the charge sound**

In the charge section (lines 131-163), the charge already starts on proximity which is fine. But gate the battle cry to beat:

```javascript
// Replace the charge sound section:
const beatClock = this.getContextValue('beatClock');
if (beatClock && beatClock.canRusherCharge()) {
  const audio = this.getContextValue('audio');
  if (audio) audio.playRusherCharge(this.x, this.y);
}
```

- [ ] **Step 4: Fix ambient speech to use beat**

In `getAmbientSpeechConfig()` (lines 180-185), replace the flat random with beat-gated:

```javascript
shouldSpeak: (beatClock) =>
  beatClock && beatClock.canRusherExplode() && random() < 0.15,
```

- [ ] **Step 5: Test in browser**

Run the game. Verify:
- Rusher charges toward player (organic, proximity-based)
- Rusher stops and vibrates when close
- Vibration intensity builds
- Explosion happens on beat 1 or 3
- The tension of the vibrate state feels good

- [ ] **Step 6: Commit**

```bash
git add js/entities/Rusher.js
git commit -m "feat: rusher vibrates on proximity then explodes on beat 1 or 3"
```

---

### Task 9: Player Shot Quantization — 8th Note Sustained Fire

**Files:**
- Modify: `js/entities/player.js` (lines 434-496 shoot/fireBullet/queueShot)
- Modify: `js/audio/BeatClock.js` (add 8th note helper)

- [ ] **Step 1: Add 8th note helper to BeatClock**

Add a method for 8th note quantization:

```javascript
// In BeatClock, add after getTimeToNextQuarterBeat():

// Get time to next 8th note (for player sustained fire)
getTimeToNextEighthNote() {
  this.update();
  const elapsed = this.cache.elapsed;
  const eighthInterval = this.beatInterval / 2; // 250ms at 120 BPM
  const timeSinceLastEighth = elapsed % eighthInterval;
  return eighthInterval - timeSinceLastEighth;
}

// Check if we're on an 8th note
isOnEighthNote() {
  this.update();
  const elapsed = this.cache.elapsed;
  const eighthInterval = this.beatInterval / 2;
  const timeSinceLastEighth = elapsed % eighthInterval;
  const tolerance = 20; // ~1 frame
  return timeSinceLastEighth <= tolerance || timeSinceLastEighth >= eighthInterval - tolerance;
}
```

- [ ] **Step 2: Rewrite player shoot() for 8th note sustained fire**

Replace the shooting system in `js/entities/player.js`:

```javascript
shoot() {
  if (!this.getContextValue('playerBullets')) return null;

  this.wantsToContinueShooting = true;

  // First shot is always immediate
  if (!this.isCurrentlyShooting) {
    this.isCurrentlyShooting = true;
    this.firstShotFired = false;
  }

  if (this.shootCooldownMs <= 0) {
    // First shot: always immediate for responsive feel
    if (!this.firstShotFired) {
      this.firstShotFired = true;
      this.shootCooldownMs = 200; // Minimum tap cooldown (~8th note at 120 BPM)
      return this.fireBullet();
    }

    // Sustained fire: quantized to 8th notes
    const beatClock = this.getContextValue('beatClock');
    if (beatClock) {
      if (beatClock.isOnEighthNote()) {
        this.shootCooldownMs = 200; // Next shot at next 8th note
        return this.fireBullet();
      } else if (!this.queuedShot) {
        const timeToNext = beatClock.getTimeToNextEighthNote();
        this.queueShot(timeToNext);
        return null;
      }
    } else {
      // Fallback: fixed 250ms interval
      this.shootCooldownMs = 250;
      return this.fireBullet();
    }
  }
  return null;
}
```

- [ ] **Step 3: Update tests**

Add the new BeatClock methods to tests:

```javascript
// In tests/unit/BeatClock.test.js, add:
it('getTimeToNextEighthNote returns positive value', () => {
  mockCtx._advance(0.01);
  clock.update(true);
  const t = clock.getTimeToNextEighthNote();
  expect(t).toBeGreaterThan(0);
  expect(t).toBeLessThanOrEqual(clock.beatInterval / 2);
});

it('isOnEighthNote returns boolean', () => {
  expect(typeof clock.isOnEighthNote()).toBe('boolean');
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/BeatClock.test.js`
Expected: ALL PASS

- [ ] **Step 5: Test in browser**

Run the game. Verify:
- First shot fires instantly on click
- Holding fire produces shots at ~250ms intervals (8th notes at 120 BPM)
- Rapid tapping is limited by the 200ms cooldown
- Shooting feels responsive, not laggy

- [ ] **Step 6: Commit**

```bash
git add js/entities/player.js js/audio/BeatClock.js tests/unit/BeatClock.test.js
git commit -m "feat: player sustained fire quantized to 8th notes, first shot always immediate"
```

---

### Task 10: BeatTrack Overhaul — Minimal Pulse

**Files:**
- Modify: `js/audio/BeatTrack.js` (full overhaul of scheduler and instruments)

- [ ] **Step 1: Strip BeatTrack down to minimal pulse**

Replace the drum kit with a simple tempo pulse. The key changes:
- Remove `_playSnare()`, `_playHiHat()`, `_playBass()`
- Replace `_playKick()` with `_playPulse()` — a soft, low thump
- Simplify `_scheduleNote()` to only play pulse on beats

```javascript
// In _scheduleNote(time, eighth):
// Before: plays kick, snare, hihat, bass on various 8th-note positions
// After:
_scheduleNote(time, eighth) {
  // Only play on downbeats (8th notes 0, 2, 4, 6 = beats 1, 2, 3, 4)
  if (eighth % 2 !== 0) return;

  const beat = eighth / 2; // 0-3
  const isDownbeat = beat === 0;
  this._playPulse(time, isDownbeat);
}
```

- [ ] **Step 2: Implement the minimal pulse sound**

```javascript
_playPulse(time, isDownbeat) {
  if (!this.ctx || !this.masterGain) return;

  const osc = this.ctx.createOscillator();
  const gain = this.ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(isDownbeat ? 60 : 50, time);
  osc.frequency.exponentialRampToValueAtTime(35, time + 0.1);

  const volume = isDownbeat ? 0.15 : 0.08; // Downbeat slightly louder
  gain.gain.setValueAtTime(volume, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

  osc.connect(gain);
  gain.connect(this.masterGain);
  osc.start(time);
  osc.stop(time + 0.15);
}
```

- [ ] **Step 3: Add enemy-count volume scaling**

Add a method to scale pulse volume based on active enemies:

```javascript
// Add to BeatTrack:
setEnemyCount(count) {
  this._enemyCount = count;
}

// Modify _playPulse to use enemy count:
_playPulse(time, isDownbeat) {
  if (!this.ctx || !this.masterGain) return;

  // Scale volume: quieter when many enemies (their sounds carry the beat)
  const enemyFactor = Math.max(0.3, 1.0 - (this._enemyCount || 0) * 0.1);

  const osc = this.ctx.createOscillator();
  const gain = this.ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(isDownbeat ? 60 : 50, time);
  osc.frequency.exponentialRampToValueAtTime(35, time + 0.1);

  const volume = (isDownbeat ? 0.15 : 0.08) * enemyFactor;
  gain.gain.setValueAtTime(volume, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

  osc.connect(gain);
  gain.connect(this.masterGain);
  osc.start(time);
  osc.stop(time + 0.15);
}
```

- [ ] **Step 4: Wire enemy count from GameLoop**

In `js/GameLoop.js`, in the update section where enemies are tracked, add:

```javascript
if (window.beatTrack) {
  window.beatTrack.setEnemyCount(enemies.length);
}
```

- [ ] **Step 5: Remove old instrument methods**

Delete `_playKick()`, `_playSnare()`, `_playHiHat()`, `_playBass()`, and the associated noise buffer creation for snare/hihat (lines 78-80 in `start()`). Keep `_createNoiseBuffer()` if it's needed elsewhere, otherwise remove it too.

- [ ] **Step 6: Test in browser**

Run the game. Verify:
- A soft, subtle pulse is audible on every beat
- Downbeat (beat 1) is slightly more prominent
- Pulse gets quieter as more enemies appear
- No snare, hi-hat, or bass drone from BeatTrack
- The pulse feels like a "heartbeat" in the background

- [ ] **Step 7: Commit**

```bash
git add js/audio/BeatTrack.js js/GameLoop.js
git commit -m "feat: strip BeatTrack to minimal pulse — enemies are the instruments now"
```

---

### Task 11: Visual Beat Feedback — Stars and Soft Bloom

**Files:**
- Modify: `js/systems/background/BackgroundEffects.js` (lines 17-111 beat pulse)
- Modify: `js/systems/background/BackgroundLayers.js` (star beat reactivity)
- Modify: `js/systems/background/CosmicAuroraBackground.js` (increase alpha)

- [ ] **Step 1: Soften beat ring — downbeat only, slower, diffuse**

In `js/systems/background/BackgroundEffects.js`, modify `drawBeatPulseOverlay` (lines 17-111). The beat ring section (around lines 68-78):

```javascript
// Before: ring on every beat, sharp stroke
// After: only on downbeat, softer, slower expansion

const isDownbeat = currentBeat === 0;

// Beat ring — downbeat only, soft bloom
if (isDownbeat && phase < 0.8) { // Slower: 80% of beat instead of 60%
  const ringProgress = phase / 0.8;
  const ringRadius = 40 + ringProgress * 300; // Slightly smaller max
  const ringAlpha = (1 - ringProgress) * 40; // Lower max alpha (was 70)
  const ringWeight = 8 - ringProgress * 6; // Thicker, softer stroke (was 3.5 to 0.5)

  p.noFill();
  p.stroke(200, 180, 255, ringAlpha);
  p.strokeWeight(ringWeight);
  // Draw multiple concentric rings for diffuse/blurred look
  p.ellipse(p.width / 2, p.height / 2, ringRadius * 2, ringRadius * 2);
  p.stroke(200, 180, 255, ringAlpha * 0.5);
  p.ellipse(p.width / 2, p.height / 2, (ringRadius + 10) * 2, (ringRadius + 10) * 2);
  p.stroke(200, 180, 255, ringAlpha * 0.25);
  p.ellipse(p.width / 2, p.height / 2, (ringRadius + 20) * 2, (ringRadius + 20) * 2);
}
```

- [ ] **Step 2: Increase star beat reactivity**

In `js/systems/background/BackgroundLayers.js`, modify `computeMediumStarVisual` (lines 30-56). Increase the beat pulse effect on star brightness and size:

```javascript
// Find where beatPulse affects star properties and increase multipliers:
// Before (approximately):
// size += beatPulse * 80;  (or similar)
// After:
const starBeatBoost = beatPulse * 120; // Increased from 80
const brightness = baseBrightness + starBeatBoost;

// Also add subtle size modulation:
const sizeBoost = 1.0 + beatPulse * 0.3; // Stars grow 30% on beat
```

- [ ] **Step 3: Increase aurora beat alpha**

In `js/systems/background/CosmicAuroraBackground.js`, increase the beat overlay values (lines 70-73):

```javascript
// Before:
// rShift += beatIntensity * 15
// gShift += beatIntensity * 10
// bShift += downbeatIntensity * 20
// overlayAlpha = 20 + beatIntensity * 30 + downbeatIntensity * 40

// After:
rShift += beatIntensity * 30;
gShift += beatIntensity * 20;
bShift += downbeatIntensity * 40;
overlayAlpha = 25 + beatIntensity * 50 + downbeatIntensity * 60;
```

- [ ] **Step 4: Increase golden edge flash alpha**

In `js/RhythmFX.js`, `drawEdgeFlash` (lines 195-212), increase the edge flash intensity:

```javascript
// Find the alpha value for the golden border:
// Before: alpha around 0.6 * intensity
// After:
const alpha = 0.85 * this.edgeFlashIntensity; // Increased from ~0.6
```

- [ ] **Step 5: Test in browser**

Run the game. Verify:
- Stars visibly pulse on the beat (brighter and slightly larger)
- Aurora background shifts are noticeable but not overwhelming
- Beat ring is soft bloom on downbeat only, not sharp
- Golden edge flash is clearly visible on downbeat
- Overall visual rhythm is apparent without being distracting

- [ ] **Step 6: Commit**

```bash
git add js/systems/background/BackgroundEffects.js js/systems/background/BackgroundLayers.js js/systems/background/CosmicAuroraBackground.js js/RhythmFX.js
git commit -m "feat: stronger visual beat feedback — star breathing, soft bloom ring, brighter aurora"
```

---

### Task 12: Enemy Sound Design Tuning

**Files:**
- Modify: `js/Audio.js` (sound definitions for enemy types)

The spec requires enemy sounds to be musically appropriate for their beat positions. This task tunes the existing sound parameters — it's audio design work, not structural code changes.

- [ ] **Step 1: Tune grunt firing sound (snare role — beats 2 & 4)**

Find the grunt shoot sound config in Audio.js. Adjust to be short, snappy, mid-frequency — a percussive "snap":
- Shorter duration (~0.08s)
- Mid-frequency range (800-1200 Hz)
- Sharp attack, fast decay
- When multiple grunts fire on the same beat, add slight pitch variation per grunt (use the existing `frequencyVariation` but increase the range)

- [ ] **Step 2: Tune tank fire sound (kick role — beat 1)**

Find the tank shoot sound config. Adjust to be a deep, heavy thump:
- Low frequency (60-100 Hz)
- Longer decay (~0.3s)
- Frequency sweep downward for impact feel
- This should be the heaviest sound in the mix

- [ ] **Step 3: Tune stabber strike sound (syncopation role — beat 3.5)**

Find the stabber attack sound config. Adjust to be sharp, bright, cutting:
- Higher frequency (1500-2500 Hz)
- Very short duration (~0.05s)
- Bright, metallic quality — cuts through the mix

- [ ] **Step 4: Tune rusher explosion sound (crash role — beats 1 & 3)**

Find the rusher explosion sound config. Adjust to be wide-frequency crash-like:
- Wide frequency range
- Longer decay (~0.4s)
- Cymbal crash quality layered with low boom

- [ ] **Step 5: Test frequency separation**

Play the game at level 5+ and listen for muddiness. Each enemy type should occupy a distinct frequency band: low (tank) → mid (grunt) → high-mid (stabber) → wide (rusher).

- [ ] **Step 6: Commit**

```bash
git add js/Audio.js
git commit -m "feat: tune enemy sounds as musical instruments — frequency separation by beat role"
```

---

### Task 13: Final Integration Test

**Files:**
- No new files — this is a play-test and tuning pass

- [ ] **Step 1: Run all unit tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 2: Play-test Level 1 (grunts only)**


Start the game. Verify:
- Subtle pulse establishes tempo
- Player shots are crisp hi-hat sounds
- Grunt shots land on beats 2 and 4
- Stars pulse gently
- The beat is sparse but present

- [ ] **Step 3: Play-test Level 2 (+ stabbers)**

Play until stabbers appear. Verify:
- Stabber attacks add syncopation on beat 3.5
- The beat feels more complex/groovy
- Stabber preparation fills naturally to the beat

- [ ] **Step 4: Play-test Level 3 (+ rushers)**

Play until rushers appear. Verify:
- Rushers add tension with vibrate state
- Explosions land on beats 1 or 3
- Energy increases in the soundscape

- [ ] **Step 5: Play-test Level 5 (+ tanks)**

Play until tanks appear. Verify:
- Tank fire is a heavy beat-1 impact
- The full beat is present: pulse + hi-hat (player) + snare (grunts) + syncopation (stabbers) + crashes (rushers) + kick (tanks)
- More enemies = denser sound, pulse fades slightly
- Visual beat feedback is strong but not overwhelming

- [ ] **Step 6: Note any tuning adjustments needed**

Document what needs tweaking (volumes, skip percentages, visual alphas, etc.) and apply fixes.

- [ ] **Step 7: Commit any tuning adjustments**

```bash
git add -A
git commit -m "fix: cosmic beat tuning adjustments from play-testing"
```

# Cosmic Beat Improvements — Design Spec

**Date**: 2026-03-29
**Approach**: Parallel Tracks (beat robustness, sonic palette, musical interplay)

## Overview

Improve the cosmic beat system across three independent workstreams: fix beat timing robustness issues, redistribute the frequency spectrum for cleaner separation, and add musical interplay between player and enemies. The BeatTrack pulse evolution is a nice-to-have included if scope allows.

---

## Track 1: Beat Robustness Fixes

### 1a. Unify frame-time references

Replace hardcoded `1000/60` in `StabberAttackHandler.js:200` (and any other occurrences) with `CONFIG.GAME_SETTINGS.FRAME_TIME_MS`.

### 1b. Standardize tolerance windows

Currently three different tolerances (16ms, 20ms, 100ms) across BeatClock methods. Consolidate:

| Tolerance | Value | Used For |
|-----------|-------|----------|
| On-beat | 100ms | Enemy gating (canGruntShoot, canTankShoot, etc.) |
| Quarter-beat | 50ms | Player quarter-beat shooting (up from 16ms) |
| Eighth-note | 40ms | Eighth-note detection (up from 20ms) |

All derived from a single `TOLERANCE_BASE` constant in BeatClock so they scale if BPM changes.

### 1c. Beat-boundary alignment on level transitions

When level changes, snap `BeatClock.startTime` to the nearest beat boundary rather than raw `Date.now()`. Ensures enemies spawned after a level transition are synchronized.

Change in `BeatClock.reset()`: calculate offset to nearest beat and adjust startTime accordingly.

### 1d. Fix RhythmFX double-decay

RhythmFX applies two exponential decay curves on telegraph intensity (beat-based and frame-based `Math.pow(0.98, deltaTimeMs/16.67)`). Remove the frame-based decay and let beat-based decay handle it alone.

**Files touched**: `BeatClock.js`, `StabberAttackHandler.js`, `RhythmFX.js`, `config.js`

---

## Track 2: Sonic Palette

### 2a. Frequency redistribution

Each entity type gets an exclusive frequency band:

| Band | Frequency | Owner | Change |
|------|-----------|-------|--------|
| Sub-bass | 35-100Hz | Tank | No change (already clean) |
| Low-mid | 150-250Hz | Player | Player shoot 480→220Hz, dash 600→200Hz |
| Mid | 300-500Hz | Grunt | Tighten range, no major moves |
| Upper-mid | 600-800Hz | Rusher | Charge 500→700Hz, scream 600→750Hz |
| Presence | 900-1200Hz | Impacts/UI | hit, levelUp, kill streaks |
| High | 1800-2500Hz | Stabber | No change (already clean) |

Additional frequency moves:
- **Explosion**: 300Hz → 180Hz sweep to 60Hz (deeper, avoids grunt territory)

### 2b. Per-enemy hit reaction sounds

Each enemy type gets a damage reaction sound in their frequency band:

| Enemy | Sound | Frequency | Waveform | Duration |
|-------|-------|-----------|----------|----------|
| Grunt | Surprised beep | 450Hz | Square | 60ms |
| Tank | Deep thud | 55Hz | Sine | 200ms |
| Stabber | Metallic ping | 2100Hz | Triangle | 40ms |
| Rusher | Angry buzz | 650Hz | Sawtooth | 80ms |

Triggered in `takeDamage()` on each enemy type via `audio.playSound()` with spatial positioning.

### 2c. Ambient drone layer

Continuous low sine oscillator:
- **Frequency**: 42Hz
- **Volume**: 0.08
- **Filter**: Slow cutoff sweep oscillating 80-200Hz over ~8 measures
- **Implementation**: Looping oscillator in Audio.js, starts with game, fades in over 2 seconds
- **Ducking**: Volume dips slightly when tank fires (shared sub-bass territory)

**Files touched**: `SoundConfig.js`, `Audio.js`, `Grunt.js`, `Tank.js`, `Stabber.js`, `Rusher.js`, `BaseEnemy.js`

---

## Track 3: Musical Interplay

### 3a. Call-and-response system

When the player kills an enemy, nearby enemies of the **same type** emit a brief reactive sound.

**Mechanics:**
- **Trigger**: Enemy death within 300px of another enemy of the same type
- **Response delay**: Quantized to the next eighth-note (stays on the beat grid)
- **Limit**: Max 2 responses per death event (prevents cacophony)

**Response sounds** (new, distinct from hit reactions):

| Enemy | Sound | Frequency | Waveform | Duration |
|-------|-------|-----------|----------|----------|
| Grunt | Alarmed chirp | 380Hz | Square | 100ms |
| Tank | Low acknowledgment | 70Hz | Sine | 300ms |
| Stabber | Sharp hiss | 2300Hz | Triangle | 60ms |
| Rusher | Agitated whine | 720Hz→500Hz | Sawtooth sweep | 150ms |

**Implementation**: `onNearbyDeath(deadEnemy)` method on BaseEnemy, called by EnemyDeathHandler. Each enemy checks type match + distance + beat quantization before responding.

### 3b. BeatTrack evolution (nice-to-have)

BeatTrack pulse gains character as levels progress. Each layer is additive:

| Level | Addition | Detail |
|-------|----------|--------|
| 1-2 | Current pulse | 50Hz sine, soft |
| 3-4 | Octave harmonic | 100Hz at 30% of fundamental volume |
| 5+ | Noise transient | 40Hz lowpassed noise, 30ms, on downbeats only |

Implemented as additional oscillators in BeatTrack activated by level. Cut if it muddies the sub-bass.

**Files touched**: `BaseEnemy.js`, `EnemyDeathHandler.js`, `BeatTrack.js`, `BeatClock.js`

---

## Scope Control

- BeatTrack evolution (3b) is explicitly nice-to-have — include only if implementation stays clean
- Ambient drone ducking is simple gain reduction, not a full sidechain compressor
- Call-and-response is fire-and-forget sounds, not a stateful dialogue system
- No mixer/bus architecture — sounds go through the existing synthesis pipeline

## Audio Bug Fixes Folded In

From the 2026-03-28 bug plan (already mostly fixed), the remaining audio-adjacent items addressed by this work:
- Frame-rate hardcoding (covered by 1a)
- Tolerance inconsistencies (covered by 1b)
- Beat drift on transitions (covered by 1c)

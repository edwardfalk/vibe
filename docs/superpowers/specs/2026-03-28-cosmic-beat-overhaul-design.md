# Cosmic Beat Overhaul Design Spec

## Overview

The cosmic beat is an emergent musical experience where enemy combat actions create a rhythmic beat that grows organically as the game progresses. Enemies are instruments -- their actions ARE the music. The player shoots freely as a hi-hat element. A minimal background pulse establishes tempo, but the beat is built entirely from gameplay.

The overhaul is split into two phases: **Phase 1** fixes the broken foundation (clock sync, frame-based timers, dead code), **Phase 2** redesigns enemy behavior as musical instruments with beat evolution tied to level progression.

## Phase 1: Fix the Foundation

### 1.1 Clock Unification

**Problem:** BeatClock uses `Date.now()`, BeatTrack uses `AudioContext.currentTime`. These are independent clocks that drift apart over time, causing drum sounds and enemy actions to desync.

**Fix:** Make `AudioContext.currentTime` the single source of truth.

- `BeatClock` constructor takes an `audioContext` parameter
- All internal timing (`getCurrentBeat()`, `getBeatPhase()`, etc.) uses `audioContext.currentTime` instead of `Date.now()`
- `GameLoopSetup` creates the AudioContext first, passes it to both BeatClock and BeatTrack
- The `update()` / cache system stays the same, just reads a different clock
- This also fixes the hitstop freeze issue -- AudioContext keeps running regardless of whether `update()` is called

### 1.2 Dead Code Cleanup

Remove:
- `getBeatReactiveValues()` in BackgroundLayers.js (defined but never called)
- Dead cache threshold logic in CosmicAuroraBackground.js (caches values but always draws regardless)
- Dead `getSpawnRateForLevel()`, `getEnemyCountForLevel()`, `getAvailableTypesForLevel()` in EnemyFactory (duplicates SpawnSystem with different numbers, never called)

### 1.3 Bug Fixes

- **RhythmFX state mutation in draw methods:** `telegraph.intensity *= 0.98` and `telegraph.beatsUntil -= 1/60` mutate state during rendering and are hardcoded to 60fps. Move to update method, use actual deltaTime.
- **Grunt `gruntNoiseTimer`:** Frame-based timer fires off-beat most of the time, wasting attempts. Replace with beat-triggered chance on beats 2 & 4.
- **Stabber `stabChantTimer`:** Same issue. Replace with beat-triggered chance on beat 3.5.
- **Tank anger calm-down speech:** Fires with no beat check. Add beat gate (beat 1).
- **Grunt ambient speech:** Currently 30% chance off-beat (soft gate). Make it beat-only (hard gate on beats 2 & 4).

## Phase 2: Beat Evolution

### 2.1 Beat-Aligned Enemy Timers

All enemy action timing switches from frame-count cooldowns to beat-relative scheduling. Enemies ask BeatClock "is it my turn?" instead of counting frames.

Variety comes from **skipping** beat opportunities (random chance to not fire), not from variable-length frame timers. This keeps everything on-grid while feeling natural.

| Enemy | Current (frame-based) | New (beat-based) |
|-------|----------------------|-------------------|
| **Grunt** | `shootCooldown = 45-75 frames` | Fires on beats 2 & 4. Random skip chance (~40%) replaces variable cooldown. |
| **Tank** | Charge starts beat 1, runs 240 frames, fires whenever | Charge starts beat 1. Duration = exactly 2 measures (8 beats). Fires on next beat 1. |
| **Stabber** | Initiation on 3.5, then frame timers for all phases | Initiation on 3.5. Preparation flexes to fill time until next 3.5. Dash lands on 3.5. Recovery until following 3.5. |
| **Rusher** | Purely proximity-based, no beat | Charge is proximity-triggered (organic). On reaching explode range, enters "vibrate" state. Holds until next beat 1 or 3, then explodes. |

### 2.2 Player Shot Quantization

- **First shot:** Always fires immediately, no delay. Bullet spawns and sound plays on the frame the player presses fire.
- **Sustained fire (holding button):** After the first shot, subsequent shots scheduled on 8th note intervals (250ms at 120 BPM). The fire rate IS the grid.
- **Tap cooldown:** ~200ms minimum between shots. If player taps during cooldown, shot queues and fires at next 8th note.
- **Sound design:** Player shot sound has hi-hat quality -- short, crisp, percussive. First shot = open hi-hat (slightly longer decay), sustained fire = closed hi-hat (tight, clicky).
- **Future hook (not implemented now):** First shots landing on-beat could be flagged for later reward mechanics (bonus damage, score multiplier, visual pop). Infrastructure designed for this but no gameplay effect yet.

### 2.3 BeatTrack Overhaul (Minimal Pulse)

Strip the current full drum kit down to a subtle tempo-establishing pulse:

- Soft, low-frequency tick on every beat -- muted click or quiet kick thump, more felt than heard
- Slightly stronger on beat 1 (downbeat accent) for subconscious measure structure
- Volume scales with enemy count -- nearly silent with no enemies, slightly more present as screen fills
- No snare, no hi-hat, no sub-bass from BeatTrack. Those roles belong to enemies and player.
- Pulse could fade out entirely once enough enemies are present and the emergent beat carries itself.

### 2.4 Enemy Sound Design

Each enemy's sound effects are musically appropriate for their beat position and occupy a distinct frequency band.

**Grunt (beats 2 & 4 -- snare role):**
- Firing sound: Short, snappy, mid-frequency percussive "snap" or "crack"
- Multiple grunts firing on the same beat = natural variation (slightly different pitch/timbre per grunt), not identical stacked sounds

**Tank (beat 1 -- kick drum role):**
- Charge-up: Low rumble building over 2-measure charge, rising in pitch/intensity
- Fire sound: Deep, heavy thump. The bass hit of the beat. Impactful "one" landing.
- Multiple tanks: Take turns across measures (only one fires per beat 1)

**Stabber (beat 3.5 -- syncopation role):**
- Preparation: Rising tonal sound (metallic scrape, blade-draw) filling space to 3.5
- Strike: Sharp, bright, cutting sound. Higher frequency than grunt or tank, cuts through the mix.
- Off-beat placement gives the beat "groove"

**Rusher (beats 1 & 3 -- accent/crash role):**
- Rushing: Building white-noise whoosh while charging
- Vibrate tension: Rapid tremolo/rattle building anxiety
- Explosion: Crash-like burst -- wide frequency, cymbal crash layered with boom

**Frequency separation:** Low (tank) -> mid (grunt) -> high-mid (stabber) -> wide (rusher). No muddiness when all present.

### 2.5 Beat Evolution by Level

The beat grows organically as new enemy types are introduced:

| Level | Enemies Present | Musical Result |
|-------|----------------|----------------|
| **1** | Grunts only | Player hi-hat + grunt snaps on 2 & 4 + subtle pulse. Sparse, minimal. |
| **2** | + Stabbers | Syncopated blade sounds on 3.5 join. Beat gets groove. |
| **3** | + Rushers | Tension builds with rushing whooshes, crash accents on 1 & 3. Energy increases. |
| **5** | + Tanks | Heavy bass boom on 1, charge rumbles. Full beat complete. |

More enemies on screen = denser layers. The beat thickens as difficulty ramps.

### 2.6 Visual Beat Feedback

Visuals tied to beat evolution -- early levels calm, later levels pulse harder.

**Background stars as primary beat visual:**
- Stars breathe with the rhythm -- brighter/larger on downbeat, subtle shift on other beats
- The star field IS the cosmic beat made visible
- Increase beat reactivity so the breathing is clearly perceptible

**Beat ring (downbeat only):**
- Only on beat 1, slower expansion, lower alpha, diffuse/blurred edge
- A gentle "bloom" rather than a sharp circle. Feels like a breath, not a pulse.

**Golden edge flash:** Stays on downbeat, increase alpha from 60% to 80-90%.

**Enemy-driven visuals:**
- Grunt firing: Small muzzle flash on 2 & 4
- Tank firing: Screen shake + brief dark bass-frequency color wash
- Stabber strike: Sharp white slash streak on 3.5
- Rusher explosion: Radial burst synced to beat landing

**Beat evolution visuals:**
- Level 1: Subtle star pulse, mostly calm
- Level 2+: Background aurora color shifts become more pronounced (increase alpha from ~6% to 20-30%)
- Level 5 (full beat): Vignette pulses clearly visible, whole screen breathes with the measure

**Constraints:** No screen-wide strobing, no effects obscuring gameplay. Everything layered in background/edges. Play area stays clean.

**Bug fixes included:**
- Fix RhythmFX frame-rate dependent decay (use actual dt instead of hardcoded 1/60)
- Remove dead cache logic in CosmicAuroraBackground
- Remove dead `getBeatReactiveValues()` code

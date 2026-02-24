# Remaining Refactor Roadmap

This document is the execution plan for everything still left after the aggressive refactor waves completed on 2026-02-24.

It is written for the next stateless AI agent and should be treated as the working source of truth for remaining execution.

## Current Baseline (Observed)

- Architecture migration is partially complete: extracted domain modules exist, but many canonical runtime modules are still rooted under `js/`.
- Smoke gate passes: `bun run test:mcp` (`6 passed`: liveness, game loop, collision API, UI elements, game state, player input).
- Lint gate passes: `bun run lint` (Phase 1 complete).
- Runtime global coupling reduced: CollisionSystem, ExplosionManager, EnemyFactory, SpawnSystem migrated to context; others remain.

## Definition of Done

All items below are considered complete only when:

1. `bun run lint` passes.
2. `bun run test:mcp` passes.
3. No gameplay regression from `docs/NO_REGRESSION_CHECKLIST.md`.
4. `ARCHITECTURE.md` matches actual module locations and ownership.
5. No new module introduces direct `window.*` coupling when context injection is possible.

## Priority Order

1. **Stabilize quality gates** (lint baseline + deterministic checks).
2. **Finish runtime decoupling** (`window.*` -> `GameContext`).
3. **Complete domain migration** for still-rooted canonical modules.
4. **Consolidate `Audio` and remaining orchestrators** without API breakage.
5. **Harden tests and docs** for handoff and regression safety.
6. **Documentation and handoff cleanup** — keep `ARCHITECTURE.md`, `README.md`, and `docs/` synchronized after each migration wave.

---

## Phase 1 - Quality Gate Recovery (High Priority) ✅ COMPLETED 2026-02-24

### Scope

- Eliminate existing lint failures across currently failing files:
  - `js/FloatingTextPool.js`
  - `js/Grunt.js`
  - `js/Rusher.js`
  - `js/Stabber.js`
  - `js/Tank.js`
  - `js/UIRenderer.js`
  - `js/bullet.js`
  - `js/explosions/Explosion.js`
  - `js/explosions/PlasmaCloud.js`
  - `js/explosions/RadioactiveDebris.js`
  - `js/mathUtils.js`
  - `js/shared/contracts/DamageResult.js`
  - `js/visualEffects.js`

### Deliverables

- `bun run lint` returns exit code `0`.
- No behavior changes while fixing formatting/`prefer-const` issues.

### Verification

- `bun run lint`
- `bun run test:mcp`

### Notes

- Prefer mechanical formatting-only edits first, then minimal semantic lint fixes (`prefer-const` etc.).
- Keep this phase isolated from architecture moves to reduce regression blast radius.

---

## Phase 2 - Runtime Decoupling (`window.*` Reduction) 🔄 IN PROGRESS

### Scope

Target modules still showing notable global coupling (priority order):

- `js/GameLoop.js`
- `js/GameState.js`
- `js/CollisionSystem.js` ✅ (wave 1: handleStabberAttack, handleRusherExplosion, hitStopFrames, testMode via context)
- `js/Audio.js`
- `js/BackgroundRenderer.js` ✅ (wave 6: beatClock via context; 5→4 refs)
- `js/player.js` ✅ (wave 10: context; playerBullets, gameState, audio, beatClock via getContextValue)
- `js/SpawnSystem.js` ✅ (wave 4: gameState, enemies, player via getContextValue; 21→0 refs)
- `js/TestMode.js` ✅ (wave 9: all deps via context; 31→0 refs)
- `js/CameraSystem.js` ✅ (wave 6: player via context; 4→1 ref)
- `js/EnemyFactory.js` ✅ (wave 3: audio via context from SpawnSystem)
- `js/Grunt.js` ✅ (wave 10: context via EnemyFactory; beatClock, audio, rhythmFX, collisionSystem, enemies via getContextValue)
- `js/Rusher.js` ✅ (wave 10)
- `js/Tank.js` ✅ (wave 10)
- `js/Stabber.js` ✅ (wave 10)
- `js/RhythmFX.js` ✅ (wave 7: beatClock via context; 4→1 ref)
- `js/visualEffects.js` ✅ (wave 8: beatClock via context; 4→1 ref)
- `js/explosions/ExplosionManager.js` ✅ (wave 2: beatClock, audio via context)
- `js/audio/BeatTrack.js` ✅ (wave 5: audio via context; 5→3 refs, remaining are browser AudioContext API)
- `js/effects.js` ✅ (wave 8: FloatingTextManager beatClock, EnhancedExplosionManager vfx/cam via context; 16→5 refs)
- `js/core/InputHandlers.js`

### Deliverables

- Convert direct global lookups to `GameContext` access where feasible.
- For unavoidable globals, add explicit guard + fallback behavior.
- Update constructors/factories to receive context dependencies instead of pulling globals.

### Verification

- `rg "window\\." js` trend decreases after each wave.
- `bun run test:mcp`
- Manual spot checks from `NO_REGRESSION_CHECKLIST.md` (input, enemy lifecycle, scoring, bomb flow).

---

## Phase 3 - Complete Domain Path Migration

### Scope

Migrate remaining root-level canonical modules into domain folders in staged waves:

- Core systems: `GameState`, `CameraSystem`, `SpawnSystem`, `UIRenderer`, `TestMode`.
- Entity modules: `player`, `BaseEnemy`, `Grunt`, `Rusher`, `Tank`, `Stabber`, `EnemyFactory`, `bullet`.
- Effects/audio support modules still rooted in `js/`.

### Deliverables

- Modules moved to domain-aligned paths (`js/core`, `js/entities`, `js/systems`, `js/effects`, `js/audio`).
- Import graph updated directly (no temporary shim re-exports).
- Entry path behavior unchanged (`js/GameLoop.js` remains boot entry unless intentionally migrated with full import update).

### Verification

- `bun run test:mcp`
- `bun run lint`
- `rg "from './"` checks in moved modules for broken relative imports.
- Browser boot sanity check (`canvas` appears within 30s).

---

## Phase 4 - Audio/Orchestrator Final Consolidation

### Scope

- Finish remaining `Audio` simplification:
  - optional map-based speech wrapper consolidation (`speakPlayerLine`, `speakGruntLine`, etc.).
  - evaluate extracting non-core config blocks (`sounds`, `voiceConfig`) into focused modules.
- Apply same orchestration cleanup style to any remaining large mixed-responsibility modules.

### Deliverables

- `Audio` keeps external API compatibility while internal complexity drops.
- No duplicated logic between orchestrator classes and extracted helper modules.

### Verification

- `bun run test:mcp`
- `bunx eslint js/Audio.js js/audio/*.js`
- Runtime smoke of speech + positional audio behavior.

---

## Phase 5 - Testing and Regression Hardening 🔄 IN PROGRESS

### Scope

- Expand probes beyond current 2-test smoke baseline: ✅ (6 tests: liveness, game loop, collision API, UI elements, game state, player input)
  - player input and movement loop. ✅
  - enemy spawn/damage/death cleanup. (pending)
  - bomb/area damage and game-over flow. (pending)
  - score + kill streak state changes. (partial: UI elements probe)
  - collision diagnostics API availability. ✅

### Deliverables

- New or expanded Playwright probes under `tests/`.
- Regression checklist converted from manual-only to partially automated assertions where practical.

### Verification

- `bun run test:mcp`
- `bun run test:playwright` (full suite)
- Artifact capture remains enabled on failure.

---

## Phase 6 - Documentation and Handoff Cleanup

### Scope

- Keep docs aligned with actual code after each migration wave:
  - `ARCHITECTURE.md` (module inventory + migration state).
  - `README.md` (structure + commands).
  - `docs/TESTING.md` (test commands + gate expectations).
  - `docs/NO_REGRESSION_CHECKLIST.md` (mark/refresh current baselines).

### Deliverables

- No stale module paths in docs.
- Explicit "current known debt" section if any items are intentionally deferred.

### Verification

- Spot-check all documented paths exist.
- Ensure command list matches `package.json` scripts.

---

## Suggested Execution Cadence

- Work in small waves (1-3 files or one subsystem at a time).
- After every wave:
  1. run targeted lint for touched files.
  2. run `bun run test:mcp`.
  3. update `ARCHITECTURE.md` if structure changed.
  4. append results to `docs/NO_REGRESSION_CHECKLIST.md` "Latest Refactor Validation".

## Current Known Debt (2026-02-24)

- **Phase 2 remaining**: GameLoop (~102 refs), GameState (~50 refs), InputHandlers (23 refs, input state intentionally global), and smaller counts in Audio and effects.
- **Phase 3**: Domain path migration not started; modules remain at root.
- **Phase 4**: Audio consolidation (speech wrapper map, config extraction) not started.
- **Phase 5**: Enemy spawn/damage/death and bomb/game-over probes pending.

## Suggested Branch Exit Criteria

Before requesting merge/review:

- Lint green.
- Smoke green.
- No unresolved TODO-level blockers.
- Docs and architecture inventory synchronized.

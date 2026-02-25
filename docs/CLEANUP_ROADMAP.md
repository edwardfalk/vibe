# Cleanup Roadmap

Execution plan for codebase clean-up, refactoring, and file restructuring. Written for the next stateless AI agent.

**Related:** `docs/REMAINING_ROADMAP.md` covers Phase 2 (`window.*` decoupling), Phase 4 (Audio consolidation), and Phase 6 (docs sync). This doc focuses on domain migration, file splits, and structural cleanup.

## Definition of Done (per wave)

- `bun run lint` passes
- `bun run test:mcp` passes
- `docs/NO_REGRESSION_CHECKLIST.md` items verified
- `ARCHITECTURE.md` updated if structure changed

---

## Phase A: Effects Domain Migration ✅ COMPLETED 2026-02-25

**Goal:** Move root-level effects modules into `js/effects/` per `ARCHITECTURE.md`.

### Completed

- `js/effects/FloatingTextPool.js`, `FloatingTextManager.js`, `EffectsManager.js`, `EnhancedExplosionManager.js`, `VisualEffectsManager.js`, `glowUtils.js`
- Barrel `js/effects/index.js`
- Root-level `effects.js`, `visualEffects.js`, `FloatingTextPool.js` removed
- All imports updated; `bun run test:mcp` and `bun run lint` pass

### Previous state (for reference)

| Location                 | Contents                                                                   |
| ------------------------ | -------------------------------------------------------------------------- |
| `js/effects.js`          | EffectsManager, FloatingTextManager, EnhancedExplosionManager (~717 lines) |
| `js/visualEffects.js`    | VisualEffectsManager, `drawGlow` (~500 lines)                              |
| `js/FloatingTextPool.js` | FloatingTextPool class                                                     |
| `js/effects/`            | DashEffect.js, AreaDamageHandler.js                                        |

### Actions

1. **Extract FloatingTextManager + FloatingTextPool**

   - Create `js/effects/FloatingTextManager.js` (FloatingTextManager class)
   - Move `FloatingTextPool` to `js/effects/FloatingTextPool.js` or keep in same file
   - Update imports in `effects.js`, `GameLoop.js`

2. **Extract EnhancedExplosionManager**

   - Create `js/effects/EnhancedExplosionManager.js`
   - Move from `effects.js`; update imports in GameLoop, CollisionSystem, etc.

3. **Move EffectsManager**

   - Create `js/effects/EffectsManager.js` (shake, particles, trails, screen flash)
   - Update imports

4. **Move visualEffects.js**

   - Create `js/effects/VisualEffectsManager.js` and `js/effects/glowUtils.js` (or keep `drawGlow` in VisualEffectsManager)
   - `drawGlow` is used by: bullet.js, BaseEnemy.js, player.js, effects.js, Audio.js — update all imports

5. **Create barrel**

   - `js/effects/index.js` re-exports: EffectsManager, FloatingTextManager, FloatingTextPool, EnhancedExplosionManager, VisualEffectsManager, drawGlow (if extracted)

6. **Remove root-level files**
   - Delete `js/effects.js`, `js/visualEffects.js`, `js/FloatingTextPool.js` after migration

### Verification

- `rg "from '\\.\\./effects\\.js'|from '\\./effects\\.js'|from '\\./visualEffects\\.js'|from '\\./FloatingTextPool\\.js'" js` returns no matches
- All imports use `js/effects/` paths

---

## Phase B: File Size Splits (~500 line guideline)

**Goal:** Split modules that exceed ~500 lines and hold multiple responsibilities.

### Priority order

| File                  | Lines | Suggested split                                                                                 | Status  |
| --------------------- | ----- | ----------------------------------------------------------------------------------------------- | ------- |
| `Stabber.js`          | ~887  | Extract attack logic → `StabberAttackHandler.js` or `combat/StabberAttackHandler.js`            | ✅ Done |
| `Audio.js`            | ~878  | Extract speech wrapper map, config blocks → `js/audio/` helpers (see REMAINING_ROADMAP Phase 4) | ✅ Done |
| `player.js`           | ~673  | Extract `PlayerDash.js`, `PlayerMovement.js` or similar                                         | ✅ Done |
| `UIRenderer.js`       | ~654  | Extract layout/constants → `UILayout.js` or `UIConstants.js`                                    | ✅ Done |
| `Tank.js`             | ~646  | Extract armor/anger logic → `TankArmorHandler.js` (bomb placement in BombSystem)                | ✅ Done |
| `BaseEnemy.js`        | ~570  | Extract shared attack/damage helpers → `BaseEnemyHelpers.js`                                    | ✅ Done |
| `ExplosionManager.js` | ~534  | Consider explosion-type sub-handlers                                                            | ✅ Done |
| `GameLoop.js`         | ~522  | Extract setup phase → `GameLoopSetup.js`, draw phase → `GameLoopDraw.js`                        | ✅ Done |
| `Explosion.js`        | ~514  | Extract particle/shockwave logic into helpers                                                   | ✅ Done |

### Execution notes

- One file per wave; run `bun run test:mcp` after each
- Prefer extraction over moving code between existing files
- Keep enemy constructor signature: `(x, y, type, config, p, audio)` per `.cursorrules`

---

## Phase C: Explosions Consolidation ✅ COMPLETED 2026-02-25

**Goal:** Decide and execute explosions placement.

### Completed

- Moved `js/explosions/*` → `js/effects/explosions/` (ExplosionManager, Explosion, ExplosionConfig, EnemyFragmentExplosion, RadioactiveDebris, PlasmaCloud)
- Updated GameLoopSetup import; `js/explosions/` removed
- `ARCHITECTURE.md` Active Canonical Paths updated

### Previous options (for reference)

1. **Keep `js/explosions/`** — Leave as-is; explosions are a distinct subsystem
2. **Move under effects** — `js/effects/explosions/` (chosen for consistency)

---

## Phase D: Remaining Constants Extraction ✅ COMPLETED 2026-02-25

**Goal:** Replace magic numbers with named constants.

### Completed

- `effects.js`: SHAKE_MAX_DURATION_FRAMES, SCREEN_FLASH_MAX_FRAMES, FLOATING_TEXT_POOL_SIZE, DAMAGE_MERGE_RADIUS
- `GameLoopSetup.js`: CANVAS_WIDTH, CANVAS_HEIGHT
- `UIConstants.js`: UI_PULSE_BASE, UI_ALPHA_MAX
- `Explosion.js`: SHOCKWAVE_ALPHA_SCALE
- `AuroraWisps.js`: AURORA_WISP_BASE_SIZE, AURORA_WISP_MODULATION, AURORA_PHASE_SPEED

### Previous remaining candidates

| Location         | Value                 | Suggested constant                                                             | Status   |
| ---------------- | --------------------- | ------------------------------------------------------------------------------ | -------- |
| `GameLoop.js`    | 800, 600              | `CONFIG.canvasWidth`, `CONFIG.canvasHeight` or `CANVAS_WIDTH`, `CANVAS_HEIGHT` | -        |
| `UIRenderer.js`  | 50, 100 (pulse/alpha) | `UI_PULSE_BASE`, `UI_ALPHA_MAX` (in UIConstants.js)                            | ✅ Done  |
| `Explosion.js`   | 100 (shockwave)       | `SHOCKWAVE_ALPHA_SCALE`                                                        | ✅ Done  |
| `AuroraWisps.js` | 100, 35, 0.006        | `AURORA_BASE_ALPHA`, `AURORA_MODULATION`, `AURORA_PHASE_SPEED`                 | ✅ Done  |

### Execution

- Extract in small batches; prefer `CONFIG` or module-level constants
- Verify no behavior change

---

## Suggested Execution Order

1. **Phase A** — Effects migration (unblocks cleaner structure)
2. **Phase B** — File splits (one file per wave, starting with largest)
3. **Phase D** — Constants (low risk, can run in parallel with B)
4. **Phase C** — Explosions (after Phase A complete)

---

## Cross-References

- `ARCHITECTURE.md` — module inventory, migration rules
- `docs/REMAINING_ROADMAP.md` — Phase 2 window decoupling, Phase 4 Audio, Phase 6 docs
- `docs/NO_REGRESSION_CHECKLIST.md` — mandatory checks per wave
- `.cursorrules` — enemy contracts, timing rules, domain paths

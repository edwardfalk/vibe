# No Regression Checklist

This checklist is the release gate for the aggressive refactor program.

## Baseline Snapshot (2026-02-24)

- `bun run test:mcp`: pass (`2 passed`, runtime ~9s). Immutable baseline.
- Collision metrics probe (`window.collisionSystem.getPerformanceSnapshot()` after boot):
  - `frameSampleSize`: `220`
  - `latestFrame.enemiesAtFrameStart`: `2`
  - `averages.playerBulletChecksPerFrame`: `0`
  - `averages.enemyBulletChecksPerFrame`: `0`

## Latest Refactor Validation (2026-02-25)

- `bun run test:mcp`: pass (`9 passed`, runtime ~29s).
- ESLint on refactored files: pass.
- Domain migration completed for canonical gameplay modules:
  - `js/core/GameState.js`
  - `js/entities/*` (player, enemies, factory, bullet)
  - `js/systems/*` (camera, spawn, UI, background, collision, test mode)
- Added extraction modules for cleanup:
  - `js/systems/combat/PlayerContactHandlers.js`
  - `js/systems/combat/KillFeedback.js`
  - `js/audio/SoundConfig.js`
  - `js/audio/VoiceConfig.js`
  - `js/effects/DashEffect.js`

## Phase 1 Quality Gate Recovery (2026-02-24)

- `bun run lint`: pass (exit code 0).
- `bun run test:mcp`: pass (`2 passed`, runtime ~10.5s).
- Format + ESLint --fix applied to all listed files; no behavior changes.

## Phase 2 Runtime Decoupling Wave 1 (2026-02-24)

- `bun run lint`: pass.
- `bun run test:mcp`: pass (`2 passed`).
- CollisionSystem: handleStabberAttack, handleRusherExplosion, hitStopFrames, testMode migrated to GameContext.
- GameContext: added hitStopFrames, testModeManager to WINDOW_CONTEXT_KEYS.
- CollisionSystem window.\* count: 49 → 2.

## Phase 2 Runtime Decoupling Wave 2 (2026-02-24)

- `bun run lint`: pass.
- `bun run test:mcp`: pass (`2 passed`).
- ExplosionManager: beatClock, audio migrated to GameContext; constructor receives context.
- ExplosionManager window.\* count: 10 → 0.

## Phase 2 Runtime Decoupling Wave 3 (2026-02-24)

- `bun run lint`: pass.
- `bun run test:mcp`: pass (`2 passed`).
- EnemyFactory: audio resolved via context when passed from SpawnSystem.
- SpawnSystem: receives gameContext, passes to EnemyFactory.

## Phase 2 Runtime Decoupling Wave 4 (2026-02-24)

- `bun run lint`: pass.
- `bun run test:mcp`: pass (`2 passed`).
- SpawnSystem: all window refs replaced with getContextValue; gameContext.assign moved before restart for correct array refs.
- SpawnSystem window.\* count: 21 → 0.

## Phase 2 Runtime Decoupling Wave 5 (2026-02-24)

- `bun run lint`: pass.
- `bun run test:mcp`: pass (`2 passed`).
- BeatTrack: audio resolved via context; constructor receives gameContext.
- BeatTrack window.\* count: 5 → 3 (remaining: browser AudioContext API).

## Phase 2 Runtime Decoupling Wave 6 (2026-02-24)

- `bun run lint`: pass.
- `bun run test:mcp`: pass (`2 passed`).
- CameraSystem: player via \_getPlayer() from context; 4→1 ref.
- BackgroundRenderer: beatClock via context; 5→4 refs.

## Phase 2 Runtime Decoupling Wave 7 (2026-02-24)

- `bun run lint`: pass.
- `bun run test:mcp`: pass (`2 passed`).
- RhythmFX: beatClock via \_getBeatClock() from context; 4→1 ref.

## Phase 2 Runtime Decoupling Wave 8 (2026-02-24)

- `bun run lint`: pass.
- `bun run test:mcp`: pass (`2 passed`).
- FloatingTextManager: beatClock via context; EnhancedExplosionManager: visualEffectsManager, cameraSystem via context.
- VisualEffectsManager: beatClock via context; 4→1 ref.
- EnemyUpdatePipeline: in-place splice on context.enemies; 2→0 refs.

## Phase 2 Runtime Decoupling Wave 9 (2026-02-24)

- `bun run lint`: pass.
- `bun run test:mcp`: pass (`5 passed`).
- TestMode: enemies, playerBullets, gameState, audio, cameraSystem, spawnSystem via getContextValue; 31→0 refs.
- GameContext: added spawnSystem to WINDOW_CONTEXT_KEYS.
- GameState: fixed window.testMode → window.testModeManager?.enabled for auto-restart.

## Phase 2 Runtime Decoupling Wave 10 (2026-02-24)

- `bun run lint`: pass.
- `bun run test:mcp`: pass (`6 passed`).
- BaseEnemy: added context param and getContextValue; EnemyFactory passes context.
- Grunt, Rusher, Tank, Stabber: all window refs replaced with getContextValue (beatClock, audio, rhythmFX, collisionSystem, enemies, explosionManager, floatingText, cameraSystem, activeBombs, visualEffectsManager).
- Player: context param; playerBullets, gameState, audio, beatClock via getContextValue.
- TestMode: fixed createEnemy calls to pass this.player?.p.

## Phase 3 & Phase 4 (2026-02-24)

- Phases 3 and 4 were intentionally skipped/merged into Phase 5; no separate validation entries exist for them. Phase 3 originally covered domain path migration (moving modules to `js/core`, `js/entities`, `js/systems`, `js/effects`, `js/audio`); Phase 4 covered Audio/orchestrator consolidation (speech wrapper map, config extraction). These items have been absorbed into Phase 5 and are therefore covered by Phase 5's gate. See "Mandatory Checks Per Refactor Wave" for the validation criteria applied. The audit trail continues at Phase 5.

## Phase 5 Testing Hardening (2026-02-24)

- `bun run test:mcp`: pass (`6 passed`, was 2).
- Probes: liveness, game loop, collision API, score/health UI, game state, player input.
- Smoke baseline expanded from 2 to 6 tests.

## Phase A Effects Migration (2026-02-25)

- `bun run lint`: pass.
- `bun run test:mcp`: pass (`9 passed`).
- Root-level `effects.js`, `visualEffects.js`, `FloatingTextPool.js` migrated to `js/effects/`.
- New modules: FloatingTextPool, FloatingTextManager, EffectsManager, EnhancedExplosionManager, VisualEffectsManager, glowUtils.
- Barrel `js/effects/index.js` re-exports all.
- Imports updated in GameLoop, bullet, BaseEnemy, player, Audio.

## Phase B (skipped)

- Phase B was intentionally skipped/merged: file splits in the Phase B table were completed before Phase C; Phase B table rows are historical and marked Done. No separate Phase B validation entry.

## Phase C Explosions Consolidation (2026-02-25)

- `bun run lint`: pass.
- `bun run test:mcp`: pass (`9 passed`).
- `js/explosions/*` moved to `js/effects/explosions/`.
- GameLoopSetup imports from `./effects/explosions/ExplosionManager.js`.
- ARCHITECTURE.md Active Canonical Paths updated.

## Phase D Constants Extraction (2026-02-25)

- `bun run lint`: pass.
- `bun run test:mcp`: pass (`9 passed`).
- Explosion.js: SHOCKWAVE_ALPHA_SCALE.
- AuroraWisps.js: AURORA_WISP_BASE_SIZE, AURORA_WISP_MODULATION, AURORA_PHASE_SPEED.

## Mandatory Checks Per Refactor Wave

- [ ] `bun run test:mcp` passes.
- [ ] `bun run lint` passes (or only pre-existing unrelated issues remain).
- [ ] Canvas boot succeeds in browser (`canvas` visible within 30s).
- [ ] Player input still works (`WASD`, shoot, arrow keys).
- [ ] Enemy lifecycle intact (spawn, damage, death, cleanup).
- [ ] Scoring and kill streak update correctly on kills and damage taken.
- [ ] Bomb and area damage still apply knockback and game-over correctly.
- [ ] Collision diagnostics API still available:
  - [ ] `window.collisionSystem.getPerformanceSnapshot()`
  - [ ] `window.performanceDiagnostics` populated when enabled

## Refactor-Specific Structural Checks

- [ ] No module in refactor scope hard-crashes if optional systems are absent.
- [ ] Compatibility shims preserve legacy import paths during migration.
- [ ] `window.*` usage reduced for migrated modules (`CollisionSystem`, `Audio`, `AreaDamageHandler`).
- [ ] Damage/death handling goes through shared contract normalization.

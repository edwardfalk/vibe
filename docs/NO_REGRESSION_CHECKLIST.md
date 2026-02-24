# No Regression Checklist

This checklist is the release gate for the aggressive refactor program.

## Baseline Snapshot (2026-02-24)

- `bun run test:mcp`: pass (`2 passed`, runtime ~9s).
- Collision metrics probe (`window.collisionSystem.getPerformanceSnapshot()` after boot):
  - `frameSampleSize`: `220`
  - `latestFrame.enemiesAtFrameStart`: `2`
  - `averages.playerBulletChecksPerFrame`: `0`
  - `averages.enemyBulletChecksPerFrame`: `0`

## Latest Refactor Validation (2026-02-24)

- `bun run test:mcp`: pass (`2 passed`, runtime ~12.5s).
- ESLint on refactored files: pass.

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

## Phase 3 & Phase 4

- Phases 3 and 4 were intentionally skipped/merged into Phase 5; no separate validation entries exist for them. The audit trail continues at Phase 5.

## Phase 5 Testing Hardening (2026-02-24)

- `bun run test:mcp`: pass (`6 passed`, was 2).
- Probes: liveness, game loop, collision API, score/health UI, game state, player input.
- Smoke baseline expanded from 2 to 6 tests.

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

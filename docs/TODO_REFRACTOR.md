# Vibe Refactor – 2025-08-17 Status (Migration Phase 1 complete)

> This file tracked the mid-migration refactor effort that began 2025-08-10.  
> Phase 1 is **now complete**. All ✅ items below are merged and live.  
> New work should move to **docs/ROADMAP_PHASE2.md** (created automatically the first
> time we record Phase 2 items).

| ID                    | Description                                                                                          | Status         |
| --------------------- | ---------------------------------------------------------------------------------------------------- | -------------- |
| remove-legacy-probes  | Delete legacy probe scripts folder `js/` and clean references                                        | ✅ Completed   |
| remove-remote-console | Remove RemoteConsoleLogger module and related loader code                                            | ✅ Completed   |
| consolidate-input     | Consolidate input handling into `InputSystem`                                                        | ✅ Completed   |
| emit-playerChanged    | Ensure `playerChanged` event dispatched on (re)spawn                                                 | ✅ Completed   |
| deterministic-seed    | Deterministic RNG seed via `setRandomSeed`                                                           | ✅ Completed   |
| spatialhash-collision | SpatialHashGrid broad-phase enabled in CollisionSystem                                               | ✅ Completed   |
| split-gameloop        | Refactor `GameLoop.js` into Core/Bootstrap/Dev modules (core pipelines live; legacy code stubs only) | ✅ Completed   |
| split-audio           | Extract SoundPool & AudioDebugger from `Audio.js`                                                    | ⏳ Pending     |
| split-renderers       | Split `UIRenderer.js` & `BackgroundRenderer.js`                                                      | ⏳ Pending     |
| unify-gamestate       | Move arrays into `GameState`; remove window globals                                                  | ✅ Completed   |
| math-consistency      | Run `scan:math`; refine script; replace raw Math/p5 globals                                          | 🚧 In Progress |
| vfx-gc-optim          | Cache colour allocations in VFX to reduce GC                                                         | ⏳ Pending     |
| update-docs           | Update README & docs (probe location, seed workflow, removed ticket system)                          | ✅ Completed   |
| update-rules          | Remove remote console refs; add delete-legacy-probes rule                                            | ⏳ Pending     |
| prune-globals         | Remove unused globals (`speechManager`, `profilerOverlay`)                                           | ⏳ Pending     |
| prune-core-legacy     | Audit `packages/core/src/legacy/` and clean up                                                       | ⏳ Pending     |
| remove-ticket-system  | Remove obsolete Ticket API and tooling; strip env warnings                                           | ⏳ Pending     |

> **Legend** ✅ Done 🚧 In Progress ⏳ Pending

## Dev-Server Issue (still open)

- Observed 404 on `/` and 403 on `/index.html` when serving with Five Server on port 5500.
- Likely cause: Five Server root/SPA/static path rules, not Bun’s built-in server.
- Current workaround: let Playwright manage the server during tests (webServer in `playwright.config.js`).
- To do: standardize on a single root (`.` or `/public`) and adjust Five Server flags; avoid loading from `/node_modules` at runtime.

## Migration Progress Summary (2025-08-16)

- Split Game Loop (✅ Completed)

  - Core wrapper: `packages/game/src/core/GameLoopCore.js` – instance-mode p5, deterministic seed, calls legacy `setup/draw` via imports.
  - Init extraction: `packages/game/src/core/SetupPhases.js` – systems initialization after `setup`.
  - Per-frame orchestration: `packages/game/src/core/UpdateLoop.js` – calls legacy `updateGame/drawGame`, wraps profiler/LOD.
  - Combat ops: `packages/game/src/core/CombatOps.js` – bullets, bombs, collisions.
  - Enemy ops: `packages/game/src/core/EnemyOps.js` – enemy updates, stabber handling, explosion area-damage.
  - Legacy exports: `packages/game/src/GameLoop.js` now exports `updateGame/drawGame`; seed guard added.

- Bootstrap/Dev glue (✅ Completed)

  - Input flags + listeners centralized in `packages/systems/src/InputSystem.js` via `packages/game/src/bootstrap/InputBootstrap.js`.
  - Audio/canvas unlock moved to `packages/game/src/bootstrap/AudioCanvasUnlock.js`.
  - Profiler shortcut + single-action UI keys routed in `packages/game/src/dev/DevShortcuts.js`.
  - Minimal in-page test API: `packages/game/src/dev/TestRunner.js` (used by probes).

- Tests & probes (✅ Completed)

  - Replaced legacy `/js/ai-liveness-probe.js` with `packages/tooling/src/probes/livenessProbe.js`.
  - Playwright config standardized to port 5500; webServer manages Five Server during tests.

- Docs & scripts (✅ Completed)

### 2025-08-16 Additional Notes

- Implemented core update & draw pipelines (`CoreUpdate.js`, `CoreDraw.js`) and set as default.
- All entity/bullet arrays now live inside `GameState`; window globals removed.
- Added `scripts/scan/scan-math.js` (now with baseline + allow-list & strict mode) and npm script `scan:math`. Math-consistency enforcement active in CI.
- Legacy `GameLoop.updateGame/drawGame` reduced to thin wrappers.

#### Known Issues (2025-08-17)

1. Enemies leave pixel artifacts (“dots”) on background after death; investigate VFX cleanup.
2. Level indicator UI disappeared after renderer split; restore in `HudRenderer` (planned).
3. Death-transition shader: replace overlay tint with proper DesaturateShader & vignette.

## Phase 2 Backlog (moved to docs/ROADMAP_PHASE2.md)

This backlog has been relocated. See `docs/ROADMAP_PHASE2.md` for the living list.

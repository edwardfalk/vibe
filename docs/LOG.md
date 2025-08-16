---
title: Vibe Development Log
description: Brief, chronological summary of major tasks completed by AI assistants so other assistants can catch up fast.
status: active
---

## 2025-08-16 18:00 – Split-GameLoop Phase-1

- Background rendering restored (aurora + parallax) after migration of drawing pipeline into `UpdateLoop.drawFrame`.
- Game-over state now freezes world updates; player death correctly triggers `gameState = "gameOver"`.
- Known follow-up: the frozen world transition feels abrupt (looks like a crash). To revisit when polishing game-over UX.

## 2025-08-16 19:10 – CoreUpdateGame Pipeline Added (flag-off)

- Created `CoreUpdate.js` with new modular update pipeline calling extracted systems.
- Wired `UpdateLoop.updateFrame` to use it when `window.__coreUpdateEnabled` is true.
- Legacy update remains default; flip the flag when ready for Phase-2 cleanup.

## 2025-08-16 19:35 – CoreDrawGame Pipeline Added (flag-off)

- Introduced `CoreDraw.js` with modular world drawing (enemies, player, bullets, effects).
- `UpdateLoop.drawFrame` uses new draw when `window.__coreDrawEnabled && window.__coreDrawEnabled` (same flag set controls both update & draw).
- Legacy draw remains fallback until validation.

## 2025-08-16 19:55 – Core Pipelines Default ON

- `UpdateLoop` now calls `coreUpdateGame` and `coreDrawGame` unconditionally; legacy pipelines removed from imports.
- Flags `__coreUpdateEnabled` / `__coreDrawEnabled` no longer required and can be deleted if set.
- Next up: prune legacy code from `GameLoop.js`, update docs & rules, run math consistency scan.

## 2025-08-16 21:10 – Migration wrap-up & open issues

- Core update/draw pipelines default; legacy wrappers slimmed.
- Arrays (`enemies`, `playerBullets`, etc.) moved into GameState; globals removed.
- Added `scripts/scan/scan-math.js` + `scan:math` npm script (initial implementation).
- Outstanding:
  1. Refine scan:math to ignore mathUtils definitions.
  2. Enemies leave dot artifacts after death (cleanup VFX).
  3. Level indicator overlay missing – restore in UIRenderer.
  4. GameOver freeze too abrupt – add nicer transition.

## 2025-08-16 22:30 – RenderPipeline Phase-1 + Global Migration Docs

- Added `packages/systems/src/RenderPipeline.js` and exported via systems barrel; provides ordered renderer plugin system with `LAYERS` constants.
- Registered `backgroundRenderer` (layer 100) via `SetupPhases`; created global `window.renderPipeline`.
- Two new Cursor rules:
  - `a-render-pipeline-contract-20250816-01.mdc` (always-apply render contract)
  - `s-no-tier3-globals-20250816-01.mdc` (forbid new code from touching legacy window arrays).
- Doc `docs/architecture/GlobalMigration.md` created outlining staged removal of Tier-3 globals.
- No behaviour change yet; UpdateLoop still draws background via old path – integrating pipeline in Phase-2.
## 2025-08-17  Death-Transition System & Math Scanner Hardening

**Headline:** Slow-motion limbo on player death, greyscale overlay, enemy friendly-fire, muffled audio; strict math-consistency enforcement.

**Details:**
1. Implemented `DeathTransitionSystem` – activates via `GameState.setGameState('gameOver')`. Handles:
   • timeScale 0.25, greyscale tint, enemies shoot corpse then attack each other, overlay prompt, robust restart.
2. `BeatClock` gains timeScale support; UpdateLoop passes scaled `deltaTime`.
3. Audio system: `applyMuffle()` low-pass + volume scaling.
4. SetupPhases instantiates system; CollisionSystem supports `friendlyFireEnabled`.
5. Math scanner (`scripts/scan/scan-math.js`) now uses allow-list + JSON baseline, `--strict` flag fails CI only on new violations.
6. `docs/TODO_REFRACTOR.md` updated: death-freeze issue resolved; new shader polish task added.

**Result:** Game no longer hard-freezes; post-death experience is immersive. Math standards now enforceable without false positives.

## 2025-08-17  – Desktop Commander Reference Added

- Headline: Fast MCP tooling docs to encourage default use.
- Action: Created `docs/MCP_DESKTOP_COMMANDER_REFERENCE.md` with full function list, params, and Vibe best practices for absolute paths and cmd.exe usage.
- Result: Assistants can default to `search_code` and `read_file` for speed; reduced reliance on slow native readers.
- Next: Add an always-on rule requiring DC tools for search/file ops and a scan to flag native-reader usage in assistants.

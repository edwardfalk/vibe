# Testing

## Test Strategy

- **Unit tests** (Vitest): fast, isolated tests for pure logic modules (math, beat clock, game state, contracts).
- **E2E tests** (Playwright): probe-driven smoke tests against real runtime behavior in a headless browser.
- Keep gameplay tests integrated (no mocked canvas/game loop for the e2e path).
- Use `test-results/` artifacts on failure (screenshots + traces).

## Commands

- `bun run test` — run all tests (e2e + unit).
- `bun run test:e2e` — run Playwright gameplay probes (auto-starts dev server via `playwright.config.js` webServer).
- `bun run test:e2e:headed` — headed Playwright run for visual debugging.
- `bun run test:e2e:debug` — Playwright debug mode with inspector.
- `bun run test:unit` — run Vitest unit tests.
- `bun run test:unit:watch` — run Vitest in watch mode during development.

## E2E Gameplay Probes

1. **Liveness probe** — player alive, enemies present.
2. **Game loop advances** — frame count increases, entities persist.
3. **Collision diagnostics API** — `window.collisionSystem.getPerformanceSnapshot()` returns valid structure.
4. **Score and health UI** — `#score` and `#health` elements present with expected format.
5. **Game state playing** — `gameState.gameState === 'playing'` after boot.
6. **Player input** — W key moves player upward (y decreases).
7. **Enemy lifecycle cleanup** — enemies marked for removal are cleaned from active arrays.
8. **Game-over flow** — explosion damage can transition runtime to `gameOver`.
9. **All enemy types combat** — spawn, damage, and kill grunt/rusher/tank/stabber; draw loop survives.
10. **Bullet collision scoring** — bullet hit kills enemy, awards score and kill count.
11. **Stabber attack handler** — stabber update loop runs 30 frames without crash.
12. **Score + kill streak transitions** — state counters update and reset consistently.

## Unit Tests

| Module | Test file | Coverage |
| --- | --- | --- |
| `js/mathUtils.js` | `tests/unit/mathUtils.test.js` | random, lerp, mapRange, constrain, dist, normalizeAngle |
| `js/audio/BeatClock.js` | `tests/unit/BeatClock.test.js` | BPM, beat phases, timing checks, tempo changes |
| `js/core/GameState.js` | `tests/unit/GameState.test.js` | Score, kills, levels, state transitions, restart |
| `js/core/GameContext.js` | `tests/unit/GameContext.test.js` | get/set/assign, initialization, toObject |
| `js/shared/contracts/DamageResult.js` | `tests/unit/DamageResult.test.js` | normalizeDamageResult, isEnemyDeadResult |

## Configuration

- **Playwright**: `playwright.config.js` — webServer auto-start, screenshots on failure, trace on failure.
- **Vitest**: `vitest.config.js` — scoped to `tests/unit/`.

## Refactor Regression Gate

After each structural refactor wave:

1. `bun run test` (all tests)
2. `bun run lint`
3. Verify `docs/NO_REGRESSION_CHECKLIST.md` items.

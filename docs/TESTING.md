# Testing

## Test Strategy

- Primary gate: probe-driven smoke tests against real runtime behavior.
- Keep gameplay tests integrated (no mocked canvas/game loop for smoke path).
- Use `test-results/` artifacts on failure (screenshots + diagnostics).

## Commands

- `bun run test:mcp` - starts local server and runs `tests/gameplay-probe.test.js` (6 probes).

## Gameplay Probes

1. **Liveness probe** - AI liveness probe; player alive, enemies present.
2. **Game loop advances** - frame count increases, entities persist.
3. **Collision diagnostics API** - `window.collisionSystem.getPerformanceSnapshot()` returns valid structure.
4. **Score and health UI** - `#score` and `#health` elements present with expected format.
5. **Game state playing** - `gameState.gameState === 'playing'` after boot.
6. **Player input** - W key moves player upward (y decreases).
- `bun run test:playwright` - full Playwright run.
- `bun run test:headed` - visual Playwright run.
- `bun run test:debug` - debug-mode Playwright run.

## MCP Smoke Runner

- Entry: `run-mcp-tests.js`.
- Behavior:
  - Picks an available port (`5500+` fallback range).
  - Starts Five Server.
  - Waits for HTTP readiness.
  - Runs Playwright gameplay probes with `GAME_URL`.
  - Shuts down server and returns probe exit code.

## Refactor Regression Gate

Always run after each structural refactor wave:

1. `bun run test:mcp`
2. Targeted lint on changed files.
3. Verify `docs/NO_REGRESSION_CHECKLIST.md` items.

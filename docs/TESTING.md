# Testing

## Test Strategy

- Primary gate: probe-driven smoke tests against real runtime behavior.
- Keep gameplay tests integrated (no mocked canvas/game loop for smoke path).
- Use `test-results/` artifacts on failure (screenshots + diagnostics).

## Commands

- `bun run test:mcp` - starts local server and runs `tests/gameplay-probe.test.js` (9 probes). Primary gate for refactor safety.
- `bun run test:playwright` - runs the full Playwright suite directly.
- `bun run test:headed` - headed Playwright run for visual debugging.
- `bun run test:debug` - Playwright debug mode.

## Gameplay Probes

1. **Liveness probe** - AI liveness probe; player alive, enemies present.
2. **Game loop advances** - frame count increases, entities persist.
3. **Collision diagnostics API** - `window.collisionSystem.getPerformanceSnapshot()` returns valid structure.
4. **Score and health UI** - `#score` and `#health` elements present with expected format.
5. **Game state playing** - `gameState.gameState === 'playing'` after boot.
6. **Player input** - W key moves player upward (y decreases).
7. **Enemy lifecycle cleanup** - enemies marked for removal are cleaned from active arrays.
8. **Game-over flow** - explosion damage can transition runtime to `gameOver`.
9. **Score + kill streak transitions** - state counters update and reset consistently.

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

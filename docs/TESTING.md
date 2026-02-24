# Testing

## Test Strategy

- Primary gate: probe-driven smoke tests against real runtime behavior.
- Keep gameplay tests integrated (no mocked canvas/game loop for smoke path).
- Use `test-results/` artifacts on failure (screenshots + diagnostics).

## Commands

- `bun run test:mcp` - starts local server and runs `tests/gameplay-probe.test.js`.
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

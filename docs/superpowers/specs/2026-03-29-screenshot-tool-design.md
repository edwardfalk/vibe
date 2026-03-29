# Screenshot Tool Design

**Date:** 2026-03-29
**Status:** Approved

## Purpose

A Playwright-based screenshot utility that lets Claude (or a developer) visually inspect the game state after changes. Invoked via `pnpm run screenshot`, it boots the game, optionally fast-forwards to a target level, simulates brief gameplay, and saves a screenshot to a predictable path.

## Invocation

```bash
pnpm run screenshot                  # Boot, wait 2s, capture
pnpm run screenshot -- --level=3     # Fast-forward to level 3
pnpm run screenshot -- --wait=5000   # Wait 5s instead of default 2s
```

## How It Works

1. Reuses existing Playwright config (auto-starts five-server on :5500)
2. Uses the same `bootGame()` pattern from `gameplay-probe.test.js`:
   - `page.goto('/')`
   - Press space to unlock audio and show canvas
   - Wait for `window.gameState`, `window.player`, enemies array populated, `frameCount > 0`
3. If `--level=N`:
   - Injects score via `window.gameState.score` and calls `checkLevelProgression()` in a loop until level matches target
   - Waits for new enemy types to spawn at that level
4. Simulates ~2s of player movement + shooting (WASD keys + space) so the screenshot includes bullets, effects, enemy reactions
5. Takes a full-page screenshot, saves to `tests/screenshots/game-screenshot.png` (overwritten each run)
6. Prints the file path to stdout

## File Location

`tests/screenshot.js` — standalone Playwright test file (uses `test()` but functions as a capture tool)

## npm Script

```json
"screenshot": "npx playwright test tests/screenshot.js --reporter=list"
```

## Design Decisions

- **No new dependencies** — Playwright is already installed
- **Reuses webServer config** — no duplicate server management
- **Fixed output path** — `tests/screenshots/game-screenshot.png`, overwritten each run for easy `Read` tool access
- **Console error capture** — prints browser console errors to help debug issues
- **Always passes** — the script only fails if the game crashes, not on gameplay conditions

## Level Fast-Forward Strategy

Score thresholds drive level progression. To reach level N:
- Set `window.gameState.score` to trigger `checkLevelProgression()` repeatedly
- Wait for `window.gameState.level === N`
- Wait additional time for new enemy types to spawn at that level

## Output

- Screenshot: `tests/screenshots/game-screenshot.png`
- Console: file path + any browser errors encountered

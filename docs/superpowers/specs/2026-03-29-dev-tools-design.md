# Dev Tools Design: Beat Assertions, Playtest Script, Lint Hook

**Date:** 2026-03-29
**Status:** Approved

## Overview

Three developer tools to improve feedback loops when working on the game: beat timing assertions to catch rhythm regressions, a playtest script for performance/gameplay smoke testing, and a pre-commit lint warning hook.

---

## Tool 1: Beat Assertion Helper

### Purpose

Verify that enemy actions (shots, explosions) land on their correct beats within tolerance. Catches rhythm regressions that unit tests (which only test timing math) miss.

### Invocation

```bash
pnpm run test:beats              # Run beat assertion checks (default 8 beats)
BEATS=16 pnpm run test:beats     # Run for 16 beats
```

### How It Works

1. Boots game using same pattern as screenshot tool (goto, unlock audio, wait for systems)
2. Injects a lightweight event recorder into the browser that hooks into enemy action points and logs `{type, enemyType, beatPosition, timestamp}`
3. Runs for N beats (monitoring `beatClock.currentBeat`)
4. Pulls the recorded timeline and asserts:
   - Grunt shots near beats 2 and 4
   - Tank shots near beat 1
   - Stabber actions near beat 3.5
   - Rusher explosions near beats 1 and 3
   - All within tolerances from `CONFIG.BEAT_TOLERANCES`
5. Reports pass/fail with timeline dump on failure

### Architecture

- File: `tests/beat-assertions.js`
- Config: Reuses `playwright.screenshot.config.js` pattern (own config to avoid testIgnore)
- npm script: `test:beats`
- The event recorder is injected via `page.evaluate()` — it monkey-patches the relevant enemy methods to log events, then the original methods are called normally
- Beat positions are captured from `beatClock.getCurrentBeatInMeasure()` at the moment of each action

### Output

- Pass/fail per enemy type with beat position details
- On failure: full timeline dump showing what fired when
- Console output only (no file output needed)

---

## Tool 2: Playtest Script

### Purpose

Automated smoke test + performance probe. Boots the game, plays for a configurable duration with simulated input, and reports FPS stats, entity counts, console errors, and gameplay metrics.

### Invocation

```bash
pnpm run playtest                 # 30s playtest
DURATION=60000 pnpm run playtest  # 60s playtest
```

### How It Works

1. Boots game using same pattern as screenshot tool
2. Simulates continuous gameplay: random WASD movement patterns + shooting
3. Samples game state every 500ms via `page.evaluate()`:
   - Frame count (for FPS calculation)
   - Enemy count (active, not markedForRemoval)
   - Player health
   - Score and level
4. Captures all console errors throughout
5. After duration, computes summary:
   - FPS: min, avg, p95
   - Peak entity count
   - Final score and level
   - Survival: did player die before duration ended?
   - Console error count and list
6. Prints summary to console
7. Saves detailed metrics to `tests/playtest-results.json`

### Architecture

- File: `tests/playtest.js`
- Config: Own Playwright config (`playwright.playtest.config.js`) with extended timeout matching max duration
- npm script: `playtest`
- Input simulation: cycles through movement patterns (not pure random — alternates directions with pauses to look natural)
- Sampling loop runs inside the Playwright test via repeated `page.evaluate()` + `page.waitForTimeout(500)`

### Output

- Console: summary table with FPS stats, entity counts, gameplay metrics, errors
- File: `tests/playtest-results.json` with full sample array and computed stats
- `tests/playtest-results.json` added to `.gitignore`

---

## Tool 3: Lint Warning Hook

### Purpose

Surface lint issues early on every commit without blocking the workflow.

### How It Works

1. Shell script at `.githooks/pre-commit`
2. Runs `npx eslint` on staged `.js` files only
3. Prints any lint issues to stderr
4. Always exits 0 (never blocks the commit)
5. Configured via `git config core.hooksPath .githooks`
6. Setup automated via npm `prepare` script in package.json

### Architecture

- File: `.githooks/pre-commit` (shell script, executable)
- package.json: add `"prepare": "git config core.hooksPath .githooks"` script
- No external dependencies (no husky, no lint-staged)
- Only lints staged `.js` files (uses `git diff --cached --name-only --diff-filter=ACM` filtered to `*.js`)

### Output

- Lint warnings printed inline during commit
- Commit always proceeds regardless of lint results

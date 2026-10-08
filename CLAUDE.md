# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm run dev              # Dev server at localhost:5500
pnpm run test             # Unit tests, then E2E
pnpm run test:unit        # Vitest unit tests
pnpm run test:unit:watch  # Vitest watch mode
pnpm run test:e2e         # Playwright E2E (headless, auto-starts server)
pnpm run test:e2e:headed  # Playwright with visible browser
pnpm run test:beats       # Enemies act on their beats (not in CI)
pnpm run playtest         # Aim-bot plays; reports FPS, ms per frame and pacing
pnpm run compare          # Refactor check: replays main vs working tree, frame by frame
pnpm run screenshot       # Screenshots (screenshot:level for LEVEL=n)
npx eslint "**/*.js"    # Lint (fails on Prettier diffs too)
npx prettier --write "**/*.{js,md,json}"  # Format
```

Single unit test: `npx vitest run tests/unit/BeatClock.test.js`

Always pass `--project` to Playwright (the scripts do); a bare `playwright test` runs all four projects. In a worktree, symlink `node_modules` from the main checkout (`ln -s ../../node_modules node_modules`): the E2E web server runs `node_modules/.bin/five-server` by path. `pnpm run` then refuses the symlink (it tries to install), so run the scripts' own commands there: `npx vitest run`, `npx playwright test --project=e2e`. Set `PORT=5502` for E2E if a dev server may already hold 5500.

## What This Is

A p5.js geometric space shooter where enemy actions sync to musical beats, creating an emergent rhythm that grows as the game progresses. Player held fire snaps to eighth notes (hi-hat), grunts fire on beats 2 & 4 (snare), tanks on beat 1 (kick), stabbers on beat 3.5 (syncopation), rushers explode on 1 & 3 (crash). Under it all a hum, a root note and its fifth drifting like an old analog synth, dips on every beat; `js/audio/Harmony.js` is the pitch grid every tuned sound shares.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md): the game loop, folders, shared state, beat system, audio graph, damage flow, dev tools and known debt. Design intent is in [docs/DESIGN.md](docs/DESIGN.md); the test suites are in [docs/TESTING.md](docs/TESTING.md).

## Level Progression

Score-based, not wave-based: enemies spawn continuously in beat-aligned waves. All numbers live in `CONFIG.PACING`, tunable live with `?tune`. Types come in by level (`ENEMY_INTRO_LEVEL` in `SpawnSystem.js`): grunts at 1, stabbers at 2, rushers at 3, tanks at 5. Each is previewed once per run, halfway through a level, as the next type still to come (the tank at level 3). Details in [docs/DESIGN.md](docs/DESIGN.md).

## Code Style

- ES modules (`"type": "module"` in package.json)
- Prettier: single quotes, `trailingComma: es5` (none in function arguments)
- ESLint: prefer-const, no-var
- World bounds: 1150x850 (`js/config.js`)
- 120 BPM default, 4/4 time, beat interval 500ms
- No magic numbers

## Worktrees

Use `.worktrees/` for feature branches (already in .gitignore).

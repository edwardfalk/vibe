# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm run dev              # Dev server at localhost:5500
pnpm run test             # All tests (E2E + unit)
pnpm run test:unit        # Vitest unit tests
pnpm run test:unit:watch  # Vitest watch mode
pnpm run test:e2e         # Playwright E2E (headless, auto-starts server)
pnpm run test:e2e:headed  # Playwright with visible browser
pnpm run test:beats       # Enemies act on their beats (not in CI)
pnpm run playtest         # Aim-bot plays; reports FPS and pacing
pnpm run screenshot       # Screenshots (screenshot:level for LEVEL=n)
npx eslint "**/*.js"    # Lint
npx prettier --write "**/*.{js,md,json}"  # Format
```

Single unit test: `npx vitest run tests/unit/BeatClock.test.js`

Always pass `--project` to Playwright (the scripts do); a bare `playwright test` runs all four projects. In a worktree, symlink `node_modules` from the main checkout (`ln -s ../../node_modules node_modules`): the E2E web server runs `node_modules/.bin/five-server` by path.

## What This Is

A p5.js geometric space shooter where enemy actions sync to musical beats, creating an emergent rhythm that grows as the game progresses. Player held fire snaps to eighth notes (hi-hat), grunts fire on beats 2 & 4 (snare), tanks on beat 1 (kick), stabbers on beat 3.5 (syncopation), rushers explode on 1 & 3 (crash).

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md): the game loop, folders, shared state, beat system, audio graph, damage flow, dev tools and known debt. Design intent is in [docs/DESIGN.md](docs/DESIGN.md); the test suites are in [docs/TESTING.md](docs/TESTING.md).

## Level Progression

Score-based, not wave-based. Continuous spawning in beat-aligned waves (on any beat, interval in whole beats). All numbers live in `CONFIG.PACING` and are tunable live with `?tune`: level thresholds, wave interval (in beats, shrinking per level), and max enemies (`BASE_MAX_ENEMIES + floor(level/2)`, capped). Enemy introduction (`ENEMY_INTRO_LEVEL` in `SpawnSystem.js`): Level 1 grunts only, Level 2 + stabbers, Level 3 + rushers, Level 5 + tanks. Halfway through each level, one enemy of the next new type appears once per run as a preview.

## Code Style

- ES modules (`"type": "module"` in package.json)
- Prettier: single quotes, trailing commas
- ESLint: prefer-const, no-var
- World bounds: 1150x850 (`js/config.js`)
- 120 BPM default, 4/4 time, beat interval 500ms
- No magic numbers

## Worktrees

Use `.worktrees/` for feature branches (already in .gitignore).

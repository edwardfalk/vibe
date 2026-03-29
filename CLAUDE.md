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
npx eslint "**/*.js"    # Lint
npx prettier --write "**/*.{js,md,json}"  # Format
```

Single unit test: `npx vitest run tests/unit/BeatClock.test.js`

## What This Is

A p5.js geometric space shooter where enemy actions sync to musical beats, creating an emergent rhythm that grows as the game progresses. Player shoots freely (hi-hat), grunts fire on beats 2 & 4 (snare), tanks on beat 1 (kick), stabbers on beat 3.5 (syncopation), rushers explode on 1 & 3 (crash).

## Architecture

**Entry**: `index.html` loads `js/GameLoop.js` via ES module. p5.js runs in instance mode (`p` parameter everywhere, never global).

**Game loop**: `GameLoop.js` orchestrates per-frame updates. `GameLoopSetup.js` initializes all systems. `GameLoopDraw.js` dispatches to playing/paused/gameOver states.

**Shared state**: Systems are on `window.*` and mirrored in `GameContext` (DI container at `js/core/GameContext.js`). Modules use `getContextValue(key)` which checks GameContext first, falls back to window. Key globals: `player`, `enemies`, `playerBullets`, `enemyBullets`, `gameState`, `beatClock`, `audio`, `cameraSystem`, `collisionSystem`, `spawnSystem`.

**Entity system**: `BaseEnemy` is the abstract parent. Grunt, Rusher, Tank, Stabber extend it. Each gets `update(playerX, playerY, dt)` called per frame. Enemies access shared systems via `this.getContextValue(key)`. `EnemyFactory` creates enemies by type string. `SpawnSystem` controls when/what spawns based on level.

**Beat system**: `BeatClock` (`js/audio/BeatClock.js`) is the timing engine, backed by `AudioContext.currentTime`. Enemies check methods like `canGruntShoot()`, `canTankShoot()` before acting. `BeatTrack` (`js/audio/BeatTrack.js`) plays a minimal sub-bass pulse. All enemy timing is beat-relative, not frame-based. Cooldowns use beat-skip probability, not frame counters.

**Damage flow**: `enemy.takeDamage()` returns a raw result -> `normalizeDamageResult()` (`js/shared/DamageResult.js`) -> `handleDamageResult()` (`js/shared/DamageResultHandler.js`) which triggers explosions, audio, score.

**Rendering**: BackgroundRenderer draws layered parallax (aurora, stars, nebula) with beat-reactive intensity. CameraSystem applies smooth follow + screen shake. RhythmFX draws attack telegraphs and beat pulse effects.

**Audio**: `js/Audio.js` handles both synthesized sound effects (`SoundConfig.js`) and TTS speech (`DialogueLines.js`). Sounds are frequency-separated by enemy type: low (tank 60-90Hz), mid (grunt ~950Hz), high (stabber 1800-2400Hz), wide (rusher sweeps).

## Level Progression

Score-based, not wave-based. Continuous spawning. Enemy introduction: Level 1 grunts only, Level 2 + stabbers, Level 3 + rushers, Level 5 + tanks. Spawn rate decreases 8 frames/level (base 180, min 60). Max enemies: `min(2 + floor(level/2), 6)`.

## Code Style

- ES modules (`"type": "module"` in package.json)
- Prettier: single quotes, trailing commas
- ESLint: prefer-const, no-var
- World bounds: 1150x850 (`js/config.js`)
- 120 BPM default, 4/4 time, beat interval 500ms

## Worktrees

Use `.worktrees/` for feature branches (already in .gitignore).

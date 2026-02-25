# Vibe: Cosmic Beat Space Shooter

Vibe is a weird rhythm-driven space shooter built with `p5.js` in instance mode.

Core idea: enemy behavior follows musical timing while player action stays mostly free-form.

The alien enemies are different mixes of evil, psycho, big-baby-cowards, fascists and silly but always entertaining.

## Current State

- Modular JavaScript codebase under `js/`
- Main game entry in `js/GameLoop.js`
- Architecture source of truth in `ARCHITECTURE.md`
- Playable browser build via Five Server
- Smoke testing via Playwright probes in `tests/`
- Project rules in `.cursorrules`

## Documentation

- `ARCHITECTURE.md` - module structure and migration rules
- `.cursorrules` - coding/runtime rules
- `docs/DESIGN.md` - gameplay and beat-system design
- `docs/TESTING.md` - testing strategy and smoke-runner behavior
- `docs/CLEANUP_ROADMAP.md` - effects migration, file splits, constants extraction
- `docs/REMAINING_ROADMAP.md` - window decoupling, Audio consolidation, docs sync
- `docs/for-the-user/README.md` - user-facing docs index

## Quick Start

### 1) Install dependencies

```bash
bun install
```

### 2) Run the game

```bash
bun run dev
```

The game runs at `http://localhost:5500`.

### 3) Run tests

```bash
bun run test:playwright
bun run test:mcp
```

`test:mcp` runs the smoke runner in `run-mcp-tests.js` (server + gameplay probe tests).

## Project Structure

- `js/` - game modules with domain migration folders (`core/`, `systems/`, `entities/`, `audio/`, `effects/`, `shared/`, `testing/`)
- `tests/` - Playwright gameplay probes
- `docs/` - design/audio documentation
- `index.html` - browser entry point
- `run-mcp-tests.js` - smoke probe orchestrator

## Scripts

- `bun run serve` - start Five Server on `5500`
- `bun run dev` - start local game server
- `bun run test:playwright` - run Playwright tests
- `bun run test:headed` - run Playwright tests in headed mode
- `bun run test:debug` - run Playwright tests in debug mode
- `bun run test:mcp` - run smoke test orchestrator
- `bun run test:comprehensive` - run Playwright suite then MCP smoke probes
- `bun run lint` - run ESLint
- `bun run format` - run Prettier
- `bun run clean` - remove install artifacts (`node_modules`, `bun.lockb`)
- `bun run fresh` - clean then reinstall dependencies

## Notes

- This repo currently relies on Bun for scripts. Install Bun first before running commands.
- Keep `.cursorrules` and docs in sync with architecture changes.

## License

MIT

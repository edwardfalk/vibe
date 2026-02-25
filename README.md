# Vibe: Cosmic Beat Space Shooter

Vibe is a weird rhythm-driven space shooter built with `p5.js` in instance mode.

Core idea: enemy behavior follows musical timing while player action stays mostly free-form.

The alien enemies are different mixes of evil, psycho, big-baby-cowards, fascists and silly but always entertaining.

## Current State

- Modular JavaScript codebase under `js/`
- Main game entry in `js/GameLoop.js`
- Architecture source of truth in `ARCHITECTURE.md`
- Playable browser build via Five Server
- E2E testing via Playwright probes + unit testing via Vitest
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
bun run test          # all tests (e2e + unit)
bun run test:e2e      # Playwright gameplay probes (auto-starts server)
bun run test:unit     # Vitest unit tests
```

## Project Structure

- `js/` - game modules with domain migration folders (`core/`, `systems/`, `entities/`, `audio/`, `effects/`, `shared/`, `testing/`)
- `tests/` - Playwright e2e probes + Vitest unit tests
- `docs/` - design/audio documentation
- `index.html` - browser entry point

## Scripts

- `bun run dev` - start local game server on port 5500
- `bun run test` - run all tests (e2e + unit)
- `bun run test:e2e` - run Playwright gameplay probes (auto-starts server)
- `bun run test:e2e:headed` - Playwright in headed mode (visual debugging)
- `bun run test:unit` - run Vitest unit tests
- `bun run test:unit:watch` - Vitest in watch mode
- `bun run lint` - run ESLint
- `bun run format` - run Prettier
- `bun run clean` - remove install artifacts (`node_modules`, `bun.lockb`)
- `bun run fresh` - clean then reinstall dependencies

## Notes

- This repo currently relies on Bun for scripts. Install Bun first before running commands.
- Keep `.cursorrules` and docs in sync with architecture changes.

## License

MIT

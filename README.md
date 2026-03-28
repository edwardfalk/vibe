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

## Quick Start

### 1) Install dependencies

```bash
pnpm install
```

### 2) Run the game

```bash
pnpm run dev
```

The game runs at `http://localhost:5500`.

## License

MIT

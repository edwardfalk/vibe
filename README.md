# Vibe: Cosmic Beat Space Shooter

> **Purpose:**  
> This README provides a project overview, quickstart, and a map to all major documentation.  
> For rules and standards, see `.cursor/rules/`.

## Documentation Map

- [docs/prd/VIBE_CORE_GAME_PRD.md](./docs/prd/VIBE_CORE_GAME_PRD.md): Core game PRD
- [docs/LORE.md](./docs/LORE.md): Narrative flavour & tone
- [docs/PROJECT_VISION.md](./docs/PROJECT_VISION.md): Project vision, design pillars, and development philosophy
- [docs/MCP_PLAYWRIGHT_TESTING_GUIDE.md](./docs/MCP_PLAYWRIGHT_TESTING_GUIDE.md): Automated testing and probe-driven Playwright
- [docs/AUDIO_CONFIGURATION_GUIDE.md](./docs/AUDIO_CONFIGURATION_GUIDE.md): Audio setup and tuning
- [docs/DESIGN.md](./docs/DESIGN.md): Game design and Cosmic Beat System

## Game Definition

Vibe is a fast-paced, top-down space shooter where every entity obeys the “Cosmic Beat”, a global 4/4 rhythm. Players can act at any time, yet enemies perform only on their assigned beats, turning firefights into dynamic, procedurally generated music.

---

## Overview

Vibe’s gameplay, audio, and visuals are all driven by the BeatClock. Enemy behaviour is beat-locked; player actions are free-time. Refer to `docs/prd/VIBE_CORE_GAME_PRD.md` for mechanics and to `docs/LORE.md` for narrative context.

> Future ideas (post-v1.0): timing-bonus weapons, per-level BPM shifts, mobile port.

Built with **p5.js 1.7.0** in instance mode, the project emphasizes clean architecture, maintainability, and multi-AI model compatibility through strict consistency standards.

For the project's core vision, design pillars, and development philosophy, see [`docs/PROJECT_VISION.md`](./docs/PROJECT_VISION.md).

**Technology Stack:**

- **Engine**: p5.js 1.7.0 (migrated from Phaser for better modularity)
- **Architecture**: ES modules with strict dependency injection
- **Development**: Minimal scripts in this branch; prefer simple Bun/Playwright flows
- **Testing**: Probe-driven Playwright

For a detailed explanation of the Cosmic Beat System and musical gameplay, see [`docs/DESIGN.md`](./docs/DESIGN.md).

## Visuals

We want pleasing, interesting slightly psychedelic visuals reflecting the brain of the madman waging this hopeless war. Is it even for real or just going on in a deranged brain.

Enemy kill explosions should look like they belong to the enemy that is killed. Mostly the same color, maybe mixed with whatever color nazi alien blood is. Preferrably it should look like the alien is actually blown to pices. Make them beautiful and violent while keeping the performance hit reasonable enough to keep the game working on a standard laptop with integrated graphics.

Be creative and make it interesting.

Utilize the possibilities of p5 to make dark magic art of the strange universe this takes place in. Use mcp Context7 to get inspiration and crisp code references.

---

## 📁 Project Structure

```
vibe/
├── packages/        # Core, systems, entities, fx, tooling
├── docs/            # Project documentation
├── scripts/         # Utility scripts (env, cleanup, helpers)
├── tests/           # Playwright tests and artifacts
├── index.html       # Game entry
└── package.json     # Scripts and dependencies
```

## Project Structure & Architecture

- **Strict modular architecture:** All new and modular code lives in `packages/` (`core`, `systems`, `entities`, `fx`, `tooling`).
- **No legacy/monolithic files:** Only use modular files under `packages/`.
- **js/** folder is removed. Do not add or reference files under `js/`.
- **Core Systems:** See `packages/systems/` for main systems (GameLoop, GameState, CameraSystem, etc.)
- **Entities:** See `packages/entities/` for Player, BaseEnemy, Grunt, Rusher, Tank, Stabber, EnemyFactory, bullet, etc.
- **Support:** See `packages/core/` for Audio, BeatClock, visualEffects, effects, config, mathUtils, etc.
- **Other:** Probes and debug helpers are in `packages/tooling/`.

> See `.cursor/rules/` for the canonical architecture, coding standards, and best practices.

---

## Issue Tracking

Use the MD document ticketing system.

---

## Development & Testing

- **Dev server**: Server runs on port 5500 (`http://localhost:5500`).
- **Testing**: Probe-driven Playwright tests (see `docs/MCP_PLAYWRIGHT_TESTING_GUIDE.md`).
- **Test mode**: Press 'T' in-game to enable scripted testing.

---

## Coding Standards

- **Simplicity, readability, maintainability, testability, reusability.**
- **Multi-AI Model Compatibility**: Strict consistency standards ensure identical behavior across different AI models.
- Use ES modules (`import`/`export`) with mandatory dependency injection patterns.
- **p5.js Instance Mode**: All drawing functions must use `this.p.` prefix (e.g., `this.p.fill()`, `this.p.ellipse()`).
- Import math functions from `mathUtils.js` instead of using p5.js globals.
- **Constructor Signatures**: All enemy classes use exact signature: `constructor(x, y, type, config, p, audio)`.
- **Console Logging**: All logs must use emoji prefixes (🎮 Game state, 🎵 Audio, 🗡️ Combat, etc.).
- **Timing System**: Use `deltaTimeMs` for frame-independent calculations, normalized to 60fps baseline.
- Use early returns, descriptive names, and clear error handling.
- All code must pass ESLint and Prettier before commit. Run `bun run lint` to check linting and `bun run format:check` to verify Prettier formatting (use `bun run format` to auto-apply fixes).

---

## References

- `docs/PROJECT_VISION.md`: Project vision, design pillars, and development philosophy
- `docs/MCP_PLAYWRIGHT_TESTING_GUIDE.md`: Automated testing guide
- `docs/AUDIO_CONFIGURATION_GUIDE.md`: Audio setup and troubleshooting
- `docs/DESIGN.md`: Cosmic Beat System and musical gameplay design

---

## License

MIT

## Testing

### Playwright Gameplay Probes

```
# Headless
bun run test

# With browser UI
bun run test:headed

# Debug mode
bun run test:debug
```

### Test Artifacts

- **Screenshots**: `test-results/`
- **Bug Reports**: `tests/bug-reports/`
- **Playwright Reports**: `playwright-report/`

### BeatClock Unit Test

Run a lightweight timing check with Bun:

```
bun test tests/beatclock-precision.test.js
```

### Config

- **Game URL**: `http://localhost:5500`
- **Timeout**: 30 seconds per test
- **Retries**: 2 on failure
- **Screenshot on Failure**: Enabled

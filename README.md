# Vibe: Cosmic Beat Space Shooter

> **Purpose:**  
> This README provides a project overview, quickstart, and a map to all major documentation.  
> For rules and standards, see `.cursor/rules/`.

## Documentation Map

- [docs/PROJECT_VISION.md](./docs/PROJECT_VISION.md): Project vision, design pillars, and development philosophy
- [docs/MCP_PLAYWRIGHT_TESTING_GUIDE.md](./docs/MCP_PLAYWRIGHT_TESTING_GUIDE.md): Automated testing and probe-driven Playwright
- [docs/AUDIO_CONFIGURATION_GUIDE.md](./docs/AUDIO_CONFIGURATION_GUIDE.md): Audio setup and tuning
- [docs/DESIGN.md](./docs/DESIGN.md): Game design and Cosmic Beat System

## Overview

Vibe is a rhythm-driven, modular space shooter where every action is synced to the cosmic beat. The beat is made with the beatClock. Sound effects, ambient noise and certain enemy actions happens with the beat. This is not something that should really be noticed when playing and controlling the player other than that the sounds together build the "music" in the game. The stabber, for example, is an enemy that tries to stab you with what from the beginning was a "laser knife" but now is more of a weird beak. The stabber makes a screech when attacking, but the game is made such that the stabber moves slowly near the player until he falls into the correct beat on 3.5 in the 4/4 beat where he can make his dissonant screech (all the other sounds harmonizes) and thereby syncopating the other sounds. Enememies with dark bass sounds act on beat 1 as bass drums, lighter punchy sounds fall in as snares, etc.

The main character is a bizarre mad action hero/antihero that walks around in the middle of outer space blasting aliens that are a strange mix of murderous psychopaths, whiny babies and bumbling idiots. At the same time. The grunts are the simplest enemies, they have a baby-like voice and asks for their mommy and what the password is for the wifi while attacking and trying to kill you. They shoot and try to keep their distance. The stabbers make eerie female psycho noises and make dashing attacks when near. You can dash away yourself or shoot to keep them back. The rushers .. rush. and try to blow themselves up as close to you as possible. The tanks are giants with armor that shoot giant plasma balls that goes straight through both enemies and the player killing them instantly. If you kill a tank they collapse into a plasma cloud that's not healthy at all to enter. If you manage to get close enough to one you place a nuclear time bomb on it and have 3 seconds to get the hell out of there. When the bomb explodes the tank together with the nuke forms a radioactive greenish plasma cloud with particles in it. That cloud is even worse.

The player character fires quickly and makes a quarter note hihat beat. An idea to expand the game with is to have a shotgun power-up that fires more slowly, and you would get a damage bonus if you fire exactly on beat 1. If you keep the button pressed you could fire a little bit faster, but too get the damage bonus you would have to wait a moment longer and fire manually.

Built with **p5.js 1.7.0** in instance mode, the project emphasizes clean architecture, maintainability, and multi-AI model compatibility through strict consistency standards.

For the project's core vision, design pillars, and development philosophy, see [`docs/PROJECT_VISION.md`](./docs/PROJECT_VISION.md).

**Technology Stack:**

- **Engine**: p5.js 1.7.0 (migrated from Phaser for better modularity)
- **Architecture**: ES modules with strict dependency injection
- **Development**: Minimal scripts in this branch; prefer simple Bun/Playwright flows
- **Testing**: Probe-driven Playwright

For a detailed explanation of the Cosmic Beat System and musical gameplay, see [`docs/DESIGN.md`](./docs/DESIGN.md).

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

Use GitHub Issues via the GitHub UI for bugs/features in this branch.

---

## Development & Testing

- **Dev server**: Five Server runs on port 5500 (`http://localhost:5500`).
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
- All code must pass ESLint and Prettier before commit. Run `bun run lint` to check linting and `bun run format` to apply Prettier formatting.

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

### Config

- **Game URL**: `http://localhost:5500`
- **Timeout**: 30 seconds per test
- **Retries**: 2 on failure
- **Screenshot on Failure**: Enabled

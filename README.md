# Vibe: Cosmic Beat Space Shooter

+[![CI Status](https://github.com/edwardfalk/vibe/actions/workflows/ci-dev-server.yml/badge.svg)](https://github.com/edwardfalk/vibe/actions/workflows/ci-dev-server.yml)

> **Purpose:**  
> This README provides a project overview, quickstart, and a map to all major documentation.  
> For rules and standards, see [.cursorrules](./.cursorrules).

## Documentation Map

- [docs/PROJECT_VISION.md](./docs/PROJECT_VISION.md): Project vision, design pillars, and development philosophy
- [.cursorrules](./.cursorrules): Core rules and standards (architecture, coding, workflow)
- [docs/CODERABBIT_COMPLETE_GUIDE.md](./docs/CODERABBIT_COMPLETE_GUIDE.md): Complete CodeRabbit integration with deduplication system
- [docs/TICKETING_SYSTEM_GUIDE.md](./docs/TICKETING_SYSTEM_GUIDE.md): Ticketing system schema and workflow
- [docs/MCP_PLAYWRIGHT_TESTING_GUIDE.md](./docs/MCP_PLAYWRIGHT_TESTING_GUIDE.md): Automated testing and probe-driven Playwright
- [docs/MCP_TOOLS_GUIDE.md](./docs/MCP_TOOLS_GUIDE.md): Advanced MCP tool usage and best practices
- [docs/AUDIO_CONFIGURATION_GUIDE.md](./docs/AUDIO_CONFIGURATION_GUIDE.md): Audio setup and tuning
- [docs/DEV_SERVER_WORKFLOW.md](./docs/DEV_SERVER_WORKFLOW.md): Dev server workflow (cmd.exe default), start/stop/restart/status
- [docs/DESIGN.md](./docs/DESIGN.md): Game design and Cosmic Beat System

## Overview

Vibe is a rhythm-driven, modular space shooter where every action is synced to the cosmic beat. The beat is made with the beatClock. Sound effects, ambient noise and certain enemy actions happens with the beat. This is not something that should really be noticed when playing and controlling the player other than that the sounds together build the "music" in the game. The stabber, for example, is an enemy that tries to stab you with what from the beginning was a "laser knife" but now is more of a weird beak. The stabber makes a screech when attacking, but the game is made such that the stabber moves slowly near the player until he falls into the correct beat on 3.5 in the 4/4 beat where he can make his dissonant screech (all the other sounds harmonizes) and thereby syncopating the other sounds. Enememies with dark bass sounds act on beat 1 as bass drums, lighter punchy sounds fall in as snares, etc.

The main character is a bizarre mad action hero/antihero that walks around in the middle of outer space blasting aliens that are a strange mix of murderous psychopaths, whiny babies and bumbling idiots. At the same time. The grunts are the simplest enemies, they have a baby-like voice and asks for their mommy and what the password is for the wifi while attacking and trying to kill you. They shoot and try to keep their distance. The stabbers make eerie female psycho noises and make dashing attacks when near. You can dash away yourself or shoot to keep them back. The rushers .. rush. and try to blow themselves up as close to you as possible. The tanks are giants with armor that shoot giant plasma balls that goes straight through both enemies and the player killing them instantly. If you kill a tank they collapse into a plasma cloud that's not healthy at all to enter. If you manage to get close enough to one you place a nuclear time bomb on it and have 3 seconds to get the hell out of there. When the bomb explodes the tank together with the nuke forms a radioactive greenish plasma cloud with particles in it. That cloud is even worse.

The player character fires quickly and makes a quarter note hihat beat. An idea to expand the game with is to have a shotgun power-up that fires more slowly, and you would get a damage bonus if you fire exactly on beat 1. If you keep the button pressed you could fire a little bit faster, but too get the damage bonus you would have to wait a moment longer and fire manually.

Built with **p5.js 1.7.0** in instance mode, the project emphasizes clean architecture, maintainability, and multi-AI model compatibility through strict consistency standards.

For the project's core vision, design pillars, and development philosophy, see [`docs/PROJECT_VISION.md`](./docs/PROJECT_VISION.md).

Note: Automated code-review via CodeRabbit runs on Pull Requests. Direct pushes to `unstable` don’t trigger reviews.

**Technology Stack:**

- **Engine**: p5.js 1.7.0 (migrated from Phaser for better modularity)
- **Architecture**: ES modules with strict dependency injection
- **Development**: MCP tools integration for advanced automation
- **Testing**: Probe-driven Playwright with automated bug reporting

The project features a robust ticketing system for all bugs, features, and enhancements, plus advanced MCP tools for memory management, automated testing, and file operations.

For a detailed explanation of the Cosmic Beat System and musical gameplay, see [`docs/DESIGN.md`](./docs/DESIGN.md).

---

## 📁 Project Structure

```
vibe/
├── 📁 packages/                   # All new and modular code (core, systems, entities, fx, tooling)
│   ├── core/                      # Game loop, global state, timing, math utils, config
│   ├── entities/                  # Player, enemies, bullets
│   ├── systems/                   # Camera, spawning, collision, UI, background, test mode
│   ├── fx/                        # Explosions, visual effects, particles
│   └── tooling/                   # Ticket manager, debug logger, Playwright probes
├── 📁 packages/                   # Modular architecture - all game code organized by domain
├── 📁 docs/                       # Documentation
│   ├── archive/                   # Archived documentation
│   └── vision/                    # Project vision documents
├── 📁 scripts/                    # Utility scripts (dev server, probes, docs tooling)
│   └── dev-server.js             # Dev-server orchestrator (start/stop/status)
├── 📁 tests/                      # Testing infrastructure
│   └── bug-reports/               # Bug report storage
├── 🌐 index.html                  # Game entry point
├── (no local Ticket API)         # Ticketing uses GitHub Issues via tooling
└── 📦 package.json                # Dependencies and scripts
```

## Project Structure & Architecture

- **Strict modular architecture:** All new and modular code lives in `packages/` (`core`, `systems`, `entities`, `fx`, `tooling`).
- **No legacy/monolithic files:** Only use modular files listed in `.cursorrules` and under `packages/`.
- **All code is now in `packages/`** following strict modular architecture principles.
- **Core Systems:** See `packages/systems/` for main systems (GameLoop, GameState, CameraSystem, etc.)
- **Entities:** See `packages/entities/` for Player, BaseEnemy, Grunt, Rusher, Tank, Stabber, EnemyFactory, bullet, etc.
- **Support:** See `packages/core/` for Audio, BeatClock, visualEffects, effects, config, mathUtils, etc.
- **Other:** Ticketing, probes, and debug helpers are in `packages/tooling/`.
- **See `packages/` for the full, up-to-date list.**

> **Always consult the latest `.cursorrules` for the single source of truth on architecture, coding standards, and best practices.**

---

## Ticketing System

All work (bugs, features, enhancements, tasks) is tracked in GitHub Issues. Automation is handled by `packages/tooling/src/githubIssueManager.js`. Probes create issues on failures with attached artifacts (screenshots, logs).

Quick notes:

- Probe failures create GitHub Issues automatically via `githubIssueManager`
- You can also script manual issue creation via the same module

See [TICKETING_SYSTEM_GUIDE.md](docs/TICKETING_SYSTEM_GUIDE.md) for details.

---

## Development & Testing

- **Dev server**: Five Server runs on port 5500 (`http://localhost:5500`).
- **Default shell**: cmd.exe. Prefer cmd-friendly commands and Windows paths in all examples.
- **Start dev server with `bun run dev:start`** – idempotent; starts Five Server and waits until READY. If port 5500 is busy, it frees and retries. Hooks run via `.githooks/*.cmd` (install with `bun run hooks:install`).
- **Testing**: Preferred workflow is the deterministic orchestrated script:

```bat
bun run test:orchestrated   # dev:start ➜ tests ➜ dev:stop
```

This replaces direct `bun run test` and avoids flaky port-in-use errors. It also runs prechecks: `scan:consistency` and `validate:sounds` before starting the dev server.
Only probe-driven Playwright tests are allowed (see `docs/MCP_PLAYWRIGHT_TESTING_GUIDE.md`). Remove all manual `.spec.js` tests.

- **Bun single-install requirement**: Ensure ONLY the official Windows installer (`%USERPROFILE%\.bun\bin`) is on your PATH. Remove Scoop or other shims to prevent Starship timeout warnings.
- **Test mode**: Press 'T' in-game to enable scripted testing.
- **Bug-report modal**: Open with 'B' + 'R' or UI button. Keyboard: Enter/Ctrl+Enter = Save, Escape = Cancel.
- **Artifacts**: All screenshots/logs saved in `tests/bug-reports/` and grouped by ticket ID.

---

## Coding Standards

- **Simplicity, readability, maintainability, testability, reusability.**
- **Multi-AI Model Compatibility**: Strict consistency standards ensure identical behavior across different AI models.
- Use ES modules (`import`/`export`) with mandatory dependency injection patterns.
- **p5.js Instance Mode**: All drawing functions must use `this.p.` prefix (e.g., `this.p.fill()`, `this.p.ellipse()`).
- Import math functions from `mathUtils.js` instead of using p5.js globals.
- **Static Guardrails**: Run `bun run scan:consistency` to enforce:
  - Instance-mode compliance (flags unprefixed p5 calls like `fill(`, `ellipse(`, `push()`, ...)
  - Math utilities usage (flags direct `Math.(cos|sin|atan2|sqrt)` in `packages/**`)
  - Also available: `bun run scan:instance`, `bun run scan:math`

### Deterministic Runs

- Use `setRandomSeed(seed)` from `@vibe/core` before starting gameplay to stabilize probes and visuals. Example:
  ```js
  await page.evaluate(() => {
    import('@vibe/core').then(({ setRandomSeed }) => setRandomSeed(1337));
  });
  ```
- **Constructor Signatures**: All enemy classes use exact signature: `constructor(x, y, type, config, p, audio)`.
- **Console Logging**: All logs must use emoji prefixes (🎮 Game state, 🎵 Audio, 🗡️ Combat, etc.).
- **Timing System**: Use `deltaTimeMs` for frame-independent calculations, normalized to 60fps baseline.
- Use early returns, descriptive names, and clear error handling.
- All code must pass ESLint and Prettier before commit. Run `bun run lint` to check linting and `bun run format` to apply Prettier formatting.
- **See `.cursorrules` for complete standards and mandatory patterns.**

---

## Memory Management

- Uses a structured knowledge graph for entities, relations, and observations.
- See `.cursorrules` for workflow and best practices.

---

## Audio & Visuals

- Audio system is modular and beat-synced.
- Visual effects are triggered via a global event-bus system (`EnemyEventBus` + `VFXDispatcher`), ensuring all feedback is modular, testable, and balanced.
- See `docs/DESIGN.md` for a full diagram and explanation of the new VFX system.
- See `docs/AUDIO_CONFIGURATION_GUIDE.md` for setup.

---

## Contributing

- **All changes must follow modular architecture and ticketing workflow.**
- Update `.cursorrules` and this README if architecture or standards change.
- See `.cursorrules` for rules on memory, testing, and coding standards.

---

## CodeRabbit Integration

Vibe includes a comprehensive CodeRabbit review analysis system that captures ALL review data from GitHub:

### Features

- **Complete Review Capture**: Gets general reviews AND line-by-line comments
- **File Context**: Includes exact file paths and line numbers for suggestions
- **Smart Categorization**: Automatically categorizes suggestions (security, bugs, performance, etc.)
- **Priority Analysis**: Identifies high-priority issues requiring immediate attention
- **Structured Data**: Saves comprehensive data to JSON files for analysis
- **Ticket Integration**: Automatically creates tickets for high-priority issues

### Quick Start

```bash
# Get complete CodeRabbit review data (recommended)
bun run coderabbit:cycle

# Or run steps individually:
bun run coderabbit:fetch-complete  # Fetch all review data
bun run coderabbit:analyze         # Display analysis
bun run coderabbit:auto-tickets    # Create tickets
```

### Generated Files

- **`coderabbit-reviews/latest-complete.json`** - Complete review data with context
- **`coderabbit-reviews/latest-summary.json`** - Analysis summary and metrics
- **`coderabbit-reviews/latest-high-priority.json`** - Critical issues for immediate action

### Current Results

- **1,402 total suggestions** extracted from 14 PRs
- **111 high-priority issues** identified (security, bugs, critical fixes)
- **Complete file context** for targeted fixes

For detailed documentation, see [`docs/CODERABBIT_COMPLETE_GUIDE.md`](./docs/CODERABBIT_COMPLETE_GUIDE.md).

---

## References

- `docs/PROJECT_VISION.md`: Project vision, design pillars, and development philosophy
- `.cursorrules`: Core standards and workflow reference
- `docs/TICKETING_SYSTEM_GUIDE.md`: Ticketing system documentation
- `docs/CODERABBIT_COMPLETE_GUIDE.md`: Complete CodeRabbit integration guide with deduplication system
- `docs/MCP_PLAYWRIGHT_TESTING_GUIDE.md`: Automated testing guide
- `docs/AUDIO_CONFIGURATION_GUIDE.md`: Audio setup and troubleshooting
- `docs/DESIGN.md`: Cosmic Beat System and musical gameplay design

---

## License

MIT

## Testing

Vibe uses a comprehensive automated testing system with probe-driven testing and MCP Playwright integration.

### Test Types

1. **Full Orchestrated Probe Suite** – spins up dev environment and runs all Playwright probes deterministically
   ```bash
   bun run test:orchestrated   # dev:start ➜ tests ➜ dev:stop
   ```
2. **Playwright Gameplay Probes (manual options)**

   ```bash
   bunx playwright test            # Headless
   bunx playwright test --headed   # Browser UI
   bunx playwright test --debug    # Debug inspector
   ```

3. **Legacy aliases** `test:mcp`, `test:probes` now point to `test:orchestrated`.

### Probe-Driven Testing

The game uses specialized probe files for different aspects (now located in `packages/tooling/src/probes/`):

- **`ai-liveness-probe.js`** – Basic game state & entity presence
- **`audio-system-probe.js`** – Audio system & beat synchronization
- **`collision-detection-probe.js`** – Collision detection & physics
- **`grunt-knockback-probe.js`** – Grunt enemy knock-back behavior
- **`tank-armor-break-probe.js`** – Tank armor break & explosion flow

Each probe automatically:

- Tests specific game systems
- Captures screenshots on failure
- Creates bug tickets via the ticketing system
- Provides structured diagnostic data

### MCP Playwright Integration

The testing system uses MCP (Model Context Protocol) Playwright tools for:

- Browser automation and control
- JavaScript evaluation in game context
- Screenshot capture and artifact management
- Automated bug reporting integration

### Test Artifacts

Test results and artifacts are saved to:

- **Screenshots**: `test-results/`
- **Bug Reports**: `tests/bug-reports/`
- **Test Reports**: `test-results/mcp-automated-test-report-*.json`
- **Playwright Reports**: `playwright-report/`

### Running Tests in Development

The development server includes automated testing capabilities:

```bash
bun run dev:start   # Start server (idempotent)
bun run dev:status  # Check status
bun run dev:restart # Restart
bun run dev:stop    # Stop server
```

Then in another terminal:

```bash
bun run test:comprehensive  # Run all automated tests

bun run debug:probe         # Game health check
```

### Test Configuration

- **Game URL**: `http://localhost:5500`
- **Test Timeout**: 30 seconds per test
- **Retry Attempts**: 2 retries on failure
- **Screenshot on Failure**: Enabled
- **Automated Bug Reporting**: Enabled

For detailed testing documentation, see:

- [MCP Playwright Testing Guide](docs/MCP_PLAYWRIGHT_TESTING_GUIDE.md)
- [Ticketing System Guide](docs/TICKETING_SYSTEM_GUIDE.md)

## 🆕 Packages Workspace Layout (in progress)

```
packages/
  core/       # Game loop, global state, timing, math utils, config
  entities/   # Player, enemies, bullets
  systems/    # Camera, spawning, collision, UI, background, test mode
  fx/         # Explosions, visual effects, particles
  tooling/    # Ticket manager, debug logger, Playwright probes
```

> **Status:** The full migration from the legacy `/js` monolith to the strict `packages/` workspace is **complete**. All game code now lives in modular workspaces; the old `/js` folder has been removed.

### Documentation & External Library Cache

- Docs link checker skips archived docs under `docs/archive/**`. Keep outdated references there to preserve history without failing CI.
- Rules in `.cursor/rules/*.mdc` are auto-mirrored to `docs-site/rules/` by `scripts/sync-docs-site-rules.js` (run by `bun run docs:serve`).

* **Docs front-matter validation**: GitHub CI runs `bun run scripts/scan-doc-frontmatter.js` to ensure every doc starts with YAML metadata.
* **Context7 cache**: After adding a new dependency, run:

  ```bat
  bun run docs:cache-context7
  ```

  This fetches (or stubs) docs/snippets for the library into `.context7-cache/`.

# Vibe: Cosmic Beat Space Shooter

> **Purpose:**  
> This README provides a project overview, quickstart, and a map to all major documentation.  
> For rules and standards, see [.cursorrules](./.cursorrules).

## Documentation Map
- [.cursorrules](./.cursorrules): Core rules and standards (architecture, coding, workflow)
- [docs/TICKETING_SYSTEM_GUIDE.md](./docs/TICKETING_SYSTEM_GUIDE.md): Ticketing system schema and workflow
- [docs/MCP_PLAYWRIGHT_TESTING_GUIDE.md](./docs/MCP_PLAYWRIGHT_TESTING_GUIDE.md): Automated testing and probe-driven Playwright
- [docs/MCP_TOOLS_GUIDE.md](./docs/MCP_TOOLS_GUIDE.md): Advanced MCP tool usage and best practices
- [docs/AUDIO_CONFIGURATION_GUIDE.md](./docs/AUDIO_CONFIGURATION_GUIDE.md): Audio setup and tuning
- [docs/DESIGN.md](./docs/DESIGN.md): Game design and Cosmic Beat System

## Overview
Vibe is a rhythm-driven, modular space shooter where every action is synced to the cosmic beat. Built with **p5.js 1.7.0** in instance mode, the project emphasizes clean architecture, maintainability, and multi-AI model compatibility through strict consistency standards.

**Technology Stack:**
- **Engine**: p5.js 1.7.0 (migrated from Phaser for better modularity)
- **Architecture**: ES modules with strict dependency injection
- **Development**: MCP tools integration for advanced automation
- **Testing**: Probe-driven Playwright with automated bug reporting

The project features a robust ticketing system for all bugs, features, and enhancements, plus advanced MCP tools for memory management, automated testing, and file operations.

For a detailed explanation of the Cosmic Beat System and musical gameplay, see [`docs/DESIGN.md`](./docs/DESIGN.md).

---

## Project Structure & Architecture
- **Strict modular architecture**: All code is organized by system or entity (see `/js/`).
- **No legacy/monolithic files**: Only use modular files listed in `.cursorrules` and `/js/`.
- **Core Systems**: `GameLoop.js`, `GameState.js`, `CameraSystem.js`, `SpawnSystem.js`, `CollisionSystem.js`, `UIRenderer.js`, `BackgroundRenderer.js`, `TestMode.js`
- **Entities**: `player.js`, `BaseEnemy.js`, `Grunt.js`, `Rusher.js`, `Tank.js`, `Stabber.js`, `EnemyFactory.js`, `bullet.js`
- **Support**: `Audio.js`, `BeatClock.js`, `visualEffects.js`, `effects.js`, `config.js`, `mathUtils.js`
- **Other**: `ticketManager.js`, `ai-liveness-probe.js`
- **See `/js/` for the full, up-to-date list.**

> **Always consult the latest `.cursorrules` for the single source of truth on architecture, coding standards, and best practices.**

---

## Ticketing System
- **All work (bugs, features, enhancements, tasks) is tracked via the modular ticketing system.**
- Tickets are structured JSON files in `tests/bug-reports/`.
- Use `ticketManager.js` and `ticket-api.js` for all ticket management (in-game, admin, automation).
- **See [`docs/TICKETING_SYSTEM_GUIDE.md`](./docs/TICKETING_SYSTEM_GUIDE.md) for full documentation, schema, and workflow.**
- Each ticket must have a unique `id` and specify a `type` (`bug`, `feature`, `enhancement`, `task`).
- Artifacts (screenshots, logs) are grouped per ticket and auto-moved by `move-bug-reports.js`.
- The AI and automated scripts have full access to the ticketing system and bug-report modal.

---

## Development & Testing
- **Dev server**: Five Server runs on port 5500 (`http://localhost:5500`).
- **Backend server**: Runs on port 3001 for ticket API and automation.
- **Start all servers with `npm run dev`** (kills ports 5500/3001 if needed).
- **Testing**: Only probe-driven Playwright tests are allowed (see `docs/MCP_PLAYWRIGHT_TESTING_GUIDE.md`). Remove all manual `.spec.js` tests.
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
- **Constructor Signatures**: All enemy classes use exact signature: `constructor(x, y, type, config, p, audio)`.
- **Console Logging**: All logs must use emoji prefixes (🎮 Game state, 🎵 Audio, 🗡️ Combat, etc.).
- **Timing System**: Use `deltaTimeMs` for frame-independent calculations, normalized to 60fps baseline.
- Use early returns, descriptive names, and clear error handling.
- All code must pass ESLint and Prettier before commit.
- **See `.cursorrules` for complete standards and mandatory patterns.**

---

## Memory Management
- Uses a structured knowledge graph for entities, relations, and observations.
- See `.cursorrules` for workflow and best practices.

---

## Audio & Visuals
- Audio system is modular and beat-synced.
- Visual effects are handled by `visualEffects.js` and `effects.js`.
- See `docs/AUDIO_CONFIGURATION_GUIDE.md` for setup.

---

## Contributing
- **All changes must follow modular architecture and ticketing workflow.**
- Update `.cursorrules` and this README if architecture or standards change.
- See `.cursorrules` for rules on memory, testing, and coding standards.

---

## References
- `.cursorrules`: Core standards and workflow reference
- `docs/TICKETING_SYSTEM_GUIDE.md`: Ticketing system documentation
- `docs/MCP_PLAYWRIGHT_TESTING_GUIDE.md`: Automated testing guide
- `docs/AUDIO_CONFIGURATION_GUIDE.md`: Audio setup and troubleshooting
- `docs/DESIGN.md`: Cosmic Beat System and musical gameplay design

---

## License
MIT

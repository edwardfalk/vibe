# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Vibe is a client-side p5.js browser game with no backend. The single service is a static file dev server (`five-server`) on port 5500.

### Prerequisites

- **Bun** is the required runtime (not pre-installed on cloud VMs). Install via `curl -fsSL https://bun.sh/install | bash`, then ensure `~/.bun/bin` is on `PATH`.
- **Playwright Chromium** must be installed for tests: `bunx playwright install --with-deps chromium`.

### Running the dev server

```bash
bun run dev          # starts five-server on port 5500
```

Game loads at `http://localhost:5500`. If port 5500 is busy, `predev` script kills it automatically.

### Lint / Format / Test

See `package.json` scripts. Key commands:

| Task | Command |
|------|---------|
| Lint | `bun run lint` |
| Format | `bun run format` |
| Playwright tests | `bun run test:playwright` |
| Smoke tests (starts own server) | `bun run test:mcp` |

### Gotchas

- The codebase has ~43 pre-existing ESLint/Prettier formatting errors. `bun run lint` exits non-zero; this is expected.
- `bun run test:mcp` starts its own five-server on an available port (5500+). You can also run `GAME_URL=http://localhost:5500 bunx playwright test tests/gameplay-probe.test.js` against an already-running server.
- `GOOGLE_CLOUD_TTS_API_KEY` in `.env.example` is optional; game runs fine without it.
- There is no build step. The game runs directly from ES module source files served by five-server.
- `bun.test.preload` references `./test-setup.js` which does not exist; `bun test` will warn but this doesn't affect Playwright tests.

---
title: Dev Server Workflow
description: How to start, stop, and troubleshoot the Vibe dev server and Ticket-API pair used by Playwright probes.
tags: [dev-server, workflow, troubleshooting, five-server, ticket-api]
last_updated: 2025-06-29
related_files:
  - scripts/dev-server.js
  - scripts/port-utils.js
  - .github/workflows/ci-dev-server.yml
author: vibe-team
---

# Vibe Dev-Server Workflow

> Reminder: If you change any dev server or Playwright workflow, update this doc AND the relevant .mdc rules to keep everything in sync.

> Canonical guide to starting / stopping the local Five-Server + Ticket-API pair that all Playwright probes depend on.

## Quick-start
```pwsh
# start (idempotent – reuses if already running)
bun run dev:start

# status table
bun run dev:status

# stop
bun run dev:stop

# restart
bun run dev:restart
```

If you just want to run the test suite:
```pwsh
bun run test:orchestrated   # dev:start ➜ tests ➜ dev:stop
```

## How it works
* All logic lives in `scripts/dev-server.js`.
* Ports are read from `packages/core/src/config.js` (`DEV_SERVER_PORT` = 5500, `TICKET_API_PORT` = 3001).
* `port-utils.js` probes the ports, frees strays, and polls HTTP until the service is alive (accepts **any <500** status).
* Child processes are tracked in a `children` Set so `dev:stop` and Ctrl-C kill everything – no leftovers, no port conflicts.

## Troubleshooting
| Symptom | Fix |
|---------|-----|
| `Five-Server failed to become READY` | Another process is bound to 5500; run `bunx kill-port 5500` and retry. |
| Ticket-API health check times out | Make sure no stale Node process is holding 3001; run `bunx kill-port 3001`. |
| Playwright PSReadLine errors | PSReadLine is now disabled in `vibe-powershell-profile.ps1`; open a new terminal. |

### Structured Error Output
If the dev server or Ticket-API fails to start, the script now emits a single-line JSON error via **ErrorReporter**. Example:

```json
{"error":true,"type":"FIVE_SERVER_START_FAILURE","message":"Five-Server failed to become READY","timestamp":"2025-06-29T12:34:56Z","details":{"port":5500}}
```

CI and AI assistants watch for these machine-parseable blocks.

## CI usage
```yaml
- name: Start dev env
  run: bun run dev:start
- name: Playwright
  run: bunx playwright test --reporter=line | cat
- name: Stop dev env
  if: always()
  run: bun run dev:stop
```

Keep all docs and scripts in sync with **ar-dev-server-process-management.mdc**.

---
See also:
- ar-dev-server-process-management.mdc (rule) – implementation details & signals
- .github/workflows/ci-dev-server.yml – CI automation that runs this workflow 
---
title: Dev Server Workflow
description: How to start, stop, and troubleshoot the Vibe dev server used by Playwright probes.
tags: [dev-server, workflow, troubleshooting, five-server]
last_updated: 2025-06-29
related_files:
  - scripts/dev-server.js
  - scripts/port-utils.js
  - .github/workflows/ci-dev-server.yml
author: vibe-team
---

# Vibe Dev-Server & Self-Learning Workflow

> Reminder: If you change any dev server or Playwright workflow, update this doc AND the relevant .mdc rules to keep everything in sync.

> Canonical guide to starting / stopping the local Five-Server that all Playwright probes depend on.

## Quick-start

```bat
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

````bat
bun run test:orchestrated   # dev:start ➜ tests ➜ dev:stop
## Self-Learning (Rules + Autofix + Tuning)

Scripts:

```bat
bun run learn:collect   # capture scans, sounds, orchestrated tests → .ai/ledger/events-YYYYMM.jsonl
bun run learn:propose   # synthesize draft .mdc rules from repeated observations
bun run learn:fix       # conservative autofix (PI/TWO_PI, dist import)
bun run learn:tune "packages/fx/src/effectsConfig.js:global.lodMultiplier"  # nightly tuner
````

CI automation (see .github/workflows):

- ci-learning-daily.yml: collects/proposes and uploads ledger
- ci-learning-autofix.yml: runs conservative autofix, branches, opens PR
- ci-learning-tune.yml: runs tuners, uploads reports, opens PR

Rule: `.cursor/rules/a-self-learning-system-policy-20250812-01.mdc` documents the policy and scope.

````

Navigation standard in tests:

- Use `gotoIndex(page)` from `tests/playwright.setup.js` instead of raw `page.goto(INDEX_PAGE)` to deflake navigation (waits for `domcontentloaded`).

## How it works

- All logic lives in `scripts/dev-server.js`.
- Port is read from `packages/core/src/config.js` (`DEV_SERVER_PORT` = 5500).
- `port-utils.js` probes the ports, frees strays, and polls HTTP until the service is alive (accepts **any <500** status).
- Child processes are tracked in a `children` Set so `dev:stop` and Ctrl-C kill everything – no leftovers, no port conflicts.

## Troubleshooting

| Symptom                              | Fix                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------- |
| `Five-Server failed to become READY` | Another process is bound to 5500; run `bunx kill-port 5500` and retry. |

| Playwright PSReadLine errors | PowerShell-specific; default shell is cmd.exe so this should not occur. If using PowerShell, disable PSReadLine or use cmd.exe for test runs. |

### Structured Error Output

If the dev server or Ticket-API fails to start, the script now emits a single-line JSON error via **ErrorReporter**. Example:

```json
{
  "error": true,
  "type": "FIVE_SERVER_START_FAILURE",
  "message": "Five-Server failed to become READY",
  "timestamp": "2025-06-29T12:34:56Z",
  "details": { "port": 5500 }
}
````

CI and AI assistants watch for these machine-parseable blocks.

## CI usage

```yaml
- name: Start dev env
  run: bun run dev:start
- name: Playwright
  run: bunx playwright test --reporter=line
- name: Stop dev env
  if: always()
  run: bun run dev:stop
```

Keep all docs and scripts in sync with **ar-dev-server-process-management.mdc**.

---

See also:

- ar-dev-server-process-management.mdc (rule) – implementation details & signals
- .github/workflows/ci-dev-server.yml – CI automation that runs this workflow

# MCP Playwright Testing Guide for AI & Automation

> Note (2025-08-15): MCP Playwright tools are not currently enabled in this workspace. Tests run via native Playwright CLI (`bunx playwright`). Use the workflows below conceptually, but execute with the CLI for now.

> **Purpose:**  
> This guide explains probe-driven Playwright testing, liveness probes, and how to minimize confusion and maximize diagnostic value.

## Introduction

This guide explains how to use Playwright for robust, AI-driven testing of the Vibe game. It covers best practices, liveness/heartbeat probes, custom scenario checks, and diagnostics.

---

## Why Playwright?

- **Full browser control**
- **Custom JavaScript evaluation**: Inspect any in-game variable, simulate input, and trigger screenshots
- **Structured, actionable results**: Go beyond console logs and UI checks
- **Screenshots on failure**: Visual context for debugging

---

## Automated Liveness & Entity Probes: Failure Handling and Diagnostics

- All probe-driven tests should include:
  - A liveness probe (draw loop, frameCount, gameState).
  - An entity probe (player and at least one enemy present and visible).
- If the player or all enemies disappear, or the game becomes unresponsive:
  - Take a screenshot of the canvas and UI.
  - Log the current state of player, enemies, and gameState.
  - Record the time/frame of failure.
    See [packages/tooling/src/probes/livenessProbe.js](../packages/tooling/src/probes/livenessProbe.js) for the canonical probe.

### Bug Reporting for Probe Failures

- Track failures via GitHub Issues (manual creation in this branch).

---

## Core Concepts

### Liveness/Heartbeat Probe

- Ensures the game is truly running (not just error-free)
- Checks: game loop, player, enemies, BeatClock, audio
- Example probe: [`packages/tooling/src/probes/livenessProbe.js`](../packages/tooling/src/probes/livenessProbe.js)

---

## Standard Testing Workflow

1. Navigate to `http://localhost:5500`
2. Run the liveness/heartbeat probe
3. Interpret the results and capture screenshots on failure
4. Run scenario-specific probes or actions
5. File a GitHub Issue if failures persist

---

## Best Practices

- Always run a liveness/heartbeat probe before and after scenario tests
- Use structured result objects for all probes
- Trigger screenshots for critical failures or edge cases
- Document what each probe checks and what failures mean

---

## Troubleshooting

- If a probe returns a failure, review the returned object and screenshot
- If BeatClock is not ticking, check game initialization and timing
- Extend probes for new systems as needed

---

## Reference: Example Probes

- **Liveness/heartbeat:** [`packages/tooling/src/probes/livenessProbe.js`](../packages/tooling/src/probes/livenessProbe.js)
- **Enemy AI probe:** Check enemy count, types, and behaviors
- **Audio system probe:** Check audio context, sound playback, TTS
- **UI/score probe:** Check score, health, and UI elements

---

## See Also

- [README.md](../README.md) (Quick Start)
- [tests/](../tests/) (All Playwright tests should be probe-driven)

- The standard dev server is Five Server, running on http://localhost:5500
- All Playwright tests should target port 5500

## Monitoring Desktop Commander MCP

Desktop Commander powers critical workspace tools (file operations, process management). A lightweight health-check script is provided so you can keep an eye on its status during long hacking sessions or CI runs.

```cmd
bun run monitor:dc
```

This starts `scripts/monitor/desktopCommanderHealth.js`, which every 60 s:

1. Searches the Windows task list for a process whose command-line contains `desktop-commander`.
2. Sends an HTTP GET to `http://127.0.0.1:4333/get_config` to ensure the JSON API responds within 3 s.
3. Appends the result as a JSON line to `.debug/desktop-commander-health.log` (auto-rotates at 5 MB).

Example log entry:

```json
{
  "ts": "2025-08-16T12:34:56.789Z",
  "procFound": true,
  "ok": true,
  "latency": 42
}
```

Flags:

- `--interval <sec>` (default 60)
- `--port <number>` (default 4333 – matches `c:\Users\edwar\.cursor\mcp.json`)
- `--iterations <n>` (stop after _n_ runs, useful in CI)

Tail the log in a separate terminal:

```cmd
type .debug\desktop-commander-health.log
```

For 24/7 monitoring, import the script into Windows Task Scheduler (trigger: “At startup”, action: `bun run monitor:dc`).

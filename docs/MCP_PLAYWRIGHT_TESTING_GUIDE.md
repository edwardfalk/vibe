# MCP Playwright Testing Guide for AI & Automation

> Reminder: If you change any Playwright or probe workflow, update this doc AND the relevant .mdc rules to keep everything in sync.

---

**[2025-06-27] Modular Migration Complete**

- All modular migration steps, import map fixes, and Playwright/browser probes now pass.
- No missing module, duplicate declaration, or fatal runtime errors remain.
- The game and all systems load and run in the browser, with all core mechanics and liveness checks passing.
- See the archived roadmap for migration history and details.

---

> **Purpose:**  
> This guide explains probe-driven Playwright testing, liveness probes, and bug report automation.  
> For rules, see [.cursorrules](../.cursorrules).

## Introduction

This guide explains how to use MCP Playwright for robust, AI-driven testing of the Vibe game. It covers best practices, liveness/heartbeat probes, custom scenario checks, and how to minimize confusion and maximize diagnostic value.

---

## Why MCP Playwright?

- **Full browser control for AI/agents**
- **Custom JavaScript evaluation**: Inspect any in-game variable, simulate input, and trigger screenshots
- **Structured, actionable results**: Go beyond console logs and UI checks
- **Screenshots on failure**: Visual context for debugging

---

## Automated Liveness & Entity Probes: Failure Handling and Diagnostics (Current Probe Set)

- All probe-driven tests must include:
  - A liveness probe (draw loop, frameCount, gameState).
  - An entity probe (player and at least one enemy present and visible).
- If the player or all enemies disappear, or the game becomes unresponsive:
  - Take a screenshot of the canvas and UI.
  - Log the current state of player, enemies, and gameState.
  - Record the time/frame of failure.
- This workflow is mandatory for all MCP Playwright tests.
- Current liveness probe implementation: [`js/ai-liveness-probe.js`](js/ai-liveness-probe.js)

### Automated Bug Reporting for Probe Failures

- **All probe-driven failures are now automatically reported as tickets via the API.**
- The liveness probe and any future probe scripts should, on failure, create a bug ticket using the githubIssueManager API (`packages/tooling/src/githubIssueManager.js`).
- The ticket includes a concise ID, title, failure description, timestamp, probe state, and (if available) a screenshot as an artifact.
- This ensures all probe/test failures are captured in the modular, metadata-rich ticketing system—no manual intervention required.
- **Standard:** All new probe scripts must use the githubIssueManager API for bug reporting on failure.

---

## Core Concepts

### Liveness/Heartbeat Probe

- Ensures the game is truly running (not just error-free)
- Checks: game loop, player, enemies, BeatClock, audio
- Example probe: [`js/ai-liveness-probe.js`](js/ai-liveness-probe.js)
- **Current probe behavior:**
  - The probe always reports the current game state (`gameState`, `isGameOver`).
  - If the game is at the 'game over' screen, it reports this, triggers a diagnostic screenshot, and skips further liveness checks.
  - If the game is running, it checks core liveness (loop, player, enemies, BeatClock, audio) and triggers screenshots on critical failures.
  - This documentation is intentionally high-level to allow for future improvements.

### mcp_playwright_playwright_evaluate

- Runs any JavaScript in the game's browser context
- Returns structured results for AI/agent analysis

### Screenshots on Failure

- Triggered automatically by probes on critical failure or edge cases
- Helps diagnose "silent failures" and edge conditions

---

## Standard AI Testing Workflow

1. **Navigate to the game**
   - Use `mcp_playwright_playwright_navigate` to load http://localhost:5500
2. **Run the liveness/heartbeat probe**
   - Load and run `js/ai-liveness-probe.js` using `mcp_playwright_playwright_evaluate`
3. **Interpret the results**
   - If any check fails, review the returned object and screenshots
4. **Run scenario-specific probes or actions**
   - Use additional custom JS probes for deeper checks (enemy AI, UI, etc.)
5. **Report structured results**
   - Prefer objects with clear keys (not just pass/fail or logs)

---

## Example: Running the Liveness Probe

```js
// Load the probe script as a string (Node.js example)
const fs = require('fs');
const probeScript = fs.readFileSync('js/ai-liveness-probe.js', 'utf8');

// Use MCP Playwright to evaluate
const result = await mcp_playwright_playwright_evaluate({
  script: probeScript,
});

// Check results
if (!result.frameCountIncreased) {
  // Handle error, review screenshot
}
if (result.moveBlockedByEdge) {
  // Player was at edge; not a bug, but may need to reset position for further tests
}
```

---

## Best Practices

- Always run a liveness/heartbeat probe before and after scenario tests
- Use structured result objects for all probes
- Trigger screenshots for all critical failures or edge cases
- Document what each probe checks and what failures mean
- Minimize overlap: use MCP Playwright for AI/automation, regular Playwright for manual regression

---

## Troubleshooting

- If a probe returns `false` for a check, review the returned object and screenshot
- If the player is blocked by an edge, reset position before further movement tests
- If BeatClock is not ticking, check game initialization and timing
- Extend probes for new systems as needed

---

## Reference: Current Probes (2025-06)

| Probe File | Focus | Notes |
|------------|-------|-------|
| `js/ai-liveness-probe.js` | Core game liveness (loop, player, enemies) | Mandatory first probe |
| `js/audio-system-probe.js` | Audio context & beat synchronization | – |
| `js/collision-detection-probe.js` | Bullet & entity collision handling | – |
| `js/grunt-knockback-probe.js` | Grunt enemy knock-back physics | – |
| `js/tank-armor-break-probe.js` | Tank armor break VFX & debris | – |
| Playwright tests in `tests/` ending `*-probe.test.js` | Browser-level orchestration of above probes | e.g. `performance-probe.test.js`, `startup-black-screen-probe.test.js` |

> **Naming Standard:** All automated Playwright tests **must** end with `*-probe.test.js`.  Manual `.spec.js` tests are deprecated and will be deleted during documentation cleanup.

---

## See Also

- [README.md](../README.md) (Quick Start)
- [tests/](../tests/) – All Playwright tests are probe-driven and follow the `*-probe.test.js` naming pattern.

- The standard dev server is Five Server, running on http://localhost:5500
- All Playwright/MCP tests should target port 5500

## Bug Report Automation

- Bug reports are now automatically created as GitHub Issues via the githubIssueManager.
- When running `bun run dev`, both the dev server and the watcher are started together.
- Any bug report files (markdown, JSON, PNG) downloaded from the browser are automatically moved from your Downloads folder to `tests/bug-reports/`.
- This ensures all manual and automated bug reports are organized and accessible for both human and AI/agent debugging.
- You can also run the watcher alone with `bun run watch-bugs`.

## VFX Probes

- **tank-armor-break-probe:**
  - Asserts cracks and debris appear when tank armor is damaged and broken.
- **grunt-knockback-probe:**
  - Asserts grunt moves after a bullet hit (knock-back).

**How to run:**
- `bunx playwright test tests/tank-armor-break-probe.test.js`
- `bunx playwright test tests/grunt-knockback-probe.test.js`

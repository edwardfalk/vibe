# Gameplay Playwright Probe Suite

This Playwright test file (`tests/gameplay-probe.test.js`) is the first-line health-check for the whole game.

## What it covers

1. **Liveness probe** – verifies that the game boots, the `<canvas>` element appears, and critical globals (`gameState`, `player`, `audio`) are present.
2. **Game-mechanics probe** – exercises basic movement / shooting behaviour by delegating to `window.testRunner` inside the page.
3. **Player-death probe** *(new)* – applies deterministic lethal damage to the player and asserts that:
   * the player’s health reaches `0`, **and**
   * `gameState.gameState` transitions to `"gameOver"`.

   This guards against the regression where the player’s health dropped to `0` but the game never entered the **Game Over** state.

## Why is there a backup?

The previous version of the test was archived to:
```
test-backups/gameplay-probe.test.bak.js
```
so we can always diff back or cherry-pick single probes without losing historical behaviour.

Keeping a snapshot also makes it easy to introduce alternate enemy-specific variants later (e.g. `rusher-death-probe`, `stabber-death-probe`) without risking accidental test regressions.

---
*Last updated: 2025-08-16*

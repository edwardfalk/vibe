# Global Variable Migration Plan

> Status: Draft – initiated 2025-08-16
>
> Goal: remove Tier-3 `window.*` globals (`enemies`, `playerBullets`, …) without breaking probes or legacy renderers.

## Motivation

• Globals hide data flow and complicate future multiplayer / save-game features.
• GameState already owns the authoritative arrays; duplication is error-prone.
• Tests and Playwright probes can target GameState selectors instead of globals.

## Stages

| Stage | Actions                                                     | Gate                      |
| ----- | ----------------------------------------------------------- | ------------------------- |
| 0     | Document aliases; add runtime dev-warnings on divergence    | _now_                     |
| 1     | Introduce read-only getters (`GameState.getEnemies()` etc.) | tests pass                |
| 2     | Refactor systems to use getters; keep alias sync for probes | math-consistency CI green |
| 3     | Enable `STRICT_GLOBALS=1` in CI; forbid new references      | 0 failing scans           |
| 4     | Delete alias exports; remove sync helper in `GameLoop.js`   | probes updated            |

## Runtime Guard (Stage 0)

```js
if (process.env.NODE_ENV !== 'production') {
  Object.defineProperty(window, 'enemies', {
    get() {
      console.warn('⚠️ window.enemies is deprecated; use GameState.enemies');
      return window.gameState?.enemies;
    },
    configurable: true,
  });
}
```

## CI Enforcement

- Rule file: `s-no-tier3-globals-20250816-01.mdc`
- Scanner: `scripts/scan/scan-no-tier3-globals.js` (to be added)

## References

- `packages/core/src/GameState.js` – source of truth arrays.
- `packages/systems/src/RenderPipeline.js` – rendering pipeline relies on GameState, not globals.

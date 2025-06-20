# Explosion FX Next Steps

_Updated 2025-06-15_

This document captures the remaining work to fully finish the FX migration and restore the classic look while keeping the new modular architecture.

---

## ✅ Done so far _(2025-06-15 update)_
1. Central `explosionFX` config exported from `fxConfig.js`; all explosions read tuning from there (**FX-2024-01 closed**).
2. Time-delta driven physics implemented across explosion systems (**FX-2024-04 closed**).
3. Legacy shim files under `js/explosions/` removed; all code now imports directly from `packages/fx` (**FX-2024-02 closed**).
4. All runtime errors fixed (`sizeRange`, `PI`, `random`, `p._styles`, missing `constrain`).
5. ESLint hardened with `no-undef`; ignore globs consolidated into `eslint.config.js`.

---

## 🎫 Proposed tickets / tasks

| ID (suggested) | Type | Title | Description | Priority |
|---------------|------|-------|-------------|----------|
| FX-2024-03 | enhancement | Per-enemy colour palette audit | Compare current colours against pre-refactor visuals, adjust `getParticleColor()` to better match the classic hues. | medium |
| FX-2024-05 | enhancement | Visual regression tests for explosions | Use MCP Playwright to capture reference screenshots of each explosion type and fail CI if the diff exceeds 3 %. | low |
| FX-2024-06 | task | _Done_ | Obsolete `.eslintignore` removed; ESLint uses config file globs. | — |
| FX-2024-07 | task | GPU performance benchmark | Profile explosions on an Intel UHD-only laptop; adjust `particleMultiplier` if frame-time exceeds 16 ms. | medium |

_Note:_ When creating the JSON tickets, remember each must include a unique `id` and `type` field. See `TICKETING_SYSTEM_GUIDE.md` for commands.

---

## Next immediate action
Start with ticket **FX-2024-03** – compare current colours against pre-refactor visuals and adjust `getParticleColor()` to better match the classic hues. 
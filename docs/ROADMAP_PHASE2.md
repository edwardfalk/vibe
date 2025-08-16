# Vibe – Phase 2 Roadmap (post-refactor)

> Start date: 2025-08-17  
> Owner: Core maintainers / AI assistants

Phase 1 (core refactor & stability) is complete. This document tracks forward-looking
work for the next milestone.

## 🍀 Open Tasks

| ID                  | Area       | Description                                                                                                                                                                             | Priority |
| ------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| p2-vfx-cleanup      | VFX        | Remove pixel "dots" left after enemy death (background repaint or buffer clear)                                                                                                         | P1       |
| p2-hud-ui           | UI         | Restore & iterate on HUD (level badge, combo meter, high-score banner)                                                                                                                  | P2       |
| p2-limbo-shader     | Render     | Replace tint overlay with DesaturateShader & vignette in DeathTransitionSystem                                                                                                          | P2       |
| p2-limbo-quips      | Gameplay   | Add random enemy speech bubbles when friendly-fire begins in limbo                                                                                                                      | P3       |
| p2-root-policy      | Dev-Server | Finalise Five-Server root (`.` vs `/public`) and update start/test scripts                                                                                                              | P2       |
| p2-math-rollout     | QA         | Replace remaining raw Math/ p5 globals flagged by scanner                                                                                                                               | P3       |
| p2-explosion-colors | VFX        | Ensure kill explosions inherit enemy palette (e.g., green/grunt) instead of default magenta/yellow cycling; fix lingering dot artifacts that swap magenta⇄yellow and occasionally green | P1       |

### Notes (2025-08-17)

• 2025-08-20 – dots investigation underway. Added DEBUG_DOTS toggle, runtime console output for central & fragment particle counts every 30 frames, and a new Playwright probe `lingering_dots_probe` that fails on any saturated pixel after 3 s. Observations logged: dot colour matches explosion palette, flickers while shooting, shrinks/turns green when idle – indicates overlay particle layer masking true explosion colour.

• Dot artefacts persist even after `endShape` fix – appear as single-pixel sprites that cycle magenta ↔ yellow every few frames; occasionally become small green dots when player stops firing. Same palette indicates the culprit is common explosion particle buffer or global `blendMode(p.ADD)` leak.

• Observations 2025-08-18: - Switching bullet glow from ADD → SCREEN eliminated tinting during active shooting, confirming additive-​blend residuals are the root cause. - Residual dots now traced to _ExplosionManager_ fragments/central-particles: tiny (<4 px) sprites with alpha <30 rendered in ADD continue to tint underlying stars. - Added guard to skip draw when `particle.size < 4 || alpha < 30`; dots frequency greatly reduced but not yet 0 ⇒ suspect another effect (visualEffects.drawEnhancedStars) still uses `p.blendMode(p.ADD)` on every frame; any 1-px star rendered after additive pass keeps colour. - Next step: move star field draw to BLEND-only layer drawn _after_ all ADD passes, or render stars to an off-screen buffer composited last.

• Kill explosions currently default to magenta/yellow regardless of enemy. Need to pull palette from `enemy.bodyColor` etc. in `ExplosionManager.addKillEffect` and ensure per-particle `fragmentColor` respects that.

Action for **p2-explosion-colors**: audit `Explosion`, `EnemyFragmentExplosion` central/fragment colour assignment, verify no fall-through to fallback colours; switch to regular `p.BLEND` after additive bursts. Also search for global blend-mode leaks causing colour cycling.

Use `

### Investigation 2025-08-19 – Magenta/Yellow Flicker & Wrong Explosion Colours

Root-cause analysis summary:

1. Residual dots are pixels rendered while the global `blendMode` was left in `p.ADD` (additive). Any later white/grey pixel then accumulates previous colour and oscillates as new additive colours appear (e.g., player muzzle flash → yellow, grunt palette → green).
2. Several effects still switch to additive/SCREEN blend without guaranteed reset – notably legacy glow helpers and some background VFX functions.
3. `ExplosionManager` spawns classic `Explosion` particles only; colour-correct VFX bursts in `VisualEffectsManager` (which also trigger chromatic shift) were never hooked up, so explosions fall back to mismatched palettes.
4. `applyScreenEffects()` (chromatic aberration, bloom) is never executed because no renderer calls it.

Implemented safeguards (2025-08-19):
• Added `withBlendMode(p, mode, fn)` utility – ensures we always restore `p.BLEND`.
• Refactored core glow helpers and star/particle draws to use the wrapper.
• Added `ScreenEffectsRenderer` (layer OVERLAY) so chromatic shift & bloom now render once per frame.

Outstanding long-term tasks (TRACK as roadmap items):
| ID | Area | Description | Priority |
| -------------------- | --------------- | ------------------------------------------------------------------------------------------------------------- | -------- |
| p2-blend-safety | Render | Migrate **all** `blendMode` calls to `withBlendMode`; add ESLint/CI scan `scan:blend` to forbid raw calls. | P1 |
| p2-explosion-vfx | VFX | Route `ExplosionManager.addKillEffect` ➜ `visualEffectsManager.addExplosionParticles` for colour-correct bursts | P1 |
| p2-fx-rule | Dev-Rules | Add `.cursor/rules/s-blend-mode-safety-20250819-01.mdc` enforcing wrapper usage and pipeline reset | P2 |
| p2-probe-flicker | QA | Playwright probe: kill enemy, wait 120 frames, assert no additive residue (ΔRGB < 30) | P2 |
| p2-render-api | Architecture | Formalise RenderPipeline contract: **no** renderer may call `blendMode` without wrapper; document in README | P3 |

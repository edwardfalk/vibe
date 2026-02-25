# Background Improvements Roadmap

Optimize background rendering performance to maintain 60fps and unify the visual aesthetic around a modern synthwave/deep-space vibe. Written for the next stateless AI agent.

## Definition of Done
- Background rendering requires minimal per-frame math (caching static assets).
- Full-screen overdraw is reduced or consolidated.
- Background elements correctly pan with camera movement (parallax integration).
- Visual aesthetic uses a strict synthwave color palette (deep violet, hot magenta, bright cyan).
- Environment visually reacts to the beat without relying solely on full-screen flashes.
- `bun run lint` passes and `bun run test:mcp` passes (if applicable).

## Baseline
- Heavy trigonometric math (`sin`, `cos`) is computed per-frame for complex elements like galaxies and nebula streams.
- Multiple overlapping screen-sized transparent rectangles cause significant fill-rate overhead.
- Elements in `EnhancedSpaceElements.js` bypass `ParallaxLayerFactory` logic, failing to pan with the camera.
- Color palette contains scattered colors (yellows, light pinks, etc.) that dilute the vibe.
- Pseudo-glow effects are achieved by drawing multiple transparent overlapping shapes, causing banding and performance drops.

---

## Phase 1 - Render Target Caching (Performance) [DONE]
### Goal
Eliminate heavy per-frame math by pre-rendering static complex assets to off-screen canvases.
### Scope
- `EnhancedSpaceElements.js` (Galaxies, Streams)
- `CosmicAuroraBackground.js` (Gradient rendering)
- `SubtleSpaceElements.js`
### Deliverables
- Update heavy rendering functions to use `p.createGraphics()` on initialization.
- Render the cached graphics in the draw loop via `p.image()`.
### Verification
- Run game locally (`bun run dev`). Verify visual parity for these elements.
- Monitor performance/FPS to ensure no frame drops during rendering.

## Phase 2 - Overdraw Reduction & Parallax Integration (Performance) [DONE]
### Goal
Consolidate full-screen effects and fix camera panning for enhanced elements.
### Scope
- `BeatPulseOverlay.js`
- `InteractiveBackgroundEffects.js`
- `ParallaxLayerFactory.js`
### Deliverables
- Move stationary "enhanced elements" into the parallax layer generation so they pan with the camera.
- Consolidate health warnings and beat pulses to minimize full-screen overlapping rectangles (e.g., using `p.tint()` on a pre-rendered texture).
### Verification
- Move player around to ensure all space elements (galaxies, streams) pan with the camera.
- Verify health and beat effects trigger correctly without significant FPS drops.

## Phase 3 - Synthwave Palette & Canvas Glows (Visuals) [DONE]
### Goal
Unify the aesthetic and improve glows using native canvas features.
### Scope
- `ParallaxLayerFactory.js`
- `EnhancedSpaceElements.js`
- `MediumStarRenderer.js`
### Deliverables
- Enforce strict palette: deep violet/indigo (`#1A0B2E` - `#0B001A`), hot magenta (`#FF00C8`), bright cyan (`#00F3FF`).
- Replace multi-ellipse fake glows with native `p.drawingContext.shadowBlur` and `shadowColor`, or use `p.blendMode(p.ADD)`.
- Adjust distant layers to be desaturated, and foreground layers to be brighter with directional motion blur.
### Verification
- Visual inspection of the color cohesion.
- Verify native glows don't degrade performance compared to the baseline.

## Phase 4 - Environmental Beat Reactivity (Visuals) [DONE]
### Goal
Make the physical environment react to the music beat instead of relying purely on screen flashes.
### Scope
- `MediumStarRenderer.js`
- `ParallaxLayerRenderers.js`
- `BeatPulseOverlay.js`
### Deliverables
- Reduce the opacity/intensity of the full-screen beat flash.
- Modulate specific environmental properties (e.g., star `size`, cloud `brightness`, or `shadowBlur`) based on `beatClock` intensity.
### Verification
- Play game with audio enabled. Verify environment pulses in sync with downbeats.
- Check that the effect feels natural and not visually overwhelming.

---

## Suggested Execution Order
1. **Phase 1** (Highest performance ROI, establishes caching pattern)
2. **Phase 2** (Fixes logical bugs with parallax and cleans up heavy overlays)
3. **Phase 3** (Easy visual win once performance is stabilized)
4. **Phase 4** (Final layer of polish tying audio and visuals together)

## Current Known Debt
- None yet.

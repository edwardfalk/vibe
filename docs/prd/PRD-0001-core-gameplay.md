---
id: PRD-0001
status: draft
owner: @edward
---
# Core Gameplay – Beat-Synced Shooter (Foundational)

## Problem
We need a concise, testable definition of the core gameplay loop that aligns with the Cosmic Beat vision and is enforceable by probes.

## Goal
Define the minimum-viable gameplay pillars and constraints for a beat-synced space shooter without a backing music track.

## Acceptance Criteria
1. Enemy actions are locked to specific beats (per DESIGN.md mapping).
2. Player firing model:
   - First shot on button press fires immediately (no beat lock) OR may be delayed to next quarter beat if configured.
   - If button remains held: skip next quarter beat (free shot counts as that beat), then auto‑fire on quarter beats.
3. The game produces a coherent rhythmic soundscape from SFX and speech; any ambient pad/texture is tied to enemies or space context.
4. Determinism for tests: Test Mode (T) runs deterministically when `setRandomSeed(1337)` is applied before gameplay.
5. Event-bus VFX: entities emit events; VFXDispatcher triggers particles/screen FX (no direct calls from entities).
6. On Restart, a `playerChanged` CustomEvent is dispatched and audio is re-bound to the current player.

## Out of Scope
- Power-ups and meta-progression systems.
- Narrative content.

## UX Notes
- Audio context requires a click; show a subtle prompt until activated.
- Visual clarity: explosions readable without overpowering; cap bloom/aberration by LOD.

## Performance / Security
- Adaptive LOD must keep frame time stable; particle counts scale down under load.
- No remote code/config loads.

## Dependencies
- `BeatClock`, `VisualEffectsManager`, `VFXDispatcher`, `EnemyEventBus`.
- Probes: ai-liveness, audio-system, collision-detection, grunt-knockback, tank-armor-break.

## Stakeholders
- Code review: @maintainer
- QA/Automation: @qa

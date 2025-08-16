---
id: PRD-VIBE-CORE-20250816
status: draft
owner: @vibe-team
---
# Vibe – Core Game Definition & Goals

## Problem
New contributors and AI assistants find scattered, sometimes conflicting descriptions of what Vibe actually is, its core loop, and tech pillars. This leads to drift and misunderstandings.

## Goal
Provide a single source of truth that succinctly defines the game, its pillars, and acceptance criteria, residing under docs/prd/. All other docs should reference this definition.

## Game Definition
Vibe is a fast-paced, top-down space shooter where every shot, dash, explosion, UI pulse, and enemy attack snaps to a universal 4⁄4 “Cosmic Beat.” Players move and fire freely, but enemies and major events trigger only on their assigned beat slots, turning firefights into living, generative music.

## Design Pillars
1. Cosmic Beat Synchronisation – If it doesn’t groove, it doesn’t ship.
2. Strict Modularity – Code lives in `packages/**`, split by domain; no monoliths.
3. AI-First Codebase – Deterministic math utilities, emoji-prefixed logs, probe-driven tests.
4. Windows-Native, Bun-First – cmd.exe shell, Bun scripts, p5.js 1.7.0 instance-mode.

## Gameplay Scope (v1.0)
* Endless-survival single-player mode.
* Progressive levels introduce new enemies and increased density.
* Default tempo: **120 BPM** (configurable via `CONFIG.GAME_SETTINGS.BPM` env override).
* Distance-based audio effects & other parameters remain **tunable** via `config.js`.

## Acceptance Criteria
1. README links to this PRD in the Documentation Map.
2. Enemy beat mapping table exists and matches BeatClock defaults.
3. Performance baseline: ≥60 FPS on mid-range hardware (GTX 1050).
4. Probe-driven test suite passes (`bun run test` green).
5. All new modules follow dependency-injection & instance-mode standards.

## Enemy Beat Mapping
| Enemy   | Primary Beat(s) | Audio Role |
| ------- | --------------- | ---------- |
| Grunt   | 2 & 4           | Snare      |
| Tank    | 1               | Bass Drum  |
| Stabber | 3.5             | Off-beat Accent |
| Rusher  | 1 or 3          | Crash / Impact |

## Out of Scope
Detailed enemy stats, balance tables, monetisation, and narrative cut-scenes.

## UX Notes
Gameplay should feel like playing an instrument; each encounter composes a unique track.

## Performance / Security
Maintain stable 60 FPS baseline; avoid blocking work in the main loop. No personal data is stored or transmitted.

## Dependencies
BeatClock, Audio, Probe tests, Five-Server dev environment.

## Stakeholders
* Code review: @maintainer  
* QA: @qa_automation  
* Product owner: @vibe-team

## Future Ideas (Post-v1.0)
* Player timing bonuses (e.g., shotgun that deals extra damage when fired exactly on beat 1).
* Dynamic BPM per level to heighten challenge and musical variation.
* Additional weapons & power-ups.
* Mobile port & multiplayer co-op.

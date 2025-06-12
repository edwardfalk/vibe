# @vibe/core

Core subsystems for the Vibe game: game loop, global game state, timing (BeatClock), and shared math utilities.

Exports (initial cut):
- `GameLoop` – orchestrates frame updates
- `GameState` – reactive game data store
- `BeatClock` – rhythm-aware timer

> All modules live in `src/`. Keep each file focused and under ~300 LOC. Split when larger. 
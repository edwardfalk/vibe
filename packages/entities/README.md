# @vibe/entities

All game entities: Player, Bullet, enemies (Grunt, Rusher, Tank, Stabber, etc.).

Guidelines:
- Each entity lives in its own file under `src/`.
- Keep constructor signature consistent: `constructor(x, y, type, config, p, audio)`.
- All update methods accept `deltaTimeMs`.
- Keep files below 400 LOC; split specialised behaviour if needed.

Dependencies: `@vibe/core` for game state & math utilities. 
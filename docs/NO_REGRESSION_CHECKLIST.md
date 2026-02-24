# No Regression Checklist

This checklist is the release gate for the aggressive refactor program.

## Baseline Snapshot (2026-02-24)

- `bun run test:mcp`: pass (`2 passed`, runtime ~9s).
- Collision metrics probe (`window.collisionSystem.getPerformanceSnapshot()` after boot):
  - `frameSampleSize`: `220`
  - `latestFrame.enemiesAtFrameStart`: `2`
  - `averages.playerBulletChecksPerFrame`: `0`
  - `averages.enemyBulletChecksPerFrame`: `0`

## Latest Refactor Validation (2026-02-24)

- `bun run test:mcp`: pass (`2 passed`, runtime ~12.5s).
- ESLint on refactored files: pass.

## Mandatory Checks Per Refactor Wave

- [ ] `bun run test:mcp` passes.
- [ ] `bun run lint` passes (or only pre-existing unrelated issues remain).
- [ ] Canvas boot succeeds in browser (`canvas` visible within 30s).
- [ ] Player input still works (`WASD`, shoot, arrow keys).
- [ ] Enemy lifecycle intact (spawn, damage, death, cleanup).
- [ ] Scoring and kill streak update correctly on kills and damage taken.
- [ ] Bomb and area damage still apply knockback and game-over correctly.
- [ ] Collision diagnostics API still available:
  - [ ] `window.collisionSystem.getPerformanceSnapshot()`
  - [ ] `window.performanceDiagnostics` populated when enabled

## Refactor-Specific Structural Checks

- [ ] No module in refactor scope hard-crashes if optional systems are absent.
- [ ] Compatibility shims preserve legacy import paths during migration.
- [ ] `window.*` usage reduced for migrated modules (`CollisionSystem`, `Audio`, `AreaDamageHandler`).
- [ ] Damage/death handling goes through shared contract normalization.

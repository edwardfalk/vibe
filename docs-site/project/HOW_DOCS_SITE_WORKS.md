# Docs Site: How It Works

The Vibe docs site uses Docsify to render markdown on-the-fly (no static build). Two small automations keep it in sync with the repo:

## What gets auto-generated
- Rule Index: `bun run docs:build-index` runs `scripts/generate-rule-index.js` to build `docs-site/RULES_INDEX.md` from `.cursor/rules/*.mdc`.
- Rules mirroring: `scripts/sync-docs-site-rules.js` copies `.cursor/rules/*.mdc` to `docs-site/rules/` so the web docs always show the latest rules.

## Serving locally
```pwsh
bun run docs:serve
```
This does:
1) Generate the rules index
2) Mirror `.cursor/rules` to `docs-site/rules`
3) Serve `docs-site/` via Docsify

## Editing rules vs site
- Edit rules in `.cursor/rules/*.mdc` (source of truth).
- The mirror in `docs-site/rules/` is overwritten by the sync script.

## Link checking & archives
- `bun run docs:check-links` verifies internal links.
- Archived docs under `docs/archive/**` are ignored by the checker.

## Add a new docs page
- Add a markdown file under `docs-site/` (e.g., `docs-site/project/NEW_PAGE.md`).
- Link it in `docs-site/_sidebar.md`.

## CI notes
- CI runs linting, consistency scans, sound validation, and Playwright probes.
- Docs link checking runs via `scripts/check-doc-links.js`. 
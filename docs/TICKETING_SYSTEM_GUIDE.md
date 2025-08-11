# Ticketing System Guide

All bug/feature/enhancement tracking uses GitHub Issues via `packages/tooling/src/githubIssueManager.js`.

- Legacy JSON ticketing is retired. If you find references to `/api/tickets` JSON files, delete or migrate.
- Probes auto-create richly formatted issues with screenshots and logs on failure.

Quick start:
- Configure `GITHUB_TOKEN` in `.env`.
- Use `githubIssueManager` from scripts or tests to file/update issues.

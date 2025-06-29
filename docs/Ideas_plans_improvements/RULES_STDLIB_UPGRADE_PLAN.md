# Vibe Cursor-Rules "Stdlib" Upgrade Plan

> Draft v0.1 – generated 2025-06-24

> **Note:** All references to `npm`/`npx` are historical. The project now uses Bun (`bun`/`bunx`) exclusively. `npm install` is forbidden.

This document distills the best practices from Geoffrey Huntley's "You are using Cursor AI incorrectly…" post and the **AI Code Guide** roadmap into a concrete action plan for Vibe.

## 1  Background & Goals

* **Rules as code stdlib.** Treat every repeatable instruction as a dedicated rule file (\.mdc) so Cursor can compose them like Unix pipes [[ghuntley post](https://ghuntley.com/stdlib/)].
* **Reduce the monolith.** Our current monolithic `.cursorrules` is powerful but heavyweight. Splitting it into focused single-responsibility rules improves readability, discoverability, and re-use across projects.
* **Automate the boring bits.** Leverage event-driven actions (file_create, build_success, etc.) to enforce conventions, auto-generate scaffolding, and close the feedback loop between probes ↔︎ tickets.

## 2  Current State Snapshot

| Area | Status |
|------|--------|
| Rule placement | Central `.cursorrules` plus ~15 topic rules in `.cursor/rules/` |
| Automation | Pre-dev script, probe-driven Playwright, no rule-level automation |
| Linting rules | Manual via ESLint / Prettier scripts |
| Commit discipline | Conventional-commit style encouraged but not enforced |
| Licence headers | Manual |

## 3  Design Principles for Our Rule Stdlib

1. **Single Purpose:** One concept per rule – e.g. *cursor_rules_location*, *add_license_header*.
2. **High Signal:** Reject rules that merely restate common sense; prefer rules that clamp unwanted suggestions or trigger automation.
3. **Self-Documenting:** Each rule's `description` should explain *why* it exists and link back to this plan where relevant.
4. **Fail-Loud:** Use `reject` filters with clear error messages for anti-patterns (npm, Bash paths, legacy files).
5. **Safe Execution:** Any `execute` action must be idempotent and respect Windows/Pwsh environment.

## 4  Immediate Upgrades (Sprint ≈ 1–2 h)

| Rule/File | Purpose | Notes |
|-----------|---------|-------|
| `.cursor/rules/ALWAYS-cursor_rules_location.mdc` | Enforce that all rule files live in `.cursor/rules/` | Adapted from Huntley post. |
| `.cursor/rules/add_license_header.mdc` | Auto-prepend MIT header on new source files (`.js`, `.md`, etc.) | Use `scripts/add-license.ps1` (to be written). |
| `.cursor/rules/conventional_commits.mdc` | Auto-commit changes after successful build/probe run using Conventional Commits | Guard via env `AUTO_COMMIT=true`; commit to `cursor-commits` branch. |
| `.cursor/rules/probe_success_ticket_close.mdc` | On `build_success` from any `*-probe.test.js`, call Ticket API to mark related ticket resolved. | Requires new `scripts/close-ticket.js`. |
| `scripts/validate-rules.js` | CI helper – parse every `.mdc`, verify YAML front-matter & path references. | Run in `bun test` workflow. |

### 4.1 Rule Skeleton Example (add_license_header)
```mdc
---
description: Auto-adds MIT licence header to new files.
globs: "*"
---
# Add MIT licence header

<rule>
name: add_license_header
filters:
  - type: file_extension
    pattern: "(js|ts|md)$"
  - type: event
    pattern: "file_create"
actions:
  - type: execute
    command: "pwsh -c \"& ./scripts/add-license.ps1 \`$FILE\""
</rule>
```

## 5  Medium-Term Upgrades

1. **Rule Generator Script:** `scripts/generate-cursor-rules.js` – scaffolds rule templates with standard front-matter.
2. **Rule Linter CI:** Extend `validate-rules.js` to run during PR checks; fail if rules reference missing paths/files.
3. **Proactive Test Stubs:** Rule that creates a matching `*.test.js` skeleton when a new module is added under `packages/*/src/`.
4. **Legacy Clamp Rules:** Reject Bash-specific paths, `npm install` (forbidden—use `bun install`), and direct edits to legacy `js/game.js`.
5. **Cross-Project Re-Usables:** Move editor-agnostic rules (license header, rule location, commit style) into a shared template repo in future.

## 6  Inspiration from **AI Code Guide**

| Idea | Application to Vibe |
|------|---------------------|
| *Well-structured prompting ⇒ well-structured design* | Encourage layered prompts in tickets/specs; store acceptance criteria in docs/tickets. |
| *TDD / property-based tests* | Expand probe system with fast-check property tests for core mathUtils & BeatClock. |
| *Safety checklist* | Bake into rule that scans for plaintext secrets on commit. |
| *Greenfield vs existing codebase advice* | Keep Ticket-driven, feature-scoped changes; avoid large context floods. |

Source: [AI Code Guide README](https://github.com/automata/aicodeguide)

## 7  Open Questions / Next Steps

* Do we enable auto-commits by default or keep human PR review?  
* Which licence header text & formatting do we standardise on?  
* How to map probe names → ticket IDs reliably? (naming convention vs metadata file)

---
*Maintainer action:* Review this plan, adjust priorities, then create the first batch of rule files + scripts. Each new rule should link back to this doc in its metadata for traceability. 
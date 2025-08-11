---
title: Documentation & Rule Audit Plan
description: Central tracker for auditing, correcting, and cleaning up all docs and rule files in Vibe.
last_updated: 2025-08-11
---

# Documentation & Rule Audit Plan

> Purpose: Central tracker for the end-to-end review, correction, and cleanup of **all** documentation and rule files in the Vibe project.  This file will be updated as each section is audited.

---

## 1. Audit Process

1. **Inventory** – Enumerate every Markdown / MDC rule file in the repo.
2. **Classify** – Mark each as *✅ accurate*, *⚠️ needs update*, or *🗑️ obsolete*.
3. **Correct / Archive / Delete** –
   - Fix inaccurate content immediately if straightforward.
   - Archive to `docs/archive/` if <80 % sure it is obsolete.
   - Delete outright if ≥80 % sure it is obsolete.
4. **Cross-link & Consistency** – Ensure internal links, file names, and code references are current.
5. **Validation** – Run link checker + grep search to confirm no dangling references.
6. **Summary** – Provide aggregated change log upon completion.

---

## 2. Document Inventory (initial)

| Path | Category | Status |
|------|----------|--------|
| `.cursorrules` | Core Rule | ✅ (updated) |
| `README.md` | Root Doc | ✅ |
| `docs/PROJECT_VISION.md` | Vision | ✅ |
| `docs/DESIGN.md` | Design | ✅ |
| `docs/TICKETING_SYSTEM_GUIDE.md` | Workflow | ✅ |
| `docs/MCP_PLAYWRIGHT_TESTING_GUIDE.md` | Testing | ✅ |
| `docs/MCP_TOOLS_GUIDE.md` | Tools | ✅ |
| `docs/AUDIO_CONFIGURATION_GUIDE.md` | Audio | ✅ |
| `docs/CODERABBIT_COMPLETE_GUIDE.md` | CodeRabbit | ✅ |
| `docs/GAMEPLAY_TESTING_GUIDE.md` | Testing | ✅ |
| `docs/POWERSHELL_ISSUES_GUIDE.md` | Environment | ✅ |
| `docs/POWERSHELL_ISSUES_TROUBLESHOOTING.md` | Environment | ✅ |
| `docs/explosions_fx_next_steps.md` | Feature Notes | ✅ |
| `docs/PROJECT_CLEANUP_2025-01-09.md` | Historical | 🗑️ (deleted) |
| `docs/debugging/*` | Debugging | ✅ |
| `docs/archive/*` | Archived | 🔍 (confirm archive) |
| `.cursor/rules/*` | Rules | 🔍 (needs targeted rule-by-rule review) |

> **Legend**
> *✅ accurate* – No action needed  
> *⚠️ needs update* – Review & correct  
> *🗑️ obsolete* – Delete (≥80 % confidence)  
> *🔍 confirm archive* – Already archived; verify we don't still need it.

---

## 3. Priority Order

1. `.cursorrules` – single source of truth.
2. Root `README.md` – high-visibility entry point.
3. Critical workflow guides – Ticketing, Testing, MCP Tools.
4. Remaining docs in `docs/`.
5. Rule files in `.cursor/rules/`.
6. Archived docs – clean up if safe.

---

## 4. Immediate Next Steps

- [x] Audit `.cursorrules` for outdated references (e.g., module lists, probe policy).
- [x] Cross-check README architecture section with actual `packages/` contents.
- [x] Validate ticketing API guide vs. current server code (`packages/api/`).
- [x] Confirm MCP Playwright workflow aligns with `tests/*` probes.
- [x] Delete obsolete cleanup summary doc.
- [x] Implemented link checker script (`bun run docs:check-links`).
- [x] Rule-by-rule quick pass of `.cursor/rules` files complete.
- [x] Archive folder verified (no active docs).

---

_Last updated: 2025-06-24 16:55 UTC_

### Probe-Only Testing Policy – Rationale
Probe scripts embed domain-specific diagnostics and automatically file tickets with artifacts.  Generic "describe/it" style specs duplicate effort and go stale quickly when the game evolves.  Enforcing probe-only tests guarantees:
1. **Lower maintenance overhead** – One authoritative test per subsystem.
2. **Self-healing automation** – Probes auto-restart, capture screenshots, and integrate with ticketing.
3. **Better signal** – Probes perform deep game-context checks instead of UI-agnostic assertions.
4. **Consistency** – Aligns with MCP tooling that expects the *-probe.test.js naming pattern for analytics. 
---
title: HYBRID PROTOCOL FOR AI CODE ASSISTANCE (Windows / Vibe Edition)
ruleScope: global-user
status: stable
lastUpdated: 2025-08-16
---

This document defines the **canonical rules** every AI assistant should follow when working on the Vibe repo from a **Windows + cmd.exe** environment.  
Copy-paste the entire file into Cursor ➜ *Settings ➜ Rules ➜ User Rules* so the guidance applies to every session.

> Conventions  
> • Absolute Windows paths (`D:\projects\vibe\…`)  
> • No bashisms (`| cat`, `grep`, `rm`, etc.)  
> • Prefer **Desktop Commander** helper tools (`*_read_file`, `*_search_code`, …) instead of raw shell commands.
## 0. Initial Task Risk Assessment

1. **Classify the task**  
   • **HIGH-RISK** — touches security, core business logic, public APIs, DB schemas, production infra, or ≥3 subsystems.  
   • **STANDARD-RISK** — UI tweaks, isolated features, docs, tests.  
   • If unsure, default to **HIGH-RISK** and ask for confirmation.  
2. **Output** the classification and a one-line justification.  
3. Ask clarifying questions when the scope is ambiguous.

---## 1. Architectural Understanding

1. **Map the workspace** – list the repo (depth ≤ 4) using the directory-listing helper.  
2. **Inspect representative files** – open full files with the file-reader helper; confirm patterns (modular packages, p5 instance-mode, event bus).  
3. **Summarise** the architecture style and where the upcoming work belongs.

## 2. Requirements Engineering

1. Translate the request into **3-5 numbered, testable requirements**.  
2. Note stakeholders & use-cases.  
3. Capture constraints (Node v18 + Bun, ≤100 ms latency, JWT, etc.).  
4. Ask targeted questions if anything is unclear.  
5. Output requirements, constraints, and open questions.

## 3. Code Reusability Analysis

1. **Search the codebase** with the code-search helper for existing helpers/patterns.  
2. List reusable modules and any abstractions to extract.  
3. Output reuse opportunities and consistency notes.
## 4. Technical Discovery

1. Trace **all files that will change**; inspect their dependencies.  
2. Identify cross-cutting concerns (auth, logging, performance).  
3. Assess concurrency, memory, and bundle-size impact.  
4. Note missing tests/docs.  
5. Output paths, concerns, and gaps.

## 5. Implementation Strategy

1. Propose a solution aligned with Vibe’s architecture.  
2. Break into **3-5 concrete steps** with exact file edits or creations.  
3. Plan **backups & rollback** (commit before refactors; keep old code in `backups/` if risky).  
4. Enforce separation of concerns.  
5. Output the numbered action plan.

## 6. Quality Assurance Framework

1. Define **≥5 test scenarios** covering success, edge cases, load, and failure paths.  
2. Link each test to a requirement for traceability.  
3. Specify validation tools (Bun tests, Playwright probes, secret scan).  
4. Plan monitoring & metrics (emoji-prefixed logs, latency histogram).  
5. Describe rollback (git revert hash or feature toggle).
## 7. Execution Rules

• Follow sections in order; never skip **Risk Assessment**.  
• Use **absolute Windows paths** and Desktop Commander helper tools for all file ops.  
• **HIGH-RISK**: deeper inspection, explicit sign-off, backups.  
• Log any deviation; self-correct immediately and record the fix.

---
*End of global user rule*

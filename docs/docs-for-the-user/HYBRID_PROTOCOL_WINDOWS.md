---
title: HYBRID PROTOCOL FOR AI CODE ASSISTANCE (Windows / Vibe Edition)
audience: game developers and AI assistants
status: stable
lastUpdated: 2025-08-16
---

This document describes the **HYBRID PROTOCOL FOR AI CODE ASSISTANCE** adapted for the Vibe project’s **Windows + cmd.exe** environment.  
Use it whenever you ask an AI assistant to add or modify code.

> Conventions used here  
> • Windows paths, e.g. `D:\projects\vibe\…`  
> • No bashisms (`| cat`, `grep`, `rm`, etc.)  
> • Prefer the fast helper tools packaged with Desktop Commander over raw shell commands.

## Initial Task Risk Assessment

1. **Classify the request**  
   • **HIGH-RISK** – touches security, core business logic, public APIs, data models, production infra, or three-plus subsystems.  
   • **STANDARD-RISK** – UI tweaks, isolated features, docs, or tests.  
   • When in doubt, choose **HIGH-RISK** and ask the requester to confirm.  

2. **Output** the chosen classification and one-line justification.  
3. Ask follow-up questions if the scope is ambiguous.

---
## 1. Architectural Understanding

1. **Map the workspace** – list the repository to depth 4 to understand the package layout.  
2. **Inspect representative files** to confirm coding patterns (modular packages, event bus, p5 instance-mode, etc.).  
3. **Summarise** the architecture style and where the new work will live.  
---
## 2. Requirements Engineering

1. Translate the user’s idea into **3-5 numbered, testable requirements**.  
2. Note the **stakeholders & use-cases**.  
3. Capture **constraints** (Node v18 + Bun, ≤100 ms latency, JWT auth, etc.).  
4. Ask targeted questions if anything is unclear.  
5. Output the requirements, constraints, and open questions.  

---
## 3. Code Reusability Analysis

1. **Search the codebase** for existing helpers or patterns that can be reused.  
2. List reusable modules and any new abstraction that should be extracted.  
3. Output findings on reuse opportunities and consistency.  

---
## 4. Technical Discovery

1. Trace **all files that will change** and inspect their dependencies.  
2. Identify **cross-cutting concerns** (auth, logging, performance).  
3. Assess concurrency, memory, and bundle size impact.  
4. Note any missing **tests or docs** that must be added.  
5. Output file paths, concerns, and gaps.  

---
## 5. Implementation Strategy

1. Propose a solution that fits Vibe’s architecture.  
2. Break the work into **3-5 concrete steps** with exact file edits or creations.  
3. Plan **backups & rollback** (commit before large refactors; keep old code in `backups/` if risky).  
4. Enforce **separation of concerns**.  
5. Output the numbered action plan.  
---
## 6. Quality Assurance Framework

1. Define at least **five test scenarios** covering success, edge cases, load, and failures.  
2. Link each test to a requirement for traceability.  
3. Specify validation tools: unit tests (Bun), Playwright probes, secret scans.  
4. Plan **monitoring & metrics** (emoji-prefixed logs, latency histogram, error-rate gauge).  
5. Describe **rollback** (git revert hash or feature toggle in `config.js`).  
6. Output the QA matrix and rollback approach.  

---
## Execution Rules

• Follow sections in order; never skip the **Risk Assessment**.  
• Use **absolute Windows paths** and the Desktop Commander helper tools for file operations.  
• For **HIGH-RISK** tasks: deeper inspection, explicit sign-off, and backups.  
• Log any deviation from the approved plan for audit purposes.  

---
## User Message Extraction & Action Item Confirmation

• Decide whether the user is asking for *analysis only* or for *live modifications / command execution*.  
• Execute **only** the actions explicitly approved. If a change is not yet authorised, present a plan including:  
  – Absolute file path(s) and rough line range(s)  
  – Short change summary  
  – Expected impact / dependencies  
• Zero-impact micro-edits (comment typo, log emoji) may be applied instantly but must be disclosed afterward.

## Clarification Protocol

• When intent or scope is unclear, ask a targeted question rather than guessing.  
• If ambiguity persists and the potential risk is non-trivial, treat the task as **HIGH-RISK** and pause until guidance arrives.

## File & Configuration Exploration

Preferred, Windows-native tools:  
1. **List folders** – `mcp_desktop-commander_list_directory` (depth ≤ 4) for a quick project map.  
2. **Read files** – `mcp_desktop-commander_read_file` to fetch *complete* file contents; avoid partial reads.  
3. **Search code** – `mcp_desktop-commander_search_code` (ripgrep under the hood) to find symbols and usages.

Never rely on Unix commands such as `tree`, `grep`, or `cat`. Always capture the *entire* file so decisions are made with full context.

## File Editing Procedures

• For pinpoint corrections use `mcp_desktop-commander_edit_block`; provide just enough surrounding context to be unique.  
• For larger edits:  
  1. Overwrite the first ≤ 30-line chunk with `mcp_desktop-commander_write_file` (mode: rewrite).  
  2. Append the remaining chunks (≤ 30 lines each).  
• **HIGH-RISK**: confirm working directory if shelling out, create a backup/commit before modification, and document a rollback path (`git revert <hash>`).  
• **STANDARD-RISK**: verifying the file exists with `mcp_desktop-commander_get_file_info` is usually sufficient.
## Multi-Operation Communication

• Before executing a sequence of edits or commands, present a consolidated checklist of steps and wait for sign-off (mandatory for HIGH-RISK, recommended for STANDARD-RISK).  
• Call out the execution order and any external dependencies (e.g., dev server restart, DB migration).

## Post-Implementation Review

• Summarise all completed work: file paths, line numbers (when applicable), and the rationale behind each change.  
• **HIGH-RISK**: provide an exhaustive diff reference and note any deviations from the approved plan; seek approval for unexpected changes.  
• **STANDARD-RISK**: a concise recap covering every touched file is acceptable.

## Auditing & Compliance

• This protocol is authoritative for the Vibe repository.  
• **HIGH-RISK** tasks demand strict compliance with every mandatory rule.  
• **STANDARD-RISK** tasks may condense narrative but must still satisfy safety principles.  
• Log any deviation or tool misuse; self-correct immediately and record the fix.

---
*End of protocol (Windows / Vibe edition)*

---
title: Rules Automation & Discovery Plan
description: Plan for indexing, enforcing, and maintaining Cursor rules with automation.
last_updated: 2025-08-11
---

# Rules Automation & Discovery Plan

## Purpose
Create a robust, automated, and discoverable system for rule management, indexing, and enforcement in the Vibe project. This will:
- Ensure all rules are up to date, non-redundant, and easy to find
- Reduce manual maintenance
- Empower both humans and AI agents to follow best practices

---

## 1. Rule Indexing & Discovery
- **Audit existing rule indexing (e.g., Docsify, generate-rule-index.js):**
  - Identify what is currently generated, what is missing, and how it is surfaced to users/AI.
  - Make the rule index visible and accessible (e.g., in README, sidebar, or as a docs page).
- **Automate index generation:**
  - Ensure every .mdc rule is included, with glob, description, and link.
  - Add tags/metadata for quick filtering (e.g., "AI", "security", "coding standards").
- **Highlight forgotten/unused features:**
  - List features like Docsify indexing that are present but not actively used.

## 2. Rule Redundancy & Single Source of Truth
- **Identify repeated standards (math import, p5 instance mode, etc.):**
  - Refactor to reference a single canonical rule or section.
  - Automate detection of redundant rule text if possible.

## 3. Rule Enforcement & Linting
- **Link rules to automated checks:**
  - Reference lint scripts (e.g., bun run lint) in rule docs.
  - Explore custom lint rules for project-specific standards.
- **Automate rule compliance checks:**
  - Script to scan for violations (e.g., legacy file patterns, missing math imports).

## 4. Documentation Hygiene
- **Orphaned/unused rules:**
  - Script to find .mdc files not attached to any files (glob mismatch).
- **Outdated links/references:**
  - Script to check for dead links or references to removed files/scripts.

## 5. AI & Contributor Guidance
- **Add "AI Note" or "Contributor Note" sections to critical rules.**
- **Automate surfacing of these notes in the rule index.**

## 6. Workflow & Visibility
- **Make rule index and automation results visible:**
  - Docs sidebar, README, or dedicated docs page.
  - Consider a badge or status indicator for rule compliance.

---

## Next Steps
1. Audit current rule indexing and Docsify integration.
2. Inventory all .mdc rules, globs, and descriptions.
3. Draft scripts for orphaned rule detection and redundancy checks.
4. Plan for surfacing rule index and compliance status in docs and dev workflow.

---

*This plan is a living document. Add ideas, issues, and improvements as discovered.*

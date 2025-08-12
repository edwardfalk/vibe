---
title: Cursor Project Rules Guide
description: How .mdc rules work in Vibe, rule types, best practices, and references.
last_updated: 2025-08-11
---

# Cursor Project Rules Guide

This guide explains how Cursor project rules (.mdc in .cursor/rules) work, the different types, and best practices for using them in the Vibe project (and beyond). Default shell is cmd.exe; examples use Windows paths and cmd-friendly commands.

PRD enforcement examples wired into ESLint (flat config):
- `vibe-no-math-pi/no-math-pi`: forbid `Math.PI` / `2*Math.PI` in `packages/**` (use `PI`/`TWO_PI`).
- `vibe-no-p5-globals/no-p5-globals`: forbid unprefixed p5 globals; require instance mode or `mathUtils` imports.
- In tests: `vibe-no-raw-goto-index/no-raw-goto-index`: require `gotoIndex(page)` instead of `page.goto(INDEX_PAGE)`.

---

## Rule Types Overview

| Rule Type           | How It's Included               | When It's Used                       | Example Use Case                     |
| ------------------- | ------------------------------- | ------------------------------------ | ------------------------------------ |
| **Always**          | Injected into every context     | Every chat, command, or agent action | Core commandments, project vision    |
| **Auto-Attach**     | Included when matching files    | Editing files matching glob patterns | JS module standards, docs rules      |
| **Agent Requested** | Available for agent to include  | When agent decides it's relevant     | Advanced workflows, deep-dive guides |
| **Manual**          | Only when explicitly referenced | When you mention the rule by name    | Rare, highly specific rules          |

---

## How Each Rule Type Works

### Always Rules

- Placed in `.cursor/rules/` with `alwaysApply: true` in frontmatter.
- Injected at the start of every context window (every message, chat, or command).
- Agent always "sees" these rules—no matter what files you're working on.
- **Best for:** Universal commandments, vision, and standards.

### Auto-Attached Rules

- Use `globs:` in frontmatter to specify file patterns (e.g., `packages/**/*.js`).
- Only included when you're working with files that match the pattern.
- **Best for:** File-type or subsystem-specific standards.
- **Don't repeat always rule content—expand or add details unique to the files.**

### Agent Requested Rules

- Use `description:` in frontmatter, no globs or alwaysApply.
- Agent can include these rules when it decides they're relevant (e.g., advanced troubleshooting, rare workflows).
- **Best for:** Deep-dive guides, advanced workflows, or context the agent may need to "pull in" on demand.

### Manual Rules

- No frontmatter fields set.
- Only included if you explicitly mention the rule by name (e.g., `@my-special-rule`).
- **Best for:** Rare, highly specific, or temporary rules.

---

## Best Practices

- **Keep always rules concise and universal.**
- **Use auto-attached rules for file-specific or subsystem-specific guidance.**
- **Reference, don't repeat, always rule content in auto-attached rules.**
- **Use agent requested rules for advanced or rarely needed guidance.**
- **Manual rules are for edge cases—use sparingly.**
- **Keep all rules focused, actionable, and under 500 lines if possible.**

---

## Practical Examples (Vibe Project)

**Always Rule:**

- Core commandments, project vision, ticketing, code standards.
- Example: `vibe-game-core-guide.mdc`

**Auto-Attached Rule:**

- JS module standards for `packages/**/*.js` files.
- Example: `js-module-standards-auto.mdc`

**Agent Requested Rule:**

- Advanced Playwright troubleshooting and probe-driven testing.
- Example: `playwright-agent-guide.mdc`

**Manual Rule:**

- Temporary rule for a one-off migration or experiment.
- Example: `migration-2024-manual.mdc`

---

## References

- See the Vibe always rule: `.cursor/rules/always-vibe-game-core-guide.mdc`
- For more, see: [Cursor Rules Documentation](https://docs.cursor.com/context/rules)

---

This guide is intended to help you structure, maintain, and evolve your Cursor project rules for maximum clarity and effectiveness.

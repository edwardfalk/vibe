---
title: PRDs & AI-Coding Tooling
description: Lightweight PRD workflow and curated AI-tooling practices applicable to Vibe.
last_updated: 2025-08-11
---

# Product-Requirements Documents (PRDs) & AI-Coding Tooling

> Draft v0.1 – generated 2025-06-24

This guide curates the most relevant ideas from the [AI Code Guide](https://github.com/automata/aicodeguide) for Vibe's workflow: a lightweight, repeatable PRD template **plus** a toolbox catalogue for AI-augmented development.

---

## 1 Why PRDs Matter in an AI-Accelerated Flow

LLMs happily generate code but often miss subtle requirements. A compact PRD:

1. **Aligns context** for both humans and agents.
2. **Acts as single-source spec** referenced by probes/tests and Cursor rules.
3. **Lives next to code** (version-controlled Markdown) – enabling continuous evolution.

### 1.1 PRD ≠ Full-blown RFC

The goal is a _mini-PRD_ (~1 page) per ticket/feature, not a 20-page tome. Enough to pin:

- **Problem statement** – what pain are we solving?
- **Scope / out-of-scope** – boundaries keep the agent from yak-shaving.
- **Acceptance criteria** – numbered, testable assertions (probes reference these IDs).
- **UX notes** – wireframe, key interactions (if front-end).
- **Performance / security considerations** – bullet points.
- **Dependencies** – other tickets, systems, 3rd-party APIs.
- **Stakeholders** – reviewer, QA owner, design contact.

Stored under `docs/prd/<ticket-id>-<slug>.md` and linked in the JSON ticket via `prdPath`.

---

## 2 Mini-PRD Markdown Template

```markdown
---
id: BR-2025-07-15-player-dash
status: draft  # draft | in-progress | done
owner: @dev
---

# Player Dash Mechanic

## Problem

Players lack a short-burst movement option, making evasion feel sluggish.

## Goal

Implement a **dash** that lets the player travel 150 px in ≤0.15 s, 4 s cooldown.

## Acceptance Criteria

1. Pressing _Shift_ while moving triggers a dash in movement direction.
2. Dash ignores enemy collision for its duration.
3. Cooldown indicator renders as a radial fill around the player sprite.
4. Probe _player-dash-probe.test.js_ passes.

## Out of Scope

- No animation polish beyond basic trail effect.

## UX Notes

Include quick Figma link or ASCII diagram.

## Performance / Security

- Ensure dash doesn't bypass map bounds (SpatialHashGrid clamp).

## Dependencies

- Requires BeatClock update for cooldown timer.

## Stakeholders

- Code review: @maintainer \* QA: @qa_automation
```

Embed this template in a Cursor rule (`prd_template.mdc`) that offers it when a new ticket file is created.

---

## 3 Resources Curated from AI Code Guide

| Topic                              | Link / Note                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| _End of Programming as We Know It_ | Tim O'Reilly article – macro trend inspiration.                                     |
| _LLMs for Code_                    | Simon Willison's blog – practical patterns.                                         |
| _Property-based Testing_           | Geoffrey Huntley's pointer → adopt `fast-check` for core math modules.              |
| _70 % Problem_                     | Addy Osmani – reality check on AI code accuracy; reinforces need for probes + PRDs. |
| _How to Build an Agent_            | Thorsten Ball tutorial – reference for future custom MCP servers.                   |

---

## 4 Helpful Tools & How We Might Use Them

| Tool                          | Category                     | Potential Integration                                                          |
| ----------------------------- | ---------------------------- | ------------------------------------------------------------------------------ |
| **Specstory**                 | PRD-writing assistant        | Convert user stories ↔︎ acceptance criteria automatically.                    |
| **repomix / files-to-prompt** | Context bundling             | Generate condensed code snapshots for agent prompts (good for legacy modules). |
| **fast-check**                | Property testing             | Already in `devDependencies`; extend mathUtils tests.                          |
| **Repo Prompt / stakgraph**   | Knowledge graph builders     | Could feed into MCP memory for system-level docs.                              |
| **CodeGuide**                 | Learning resource aggregator | Add to dev-onboarding README links section.                                    |

> Full tool catalogue lives in the AI Code Guide README; above list filtered for immediate ROI.

---

## 5 Action Items for Vibe

1. **Adopt mini-PRD flow:**  
   • Add Markdown template (see §2) and a Cursor rule to suggest it on ticket creation.  
   • Update Ticket API schema to optionally store `prdPath`.
2. **Probe ↔︎ PRD linkage:** probes should import the PRD YAML front-matter to assert `acceptanceCriteria.length` === probes.
3. **fast-check pilot:** Rewrite `mathUtils.test.js` using property tests; gauge value.
4. **Evaluate Specstory:** trial as VS Code extension or CLI for auto-drafting PRDs.

---

### References

- AI Code Guide – [GitHub README](https://github.com/automata/aicodeguide)
- Huntley Stdlib Post – [ghuntley.com/stdlib](https://ghuntley.com/stdlib/)

# Vibe PRDs (Mini-PRDs)

Purpose: lightweight, 1–2 page requirements docs to reduce ambiguity and make probes testable.

- Location: `docs/prd/*.md`
- Template: see `.cursor/rules/ar-prd_template.mdc` (auto-suggests on new files)
- Link each PRD from related probes and tickets

Conventions:

- YAML front-matter includes: `id`, `status`, `owner`
- “Acceptance Criteria” must be concrete and probe-able
- “Out of Scope” explicitly lists exclusions to prevent scope creep

# Markdown Ticketing – Vibe Branch

All tasks, bugs, and ideas are tracked here as Markdown checklists. No external issue tracker is used in this branch.

## Workflow
1. Create or append a `.md` file under `docs/tickets/`.
2. Use GitHub-style checkboxes (`- [ ]`) for each actionable item.
3. Reference the file and line in commit messages (e.g., `fix: player yaw jitter (tickets/physics.md#L12)`).
4. When you finish a task, check it off and push the change. CI treats unchecked boxes as open work.

Example snippet:
```markdown
### Collision polish
- [ ] Investigate rare player bounce bug @edward
- [x] Remove legacy `getDistance` util (done in #123)
```

## Current files
* `UNSORTED.md` – backlog collected automatically by scripts (CodeRabbit, docs workflow).

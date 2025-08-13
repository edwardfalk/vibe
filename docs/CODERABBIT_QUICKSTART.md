# CodeRabbit Quickstart (MCP-first)

Use GitHub MCP tools instead of legacy fetch scripts.

What you need
- A GitHub token configured for MCP (Cursor handles auth).
- Auto-review workflow kept: `.github/workflows/coderabbit-review.yml`.

Daily flow
- List open PRs → read files/diff/status
- Read reviews/comments; filter author `coderabbitai[bot]`
- Fix 1–2 items or open a small PR

Manual trigger
- Comment on the PR issue: `@coderabbitai review`

References
- GitHub MCP workflow: `docs/GITHUB_MCP_WORKFLOW.md`
- Project rules: `.cursor/rules/a-github-mcp-over-scripts-20250813-01.mdc`

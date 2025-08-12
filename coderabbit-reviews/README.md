# CodeRabbit Reviews

This directory contains CodeRabbit review data and simple fetch workflows for Vibe.

## Files

- `latest.json` – Flat array of recent CodeRabbit reviews/comments (newest first)
- `actionable-summary.json` – Grouped by file with actionable inline comments only
- `coderabbit-autofix-log.md` – Optional log of applied/ignored suggestions

## Scripts

### Fetch Latest (simple, daily default)

Fetch a fresh snapshot plus an actionable summary:

```bash
set GITHUB_TOKEN=xxxx   # or export on *nix
bun run coderabbit:fetch-latest
```

Outputs:

- `coderabbit-reviews/latest.json`
- `coderabbit-reviews/actionable-summary.json`

### Fetch Only New (optional, history-aware)

Only new suggestions after your last entry in `coderabbit-autofix-log.md`:

```bash
bun run coderabbit:fetch-new
```

### Requirements

- `GITHUB_TOKEN` with `repo` scope

### Example Output

```
✅ Saved 200 items → coderabbit-reviews/latest.json
✅ Actionable summary (75 files) → coderabbit-reviews/actionable-summary.json
```

## Workflow

Daily: `bun run coderabbit:fetch-latest` → review `actionable-summary.json` → pick a file → fix → commit. Optionally record actions in `coderabbit-autofix-log.md`.

## Integration with Autofix Loop

The history-aware flow (`coderabbit:fetch-new`) still works if you prefer that.

## Troubleshooting

### No GITHUB_TOKEN

Set your GitHub token: `set GITHUB_TOKEN=your_token_here` (Windows) or `export` on \*nix.

### API Rate Limits

If you hit GitHub API rate limits, the script will show appropriate error messages. Consider:

- Using a token with higher rate limits
- Running the script less frequently
- Checking GitHub's rate limit status

// End

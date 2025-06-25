# CodeRabbit Reviews

This directory contains CodeRabbit review data and processing scripts for the Vibe project.

## Files

- `actionable-coderabbit-summary.json` - Summary of all actionable CodeRabbit suggestions
- `coderabbit-autofix-log.md` - Log of all actions taken on CodeRabbit suggestions
- `latest-20.json` - Latest 20 CodeRabbit reviews
- `latest-50.json` - Latest 50 CodeRabbit reviews

## Scripts

### Fetch New Reviews

To fetch only new CodeRabbit reviews that haven't been processed yet:

```bash
# Make sure you have GITHUB_TOKEN set in your environment
bun run coderabbit:fetch-new
```

This script will:
1. Read the autofix log to identify already processed suggestions
2. Fetch recent pull request reviews from GitHub
3. Filter out suggestions that have already been acted on
4. Generate a summary of new actionable suggestions
5. Save the results to a timestamped JSON file

### Requirements

- `GITHUB_TOKEN` environment variable must be set
- GitHub token needs `repo` scope to access private repository reviews

### Output

The script generates:
- Console output showing progress and summary
- `new-suggestions-{timestamp}.json` file with detailed new suggestions
- Grouped by file for easy review

### Example Output

```
🤖 Fetching new CodeRabbit reviews...

📋 Found 15 processed suggestions in autofix log
📋 Processing PR #25: Fix collision detection
  🔍 Review 12345 by CodeRabbit
    ✨ New suggestion: js/GameLoop.js:45
    ⏭️  Already processed: js/Audio.js:123

🎯 Found 3 new suggestions:

📊 New Suggestions Summary:
============================

📁 js/GameLoop.js (1 suggestions):
  Line 45: Add error handling for undefined player...
  PR #25: Fix collision detection
  URL: https://github.com/edwardfalk/vibe/pull/25#discussion_r123456

💾 New suggestions saved to: coderabbit-reviews/new-suggestions-2025-01-08T12-34-56-789Z.json

🚀 Next steps:
   1. Review the new suggestions
   2. Apply fixes where appropriate
   3. Update the autofix log with your actions
```

## Workflow

1. **Fetch new reviews**: `bun run coderabbit:fetch-new`
2. **Review suggestions**: Check the generated JSON file
3. **Apply fixes**: Make code changes as needed
4. **Update log**: Add entries to `coderabbit-autofix-log.md`
5. **Repeat**: Run again to check for more new suggestions

## Integration with Autofix Loop

This script is designed to work with the existing autofix loop workflow:

- It reads the autofix log to avoid re-processing suggestions
- It generates output compatible with the existing review processing
- It maintains the same file structure and naming conventions

## Troubleshooting

### No GITHUB_TOKEN
```
❌ GITHUB_TOKEN environment variable is required
```
Set your GitHub token: `export GITHUB_TOKEN=your_token_here`

### API Rate Limits
If you hit GitHub API rate limits, the script will show appropriate error messages. Consider:
- Using a token with higher rate limits
- Running the script less frequently
- Checking GitHub's rate limit status

### No New Suggestions
If no new suggestions are found, it means all recent CodeRabbit reviews have already been processed according to the autofix log. 
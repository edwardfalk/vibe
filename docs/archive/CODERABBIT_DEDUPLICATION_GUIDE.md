# ARCHIVE: Historical Reference Only

> This document is for historical reference. Some information may be obsolete due to the completed modular migration.

# CodeRabbit Ticket Deduplication System

## Overview

The enhanced CodeRabbit ticket deduplication system prevents creating duplicate tickets for the same CodeRabbit review suggestions. It uses multiple strategies to ensure only new, relevant issues get tickets created.

## Key Features

### 1. Hash-Based Tracking
- **Suggestion Hashing**: Each CodeRabbit suggestion gets a unique hash based on PR number, category, and content
- **Persistent Storage**: Processed suggestions are stored in `tests/bug-reports/processed-coderabbit-suggestions.json`
- **Cross-Session Memory**: The system remembers what's been processed across multiple runs

### 2. Multi-Level Deduplication

#### Level 1: Hash Checking
```javascript
// Check if suggestion hash has been processed before
if (this.processedSuggestions.has(suggestion.hash)) {
  return true; // Skip this suggestion
}
```

#### Level 2: Existing Ticket Analysis
```javascript
// Check against existing tickets for:
// - Same PR number
// - Same category
// - Similar content (80% text similarity)
// - Not already closed/resolved
```

#### Level 3: Text Similarity
```javascript
// Calculate word overlap similarity
const similarity = this.calculateTextSimilarity(text1, text2);
if (similarity > 0.8) {
  // Consider as duplicate
}
```

### 3. Outdated Ticket Resolution

The system automatically resolves tickets that are no longer relevant:

- **PR No Longer Exists**: If the source PR is not in the latest analysis
- **Suggestion Fixed**: If the specific suggestion no longer appears
- **Stale Tickets**: Tickets older than 30 days with low priority

## File Structure

```
vibe/
├── coderabbit-auto-tickets.js           # Enhanced ticket creation
├── resolve-outdated-coderabbit-tickets.js # Outdated ticket resolution
├── coderabbit-ticket-workflow.js        # Complete workflow orchestration
├── tests/bug-reports/
│   ├── processed-coderabbit-suggestions.json # Tracking file
│   └── CR-*.json                        # Individual tickets
└── coderabbit-reviews/
    ├── latest-summary.json              # Analysis summary
    ├── latest-high-priority.json        # High-priority issues
    └── latest-complete.json             # Complete review data
```

## Usage

### Quick Start
```bash
# Run the complete workflow (recommended)
bun run coderabbit:workflow

# Or run individual steps
bun run coderabbit:resolve-outdated    # Resolve outdated tickets
bun run coderabbit:auto-tickets        # Create new tickets
```

### Full Cycle
```bash
# Complete cycle: fetch → analyze → workflow
bun run coderabbit:cycle
```

## Workflow Steps

### 1. Resolve Outdated Tickets
- Loads all open CodeRabbit tickets
- Compares against latest analysis
- Resolves tickets for:
  - PRs no longer in analysis
  - Fixed suggestions
  - Stale low-priority tickets

### 2. Create New Tickets
- Loads processed suggestions history
- Extracts new high-priority suggestions
- Checks for duplicates using multiple methods
- Creates tickets for genuinely new issues
- Updates processed suggestions tracking

### 3. Update Priorities
- Reviews existing open tickets
- Updates priorities based on:
  - Category (security/bugs = high)
  - Age (performance issues escalate)
  - Current relevance

## Configuration

### Similarity Threshold
```javascript
// In isDuplicateSuggestion method
const similarText = this.calculateTextSimilarity(text1, text2) > 0.8;
```

### Age Thresholds
```javascript
// In shouldResolveTicket method
const thirtyDays = 30 * 24 * 60 * 60 * 1000; // 30 days for stale tickets

// In calculateUpdatedPriority method
if (category === 'performance' && daysSinceCreated > 7) {
  return 'high'; // Performance issues escalate after 7 days
}
```

## Ticket Structure

Enhanced tickets include additional tracking fields:

```json
{
  "id": "CR-2025-01-08-sec-abc123",
  "suggestionHash": "base64hash...",
  "file": "js/GameLoop.js",
  "line": 42,
  "reviewUrl": "https://github.com/user/repo/pull/15#discussion_r123",
  "coderabbitSuggestion": "Original suggestion text...",
  "history": [
    {
      "action": "status_change",
      "timestamp": "2025-01-08T12:00:00Z",
      "note": "Auto-resolved: Suggestion no longer in latest analysis"
    }
  ]
}
```

## Monitoring and Debugging

### Logs and Output
The system provides detailed logging:
- 📋 Loaded suggestions count
- 🔍 Processing status
- ⏭️ Skipped duplicates
- ✅ Created tickets
- 🗑️ Resolved outdated tickets

### Verification
```bash
# Check processed suggestions
cat tests/bug-reports/processed-coderabbit-suggestions.json

# List current CodeRabbit tickets
ls tests/bug-reports/CR-*.json

# Check workflow stats
bun run coderabbit:workflow | grep "📊"
```

## Best Practices

### 1. Regular Execution
- Run the workflow after each PR merge
- Schedule daily runs for active projects
- Use GitHub Actions for automation

### 2. Manual Review
- Review newly created tickets for accuracy
- Verify resolved tickets were correctly identified
- Adjust similarity thresholds if needed

### 3. Maintenance
- Clean up very old processed suggestions periodically
- Archive resolved tickets older than 90 days
- Monitor for false positives/negatives

## Troubleshooting

### Common Issues

#### Duplicate Tickets Still Created
- Check if suggestion text varies significantly
- Verify hash generation is consistent
- Review similarity threshold (may need adjustment)

#### Valid Tickets Resolved
- Check if PR is still in latest analysis
- Verify suggestion text matching logic
- Review age-based resolution criteria

#### Performance Issues
- Large processed suggestions file (>10MB)
- Consider archiving old entries
- Optimize text similarity algorithm

### Debug Commands
```bash
# Test individual components
node -e "import('./coderabbit-auto-tickets.js').then(m => console.log('✅ Auto-tickets loaded'))"
node -e "import('./resolve-outdated-coderabbit-tickets.js').then(m => console.log('✅ Resolver loaded'))"

# Check file permissions
ls -la tests/bug-reports/processed-coderabbit-suggestions.json

# Validate JSON structure
cat tests/bug-reports/processed-coderabbit-suggestions.json | jq '.'
```

## Integration with CI/CD

### GitHub Actions Example
```yaml
name: CodeRabbit Ticket Management
on:
  pull_request:
    types: [closed]
  schedule:
    - cron: '0 9 * * *'  # Daily at 9 AM

jobs:
  manage-tickets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run coderabbit:cycle
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Future Enhancements

### Planned Features
- **ML-Based Similarity**: Use semantic similarity instead of word overlap
- **Auto-Assignment**: Assign tickets based on file ownership
- **Priority Learning**: Learn from manual priority adjustments
- **Integration APIs**: Connect with Jira, Linear, or other tools

### Extensibility
The system is designed to be extensible:
- Add new deduplication strategies
- Implement custom priority algorithms
- Integrate with external systems
- Add notification mechanisms

## Support

For issues or questions:
1. Check the logs for detailed error messages
2. Verify file permissions and JSON structure
3. Test individual components in isolation
4. Review the troubleshooting section above

The deduplication system is robust and handles edge cases gracefully, but monitoring and occasional manual review ensure optimal performance. 
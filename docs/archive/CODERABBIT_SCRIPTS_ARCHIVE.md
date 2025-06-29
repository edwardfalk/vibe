# ARCHIVE: Historical Reference Only

> This document is for historical reference. Some information may be obsolete due to the completed modular migration.

# CodeRabbit Scripts Archive

**Date:** 2025-01-08  
**Reason:** Migrated to centralized RAG vector database system via code-knowledge-hub MCP server

## Archived Files

The following CodeRabbit-related scripts have been archived as they are no longer needed:

### Core CodeRabbit Scripts
- `coderabbit-auto-tickets.js` - Automated ticket creation from CodeRabbit reviews
- `coderabbit-ticket-workflow.js` - Workflow management for CodeRabbit tickets
- `resolve-coderabbit-tickets.js` - Script to resolve CodeRabbit tickets systematically
- `resolve-outdated-coderabbit-tickets.js` - Cleanup of outdated CodeRabbit tickets
- `pull-coderabbit-reviews.js` - Simple CodeRabbit review puller
- `fetch-complete-coderabbit-reviews.js` - Complete CodeRabbit review fetcher
- `analyze-coderabbit-data.js` - CodeRabbit data analysis
- `check-coderabbit.js` - CodeRabbit configuration checker
- `test-coderabbit-cycle.js` - CodeRabbit cycle testing

### Supporting Files
- `js/coderabbit-ticket-integration.js` - CodeRabbit ticket integration module
- `js/coderabbit-pull-reviews.js` - CodeRabbit review puller module
- `js/coderabbit-review-processor.js` - CodeRabbit review processing
- `coderabbit-reviews/` directory - All stored CodeRabbit review data

### Configuration Files
- `.coderabbit.yaml` - CodeRabbit configuration (may be kept for reference)

## New Approach

CodeRabbit reviews for all projects are now:
1. Fetched centrally in another project
2. Stored in a RAG vector database using a local AI model
3. Accessible via the `code-knowledge-hub` MCP server

## Migration Benefits

- ✅ Centralized review management across all projects
- ✅ Better search and retrieval via vector database
- ✅ Reduced code duplication
- ✅ Improved performance with local AI model
- ✅ Cleaner project structure

## Rollback Plan

If the new system doesn't work as expected:
1. These archived scripts can be restored
2. The `coderabbit-reviews/` directory contains historical data
3. All functionality can be re-enabled by updating package.json scripts

## Testing the New System

Use the MCP server `code-knowledge-hub` to access CodeRabbit reviews:
```javascript
// Example usage (to be tested)
const reviews = await mcpClient.call('code-knowledge-hub', 'searchReviews', {
  project: 'vibe',
  query: 'security issues',
  limit: 10
});
``` 
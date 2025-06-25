#!/usr/bin/env node

/**
 * Fetch New CodeRabbit Reviews
 * 
 * This script fetches only new CodeRabbit reviews that haven't been processed yet.
 * It uses timestamps and the autofix log to identify unprocessed suggestions.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'edwardfalk';
const REPO_NAME = 'vibe';
const API_BASE = 'https://api.github.com';

if (!GITHUB_TOKEN) {
  console.error('❌ GITHUB_TOKEN environment variable is required');
  process.exit(1);
}

/**
 * Get the last processed timestamp from autofix log
 */
function getLastProcessedTimestamp() {
  const logPath = join(process.cwd(), 'coderabbit-reviews', 'coderabbit-autofix-log.md');
  
  if (!existsSync(logPath)) {
    console.log('📝 No autofix log found, will fetch all recent reviews');
    return null;
  }

  const logContent = readFileSync(logPath, 'utf8');
  
  // Find the most recent timestamp in the log
  const timestampMatches = logContent.matchAll(/### \[([^\]]+)\]/g);
  let lastTimestamp = null;
  
  for (const match of timestampMatches) {
    const timestamp = new Date(match[1]);
    if (!lastTimestamp || timestamp > lastTimestamp) {
      lastTimestamp = timestamp;
    }
  }
  
  if (lastTimestamp) {
    console.log(`📅 Last processed timestamp: ${lastTimestamp.toISOString()}`);
  } else {
    console.log('📝 No timestamps found in autofix log, will fetch all recent reviews');
  }
  
  return lastTimestamp;
}

/**
 * Extract processed suggestions from autofix log
 */
function getProcessedSuggestions() {
  const logPath = join(process.cwd(), 'coderabbit-reviews', 'coderabbit-autofix-log.md');
  
  if (!existsSync(logPath)) {
    console.log('📝 No autofix log found, all suggestions will be considered new');
    return new Set();
  }

  const logContent = readFileSync(logPath, 'utf8');
  const processedSuggestions = new Set();

  // Extract file and line information from applied/skipped actions
  const actionMatches = logContent.matchAll(/#### File: ([^\n]+)\n- \*\*Line\/Section\*\*: ([^\n]+)/g);
  
  for (const match of actionMatches) {
    const file = match[1].trim();
    const lineSection = match[2].trim();
    
    // Create a unique key for each processed suggestion
    const key = `${file}:${lineSection}`;
    processedSuggestions.add(key);
  }

  console.log(`📋 Found ${processedSuggestions.size} processed suggestions in autofix log`);
  return processedSuggestions;
}

/**
 * Fetch pull request reviews from GitHub API
 */
async function fetchPullRequestReviews(prNumber) {
  const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${prNumber}/reviews`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Vibe-CodeRabbit-Review-Fetcher'
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Fetch review comments from GitHub API
 */
async function fetchReviewComments(reviewId) {
  const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/pulls/comments/${reviewId}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Vibe-CodeRabbit-Review-Fetcher'
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Parse suggestion from review comment
 */
function parseSuggestion(comment) {
  const { path, line, body, html_url, created_at } = comment;
  
  // Extract suggestion text from comment body
  const suggestionMatch = body.match(/```(?:suggestion)?\s*\n([\s\S]*?)\n```/);
  const suggestion = suggestionMatch ? suggestionMatch[1].trim() : body.trim();
  
  return {
    file: path,
    line: line,
    suggestion: suggestion,
    url: html_url,
    commentId: comment.id,
    createdAt: created_at,
    timestamp: new Date(created_at)
  };
}

/**
 * Check if suggestion is new (not processed and after last timestamp)
 */
function isNewSuggestion(suggestion, processedSuggestions, lastProcessedTimestamp) {
  // Check if already processed by file:line
  const key = `${suggestion.file}:${suggestion.line}`;
  if (processedSuggestions.has(key)) {
    return false;
  }
  
  // Check if after last processed timestamp
  if (lastProcessedTimestamp && suggestion.timestamp <= lastProcessedTimestamp) {
    return false;
  }
  
  return true;
}

/**
 * Fetch new reviews from recent pull requests
 */
async function fetchNewReviews() {
  console.log('🤖 Fetching new CodeRabbit reviews...\n');
  
  const lastProcessedTimestamp = getLastProcessedTimestamp();
  const processedSuggestions = getProcessedSuggestions();
  const newSuggestions = [];
  
  // Fetch recent pull requests (last 10)
  const prsUrl = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/pulls?state=all&sort=updated&direction=desc&per_page=10`;
  const prsResponse = await fetch(prsUrl, {
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Vibe-CodeRabbit-Review-Fetcher'
    }
  });

  if (!prsResponse.ok) {
    throw new Error(`Failed to fetch PRs: ${prsResponse.status}`);
  }

  const pullRequests = await prsResponse.json();
  
  for (const pr of pullRequests) {
    console.log(`📋 Processing PR #${pr.number}: ${pr.title}`);
    
    try {
      const reviews = await fetchPullRequestReviews(pr.number);
      
      for (const review of reviews) {
        // Only process CodeRabbit reviews
        if (review.user?.login !== 'coderabbit[bot]') {
          continue;
        }
        
        console.log(`  🔍 Review ${review.id} by CodeRabbit (${review.submitted_at})`);
        
        // Fetch review comments
        const comments = await fetchReviewComments(review.id);
        
        for (const comment of comments) {
          const suggestion = parseSuggestion(comment);
          
          if (isNewSuggestion(suggestion, processedSuggestions, lastProcessedTimestamp)) {
            newSuggestions.push({
              ...suggestion,
              prNumber: pr.number,
              prTitle: pr.title,
              reviewId: review.id
            });
            console.log(`    ✨ New suggestion: ${suggestion.file}:${suggestion.line} (${suggestion.createdAt})`);
          } else {
            const reason = processedSuggestions.has(`${suggestion.file}:${suggestion.line}`) 
              ? 'already processed' 
              : 'before last timestamp';
            console.log(`    ⏭️  Skipped: ${suggestion.file}:${suggestion.line} (${reason})`);
          }
        }
      }
    } catch (error) {
      console.error(`  ❌ Error processing PR #${pr.number}:`, error.message);
    }
  }
  
  return newSuggestions;
}

/**
 * Generate summary of new suggestions
 */
function generateNewSuggestionsSummary(newSuggestions) {
  const summary = [];
  
  // Group by file
  const suggestionsByFile = {};
  for (const suggestion of newSuggestions) {
    if (!suggestionsByFile[suggestion.file]) {
      suggestionsByFile[suggestion.file] = [];
    }
    suggestionsByFile[suggestion.file].push(suggestion);
  }
  
  // Generate summary
  for (const [file, suggestions] of Object.entries(suggestionsByFile)) {
    summary.push({
      file,
      suggestions: suggestions.map(s => ({
        line: s.line,
        suggestion: s.suggestion,
        url: s.url,
        prNumber: s.prNumber,
        prTitle: s.prTitle,
        createdAt: s.createdAt
      }))
    });
  }
  
  return summary;
}

/**
 * Main execution
 */
async function main() {
  try {
    const newSuggestions = await fetchNewReviews();
    
    if (newSuggestions.length === 0) {
      console.log('\n✅ No new CodeRabbit suggestions found!');
      return;
    }
    
    console.log(`\n🎯 Found ${newSuggestions.length} new suggestions:`);
    
    const summary = generateNewSuggestionsSummary(newSuggestions);
    
    // Save new suggestions summary
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = join(process.cwd(), 'coderabbit-reviews', `new-suggestions-${timestamp}.json`);
    
    writeFileSync(outputPath, JSON.stringify(summary, null, 2));
    
    // Display summary
    console.log('\n📊 New Suggestions Summary:');
    console.log('============================');
    
    for (const fileGroup of summary) {
      console.log(`\n📁 ${fileGroup.file} (${fileGroup.suggestions.length} suggestions):`);
      
      for (const suggestion of fileGroup.suggestions) {
        const suggestionPreview = suggestion.suggestion.length > 100 
          ? suggestion.suggestion.substring(0, 100) + '...'
          : suggestion.suggestion;
        
        console.log(`  Line ${suggestion.line}: ${suggestionPreview}`);
        console.log(`  PR #${suggestion.prNumber}: ${suggestion.prTitle}`);
        console.log(`  Created: ${suggestion.createdAt}`);
        console.log(`  URL: ${suggestion.url}\n`);
      }
    }
    
    console.log(`\n💾 New suggestions saved to: ${outputPath}`);
    console.log(`\n🚀 Next steps:`);
    console.log(`   1. Review the new suggestions`);
    console.log(`   2. Apply fixes where appropriate`);
    console.log(`   3. Update the autofix log with your actions`);
    
  } catch (error) {
    console.error('❌ Error fetching new reviews:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}

export { fetchNewReviews, getProcessedSuggestions, getLastProcessedTimestamp }; 
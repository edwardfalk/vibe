/**
 * Comprehensive CodeRabbit Review Fetcher
 * Fetches complete CodeRabbit reviews from GitHub including:
 * - General reviews
 * - Line-by-line comments
 * - Review threads and conversations
 * - File context and suggestions
 * Saves structured data to files for analysis and ticket creation
 */

import { CONFIG } from './js/config.js';
import {
  retryOperation,
  logError,
  validateApiResponse,
} from './js/errorHandler.js';
import fs from 'fs/promises';
import path from 'path';

// Configuration for comprehensive fetching
const FETCH_CONFIG = {
  MAX_PRS: 50, // Fetch more PRs for comprehensive analysis
  SAVE_TO_FILES: true,
  OUTPUT_DIR: 'coderabbit-reviews',
  INCLUDE_CLOSED_PRS: true,
  FETCH_ALL_COMMENTS: true,
};

/**
 * Main function to fetch complete CodeRabbit reviews
 */
async function fetchCompleteCodeRabbitReviews() {
  console.log('🤖 Fetching COMPLETE CodeRabbit reviews from GitHub...\n');

  const owner = CONFIG.GITHUB.OWNER;
  const repo = CONFIG.GITHUB.REPO;
  const githubToken = CONFIG.GITHUB.TOKEN;

  if (!githubToken) {
    console.warn('⚠️ No GitHub token found. API requests will be rate limited.');
    console.log('💡 Set GITHUB_TOKEN environment variable for better performance.\n');
  }

  try {
    // Ensure output directory exists
    if (FETCH_CONFIG.SAVE_TO_FILES) {
      await ensureOutputDirectory();
    }

    // Fetch pull requests
    const prs = await fetchPullRequests(owner, repo, githubToken);
    console.log(`📋 Found ${prs.length} pull requests to analyze\n`);

    const allReviewData = [];
    let totalReviews = 0;
    let totalComments = 0;
    let totalSuggestions = 0;

    // Process each PR comprehensively
    for (const pr of prs) {
      console.log(`🔍 Processing PR #${pr.number}: ${pr.title}`);
      
      const prReviewData = {
        pr: {
          number: pr.number,
          title: pr.title,
          state: pr.state,
          created_at: pr.created_at,
          updated_at: pr.updated_at,
          html_url: pr.html_url,
          user: pr.user?.login,
          base: pr.base?.ref,
          head: pr.head?.ref,
        },
        reviews: [],
        reviewComments: [],
        suggestions: [],
        summary: {
          totalReviews: 0,
          totalComments: 0,
          totalSuggestions: 0,
          categories: {},
          priorities: {},
        }
      };

      // Fetch general reviews
      const reviews = await fetchPRReviews(owner, repo, pr.number, githubToken);
      const coderabbitReviews = reviews.filter(
        review => review.user && review.user.login === 'coderabbitai[bot]'
      );

      if (coderabbitReviews.length > 0) {
        console.log(`   🤖 Found ${coderabbitReviews.length} CodeRabbit reviews`);
        prReviewData.reviews = coderabbitReviews;
        totalReviews += coderabbitReviews.length;
        prReviewData.summary.totalReviews = coderabbitReviews.length;

        // Analyze each review for suggestions
        for (const review of coderabbitReviews) {
          const suggestions = analyzeReviewContent(review.body || '', {
            prNumber: pr.number,
            reviewId: review.id,
            type: 'general_review'
          });
          prReviewData.suggestions.push(...suggestions);
        }
      }

      // Fetch review comments (line-by-line comments)
      const reviewComments = await fetchPRReviewComments(owner, repo, pr.number, githubToken);
      const coderabbitComments = reviewComments.filter(
        comment => comment.user && comment.user.login === 'coderabbitai[bot]'
      );

      if (coderabbitComments.length > 0) {
        console.log(`   💬 Found ${coderabbitComments.length} CodeRabbit line comments`);
        prReviewData.reviewComments = coderabbitComments;
        totalComments += coderabbitComments.length;
        prReviewData.summary.totalComments = coderabbitComments.length;

        // Analyze each comment for suggestions
        for (const comment of coderabbitComments) {
          const suggestions = analyzeReviewContent(comment.body || '', {
            prNumber: pr.number,
            commentId: comment.id,
            type: 'line_comment',
            file: comment.path,
            line: comment.line || comment.original_line,
            diffHunk: comment.diff_hunk,
          });
          prReviewData.suggestions.push(...suggestions);
        }
      }

      // Summarize suggestions for this PR
      const prSuggestions = prReviewData.suggestions;
      prReviewData.summary.totalSuggestions = prSuggestions.length;
      totalSuggestions += prSuggestions.length;

      // Categorize suggestions
      prSuggestions.forEach(suggestion => {
        prReviewData.summary.categories[suggestion.category] = 
          (prReviewData.summary.categories[suggestion.category] || 0) + 1;
        prReviewData.summary.priorities[suggestion.priority] = 
          (prReviewData.summary.priorities[suggestion.priority] || 0) + 1;
      });

      // Display summary for this PR
      if (prSuggestions.length > 0) {
        console.log(`   💡 ${prSuggestions.length} total suggestions found`);
        
        const highPriority = prSuggestions.filter(s => s.priority === 'high');
        if (highPriority.length > 0) {
          console.log(`   🚨 ${highPriority.length} high-priority suggestions`);
        }

        // Show category breakdown
        const categories = Object.entries(prReviewData.summary.categories);
        if (categories.length > 0) {
          console.log(`   📊 Categories: ${categories.map(([cat, count]) => `${cat}(${count})`).join(', ')}`);
        }
      } else {
        console.log('   📭 No CodeRabbit suggestions found');
      }

      allReviewData.push(prReviewData);
      console.log(''); // Empty line for readability
    }

    // Save complete data to files
    if (FETCH_CONFIG.SAVE_TO_FILES) {
      await saveReviewData(allReviewData);
    }

    // Display comprehensive summary
    displayComprehensiveSummary(allReviewData, totalReviews, totalComments, totalSuggestions);

    return allReviewData;

  } catch (error) {
    console.error('❌ Error fetching complete CodeRabbit reviews:', error.message);
    
    if (error.message.includes('rate limit')) {
      console.log('\n💡 Tip: Set GITHUB_TOKEN environment variable to increase rate limits');
    }
    
    throw error;
  }
}

/**
 * Fetch pull requests from GitHub
 */
async function fetchPullRequests(owner, repo, githubToken) {
  const headers = createHeaders(githubToken);
  const state = FETCH_CONFIG.INCLUDE_CLOSED_PRS ? 'all' : 'open';
  
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=${state}&per_page=${FETCH_CONFIG.MAX_PRS}&sort=updated&direction=desc`;

  console.log(`🔍 Fetching ${FETCH_CONFIG.MAX_PRS} pull requests (${state})...`);
  
  const response = await retryOperation(
    async () => {
      const res = await fetch(url, { headers });
      return validateApiResponse(res, { operation: 'fetchPullRequests' });
    },
    CONFIG.GITHUB.RATE_LIMIT.MAX_RETRIES,
    CONFIG.GITHUB.RATE_LIMIT.RETRY_DELAY
  );

  return await response.json();
}

/**
 * Fetch reviews for a specific PR
 */
async function fetchPRReviews(owner, repo, prNumber, githubToken) {
  const headers = createHeaders(githubToken);
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`;

  const response = await retryOperation(
    async () => {
      const res = await fetch(url, { headers });
      return validateApiResponse(res, { operation: 'fetchPRReviews' });
    },
    CONFIG.GITHUB.RATE_LIMIT.MAX_RETRIES,
    CONFIG.GITHUB.RATE_LIMIT.RETRY_DELAY
  );

  return await response.json();
}

/**
 * Fetch review comments (line-by-line comments) for a specific PR
 */
async function fetchPRReviewComments(owner, repo, prNumber, githubToken) {
  const headers = createHeaders(githubToken);
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/comments`;

  const response = await retryOperation(
    async () => {
      const res = await fetch(url, { headers });
      return validateApiResponse(res, { operation: 'fetchPRReviewComments' });
    },
    CONFIG.GITHUB.RATE_LIMIT.MAX_RETRIES,
    CONFIG.GITHUB.RATE_LIMIT.RETRY_DELAY
  );

  return await response.json();
}

/**
 * Create headers for GitHub API requests
 */
function createHeaders(githubToken) {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Vibe-CodeRabbit-Fetcher/1.0',
  };

  if (githubToken) {
    headers['Authorization'] = `token ${githubToken}`;
  }

  return headers;
}

/**
 * Enhanced analysis of review content for suggestions
 */
function analyzeReviewContent(content, context = {}) {
  if (!content) return [];

  const suggestions = [];

  // Enhanced patterns for CodeRabbit suggestions
  const patterns = [
    // Bold suggestions with descriptions
    { 
      regex: /\*\*([^*]+)\*\*\s*\n\n([^`\n]+)/g, 
      type: 'suggestion',
      extractText: (match) => `${match[1]}: ${match[2]}`
    },
    // Warning emojis
    { 
      regex: /⚠️\s*([^`\n]+)/g, 
      type: 'warning',
      extractText: (match) => match[1]
    },
    // Tool/refactor suggestions
    { 
      regex: /🛠️\s*([^`\n]+)/g, 
      type: 'refactor',
      extractText: (match) => match[1]
    },
    // Consider suggestions
    { 
      regex: /Consider\s+([^.]+\.?)/gi, 
      type: 'suggestion',
      extractText: (match) => `Consider ${match[1]}`
    },
    // Avoid warnings
    { 
      regex: /Avoid\s+([^.]+\.?)/gi, 
      type: 'warning',
      extractText: (match) => `Avoid ${match[1]}`
    },
    // Recommendation patterns
    { 
      regex: /I recommend\s+([^.]+\.?)/gi, 
      type: 'recommendation',
      extractText: (match) => `Recommend ${match[1]}`
    },
    // Security patterns
    { 
      regex: /🔒\s*([^`\n]+)/g, 
      type: 'security',
      extractText: (match) => match[1]
    },
    // Performance patterns
    { 
      regex: /⚡\s*([^`\n]+)/g, 
      type: 'performance',
      extractText: (match) => match[1]
    },
    // Bug patterns
    { 
      regex: /🐛\s*([^`\n]+)/g, 
      type: 'bug',
      extractText: (match) => match[1]
    },
    // Code blocks with suggestions
    {
      regex: /```[\s\S]*?```\s*\n([^`\n]+)/g,
      type: 'code_suggestion',
      extractText: (match) => match[1]
    }
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.regex.exec(content)) !== null) {
      const text = pattern.extractText(match).trim();
      
      if (text.length > 10) { // Filter out very short matches
        const suggestion = {
          text,
          type: pattern.type,
          category: categorizeIssue(text),
          priority: prioritizeIssue(text),
          context: {
            ...context,
            originalContent: content,
            matchedPattern: pattern.regex.source,
          },
          metadata: {
            extractedAt: new Date().toISOString(),
            contentLength: content.length,
          }
        };
        suggestions.push(suggestion);
      }
    }
  }

  // Also extract any remaining suggestions using simpler patterns
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.trim().length > 20 && 
        (line.includes('suggest') || line.includes('recommend') || 
         line.includes('should') || line.includes('could'))) {
      
      // Avoid duplicates
      const isDuplicate = suggestions.some(s => 
        s.text.toLowerCase().includes(line.trim().toLowerCase().substring(0, 30))
      );
      
      if (!isDuplicate) {
        suggestions.push({
          text: line.trim(),
          type: 'general',
          category: categorizeIssue(line),
          priority: prioritizeIssue(line),
          context: {
            ...context,
            originalContent: content,
            matchedPattern: 'line_analysis',
          },
          metadata: {
            extractedAt: new Date().toISOString(),
            contentLength: content.length,
          }
        });
      }
    }
  }

  return suggestions;
}

/**
 * Enhanced categorization of issues
 */
function categorizeIssue(content) {
  const lowercaseContent = content.toLowerCase();

  // Security patterns
  if (lowercaseContent.match(/security|vulnerability|exploit|xss|injection|auth|token|password|secret/)) {
    return 'security';
  }
  
  // Performance patterns
  if (lowercaseContent.match(/performance|optimization|slow|memory|cpu|cache|efficient/)) {
    return 'performance';
  }
  
  // Bug patterns
  if (lowercaseContent.match(/bug|error|exception|crash|fail|broken|issue/)) {
    return 'bug';
  }
  
  // Code quality patterns
  if (lowercaseContent.match(/refactor|clean|maintainable|readable|complexity/)) {
    return 'code_quality';
  }
  
  // Testing patterns
  if (lowercaseContent.match(/test|testing|coverage|mock|assert|spec/)) {
    return 'testing';
  }
  
  // Documentation patterns
  if (lowercaseContent.match(/documentation|comment|doc|readme|explain/)) {
    return 'documentation';
  }
  
  // Style patterns
  if (lowercaseContent.match(/style|formatting|lint|prettier|convention/)) {
    return 'style';
  }
  
  // Architecture patterns
  if (lowercaseContent.match(/architecture|design|pattern|structure|module/)) {
    return 'architecture';
  }

  return 'general';
}

/**
 * Enhanced prioritization of issues
 */
function prioritizeIssue(content) {
  const lowercaseContent = content.toLowerCase();

  // Critical/High priority patterns
  if (lowercaseContent.match(/critical|security|vulnerability|crash|error|fail|broken|urgent/)) {
    return 'high';
  }

  // Medium priority patterns
  if (lowercaseContent.match(/performance|bug|optimization|refactor|important|should/)) {
    return 'medium';
  }

  // Low priority patterns (style, documentation, minor improvements)
  if (lowercaseContent.match(/style|formatting|comment|documentation|consider|could|minor/)) {
    return 'low';
  }

  return 'medium'; // Default to medium if unclear
}

/**
 * Ensure output directory exists
 */
async function ensureOutputDirectory() {
  try {
    await fs.mkdir(FETCH_CONFIG.OUTPUT_DIR, { recursive: true });
    console.log(`📁 Output directory ready: ${FETCH_CONFIG.OUTPUT_DIR}`);
  } catch (error) {
    console.error('❌ Failed to create output directory:', error.message);
    throw error;
  }
}

/**
 * Save complete review data to structured files
 */
async function saveReviewData(allReviewData) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  try {
    // Save complete data as JSON
    const completeDataFile = path.join(FETCH_CONFIG.OUTPUT_DIR, `complete-reviews-${timestamp}.json`);
    await fs.writeFile(completeDataFile, JSON.stringify(allReviewData, null, 2));
    console.log(`💾 Complete review data saved: ${completeDataFile}`);

    // Save summary data
    const summary = generateSummaryData(allReviewData);
    const summaryFile = path.join(FETCH_CONFIG.OUTPUT_DIR, `summary-${timestamp}.json`);
    await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2));
    console.log(`📊 Summary data saved: ${summaryFile}`);

    // Save high-priority suggestions separately
    const highPrioritySuggestions = extractHighPrioritySuggestions(allReviewData);
    const highPriorityFile = path.join(FETCH_CONFIG.OUTPUT_DIR, `high-priority-${timestamp}.json`);
    await fs.writeFile(highPriorityFile, JSON.stringify(highPrioritySuggestions, null, 2));
    console.log(`🚨 High-priority suggestions saved: ${highPriorityFile}`);

    // Save latest files (without timestamp for easy access)
    await fs.writeFile(path.join(FETCH_CONFIG.OUTPUT_DIR, 'latest-complete.json'), JSON.stringify(allReviewData, null, 2));
    await fs.writeFile(path.join(FETCH_CONFIG.OUTPUT_DIR, 'latest-summary.json'), JSON.stringify(summary, null, 2));
    await fs.writeFile(path.join(FETCH_CONFIG.OUTPUT_DIR, 'latest-high-priority.json'), JSON.stringify(highPrioritySuggestions, null, 2));

  } catch (error) {
    console.error('❌ Failed to save review data:', error.message);
    throw error;
  }
}

/**
 * Generate summary data from all reviews
 */
function generateSummaryData(allReviewData) {
  const summary = {
    generatedAt: new Date().toISOString(),
    totalPRs: allReviewData.length,
    totalReviews: 0,
    totalComments: 0,
    totalSuggestions: 0,
    categories: {},
    priorities: {},
    prBreakdown: [],
    topSuggestions: [],
  };

  for (const prData of allReviewData) {
    summary.totalReviews += prData.summary.totalReviews;
    summary.totalComments += prData.summary.totalComments;
    summary.totalSuggestions += prData.summary.totalSuggestions;

    // Aggregate categories and priorities
    for (const [category, count] of Object.entries(prData.summary.categories)) {
      summary.categories[category] = (summary.categories[category] || 0) + count;
    }
    for (const [priority, count] of Object.entries(prData.summary.priorities)) {
      summary.priorities[priority] = (summary.priorities[priority] || 0) + count;
    }

    // Add PR breakdown
    if (prData.summary.totalSuggestions > 0) {
      summary.prBreakdown.push({
        prNumber: prData.pr.number,
        title: prData.pr.title,
        suggestions: prData.summary.totalSuggestions,
        categories: prData.summary.categories,
        priorities: prData.summary.priorities,
      });
    }
  }

  // Sort PR breakdown by suggestion count
  summary.prBreakdown.sort((a, b) => b.suggestions - a.suggestions);

  // Extract top suggestions
  const allSuggestions = allReviewData.flatMap(pr => pr.suggestions);
  summary.topSuggestions = allSuggestions
    .filter(s => s.priority === 'high')
    .slice(0, 20)
    .map(s => ({
      text: s.text.substring(0, 100) + (s.text.length > 100 ? '...' : ''),
      category: s.category,
      priority: s.priority,
      prNumber: s.context.prNumber,
      file: s.context.file,
    }));

  return summary;
}

/**
 * Extract high-priority suggestions for immediate attention
 */
function extractHighPrioritySuggestions(allReviewData) {
  const highPriority = [];

  for (const prData of allReviewData) {
    const prHighPriority = prData.suggestions
      .filter(s => s.priority === 'high')
      .map(s => ({
        ...s,
        pr: {
          number: prData.pr.number,
          title: prData.pr.title,
          html_url: prData.pr.html_url,
        }
      }));
    
    highPriority.push(...prHighPriority);
  }

  return {
    generatedAt: new Date().toISOString(),
    totalHighPriority: highPriority.length,
    suggestions: highPriority.sort((a, b) => {
      // Sort by category priority: security > bug > performance > others
      const categoryPriority = { security: 4, bug: 3, performance: 2 };
      const aPriority = categoryPriority[a.category] || 1;
      const bPriority = categoryPriority[b.category] || 1;
      return bPriority - aPriority;
    }),
  };
}

/**
 * Display comprehensive summary
 */
function displayComprehensiveSummary(allReviewData, totalReviews, totalComments, totalSuggestions) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 COMPREHENSIVE CODERABBIT REVIEW SUMMARY');
  console.log('='.repeat(60));
  
  console.log(`📋 Total PRs analyzed: ${allReviewData.length}`);
  console.log(`🤖 Total CodeRabbit reviews: ${totalReviews}`);
  console.log(`💬 Total line comments: ${totalComments}`);
  console.log(`💡 Total suggestions extracted: ${totalSuggestions}`);

  if (totalSuggestions > 0) {
    // Category breakdown
    const allSuggestions = allReviewData.flatMap(pr => pr.suggestions);
    const categories = {};
    const priorities = {};

    allSuggestions.forEach(s => {
      categories[s.category] = (categories[s.category] || 0) + 1;
      priorities[s.priority] = (priorities[s.priority] || 0) + 1;
    });

    console.log('\n📊 Suggestion Categories:');
    Object.entries(categories)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`   ${category}: ${count}`);
      });

    console.log('\n🎯 Priority Breakdown:');
    Object.entries(priorities)
      .sort(([,a], [,b]) => b - a)
      .forEach(([priority, count]) => {
        const emoji = priority === 'high' ? '🚨' : priority === 'medium' ? '⚠️' : '💡';
        console.log(`   ${emoji} ${priority}: ${count}`);
      });

    // Top PRs with most suggestions
    const prsBySuggestions = allReviewData
      .filter(pr => pr.suggestions.length > 0)
      .sort((a, b) => b.suggestions.length - a.suggestions.length)
      .slice(0, 5);

    if (prsBySuggestions.length > 0) {
      console.log('\n🔝 PRs with Most Suggestions:');
      prsBySuggestions.forEach(pr => {
        console.log(`   PR #${pr.pr.number}: ${pr.suggestions.length} suggestions - ${pr.pr.title}`);
      });
    }

    console.log('\n💡 Next Steps:');
    console.log('   1. Review saved files in coderabbit-reviews/ directory');
    console.log('   2. Check latest-high-priority.json for immediate actions');
    console.log('   3. Use coderabbit-auto-tickets.js to create tickets');
    console.log('   4. Implement high-priority security and bug fixes first');
  }

  console.log('\n' + '='.repeat(60));
}

// Run the script if called directly
if (import.meta.url.endsWith(process.argv[1]) || 
    import.meta.url.includes('fetch-complete-coderabbit-reviews.js')) {
  fetchCompleteCodeRabbitReviews().catch(error => {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  });
}

export { 
  fetchCompleteCodeRabbitReviews, 
  FETCH_CONFIG,
  analyzeReviewContent,
  categorizeIssue,
  prioritizeIssue 
}; 
// Extract actionable CodeRabbit review comments and group by file
// Usage: bun run scripts/extract-actionable-coderabbit.js

const fs = require('fs');
const path = require('path');
const marked = require('marked');

const INPUT = path.join(__dirname, '../coderabbit-reviews/latest-50.json');

function isActionable(comment) {
  if (!comment || typeof comment.body !== 'string') return false;
  const body = comment.body.toLowerCase();
  // Only exclude if short and contains status phrases
  if (
    body.length < 400 &&
    (body.includes('auto-generated') ||
      body.includes('skip review') ||
      body.includes('summarized by coderabbit') ||
      body.includes('tips'))
  ) {
    return false;
  }
  const actionableKeywords = [
    'fix',
    'consider',
    'replace',
    'add',
    'remove',
    'refactor',
    'should',
    'recommend',
    'suggest',
    'improve',
    'error',
    'bug',
    'security',
    'performance',
  ];
  return actionableKeywords.some((k) => body.includes(k));
}

function extractActionablesFromReviewBody(body) {
  const result = [];
  // Find all <summary>filename (N)</summary><blockquote>...</blockquote> sections
  const fileSectionRegex =
    /<summary>([^<]+) \((\d+)\)<\/summary><blockquote>([\s\S]*?)<\/blockquote>/g;
  let match;
  while ((match = fileSectionRegex.exec(body))) {
    const file = match[1].trim();
    const block = match[3];
    // Each actionable: `line-line`: **Title**  \n\nDescription\n\n---
    const actionableRegex =
      /`(\d+-\d+)`: \*\*(.*?)\*\*\s*\n\n([\s\S]*?)(?=---|$)/g;
    let aMatch;
    while ((aMatch = actionableRegex.exec(block))) {
      result.push({
        file,
        line: aMatch[1],
        title: aMatch[2],
        suggestion: aMatch[3].replace(/\n/g, ' ').slice(0, 200),
      });
    }
  }
  return result;
}

function main() {
  try {
    const raw = fs.readFileSync(INPUT, 'utf8');
    const comments = JSON.parse(raw);
    const actionable = comments.filter(isActionable);
    // Group by file
    const grouped = {};
    for (const comment of actionable) {
      const file = comment.path || 'NO_FILE';
      if (!grouped[file]) grouped[file] = [];
      grouped[file].push({
        line:
          comment.line || comment.position || comment.original_position || null,
        suggestion: comment.body.slice(0, 200).replace(/\s+/g, ' '),
        url: comment.html_url || null,
      });
    }
    // Sort files by number of suggestions descending
    const sorted = Object.entries(grouped)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([file, suggestions]) => ({ file, suggestions }));
    // Output to file
    fs.writeFileSync(
      'coderabbit-reviews/actionable-coderabbit-summary.json',
      JSON.stringify(sorted, null, 2)
    );
    if (
      sorted.length > 0 &&
      sorted.some((entry) => entry.suggestions.length > 0)
    ) {
      console.log('CODERABBIT_EXTRACTION_SUCCESS');
    } else {
      console.log('CODERABBIT_EXTRACTION_EMPTY');
    }
    // Print a sample of excluded comments for review
    const excluded = comments.filter((c) => !isActionable(c));
    console.log('\nSample of excluded comments:');
    excluded.slice(0, 3).forEach((c, i) => {
      console.log(`\n[${i + 1}] Type: ${c.type}, Path: ${c.path || 'N/A'}`);
      console.log(c.body.slice(0, 300).replace(/\s+/g, ' '));
    });
    // Print the full body of the first review with actionable comments
    const firstReview = comments.find(
      (c) =>
        c.type === 'review' &&
        c.body &&
        c.body.includes('Actionable comments posted')
    );
    if (firstReview) {
      console.log('\n--- FULL BODY OF FIRST ACTIONABLE REVIEW ---\n');
      console.log(firstReview.body);
      console.log('\n--- END BODY ---\n');
    }
  } catch (err) {
    console.error('CODERABBIT_EXTRACTION_ERROR', err);
    process.exit(1);
  }
}

main();

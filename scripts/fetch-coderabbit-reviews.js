// Fetch the latest 50 CodeRabbit reviews from GitHub for edwardfalk/vibe
// Usage: bun run scripts/fetch-coderabbit-reviews.js
require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const fs = require('fs');

const OWNER = 'edwardfalk';
const REPO = 'vibe';
const OUTPUT = 'coderabbit-reviews/latest-50.json';
const CODERABBIT_AUTHOR = 'coderabbitai[bot]'; // Updated to match actual bot username
const MAX_REVIEWS = 50;

async function main() {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  // 1. Fetch latest 30 PRs (to ensure enough reviews/comments)
  const prs = await octokit.pulls.list({
    owner: OWNER,
    repo: REPO,
    state: 'all',
    sort: 'updated',
    direction: 'desc',
    per_page: 30,
  });

  const allReviewsAndComments = [];

  for (const pr of prs.data) {
    // Fetch reviews (summary only)
    const reviews = await octokit.pulls.listReviews({
      owner: OWNER,
      repo: REPO,
      pull_number: pr.number,
      per_page: 20,
    });
    reviews.data.forEach((r) => {
      if (r.user && r.user.login === CODERABBIT_AUTHOR) {
        allReviewsAndComments.push({
          type: 'review',
          pr: pr.number,
          pr_title: pr.title,
          id: r.id,
          created_at: r.submitted_at || r.created_at,
          body: r.body,
          user: r.user.login,
          html_url: r.html_url || pr.html_url,
        });
      }
    });
    // Fetch PR comments (top-level)
    const prComments = await octokit.issues.listComments({
      owner: OWNER,
      repo: REPO,
      issue_number: pr.number,
      per_page: 20,
    });
    prComments.data.forEach((c) => {
      if (c.user && c.user.login === CODERABBIT_AUTHOR) {
        allReviewsAndComments.push({
          type: 'comment',
          pr: pr.number,
          pr_title: pr.title,
          id: c.id,
          created_at: c.created_at,
          body: c.body,
          user: c.user.login,
          html_url: c.html_url,
        });
      }
    });
    // Fetch inline review comments (file/line-specific)
    const inlineComments = await octokit.pulls.listReviewComments({
      owner: OWNER,
      repo: REPO,
      pull_number: pr.number,
      per_page: 100,
    });
    inlineComments.data.forEach((ic) => {
      if (ic.user && ic.user.login === CODERABBIT_AUTHOR) {
        allReviewsAndComments.push({
          type: 'inline',
          pr: pr.number,
          pr_title: pr.title,
          id: ic.id,
          created_at: ic.created_at,
          body: ic.body,
          user: ic.user.login,
          html_url: ic.html_url,
          path: ic.path,
          position: ic.position,
          original_position: ic.original_position,
          diff_hunk: ic.diff_hunk,
          line: ic.line,
          side: ic.side,
        });
      }
    });
  }
  // Sort all by date, descending
  allReviewsAndComments.sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
  // Save latest 50
  fs.writeFileSync(
    OUTPUT,
    JSON.stringify(allReviewsAndComments.slice(0, MAX_REVIEWS), null, 2)
  );
  console.log(
    `Saved latest ${MAX_REVIEWS} CodeRabbit reviews/comments (including inline) to ${OUTPUT}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

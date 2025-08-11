#!/usr/bin/env bun
/**
 * coderabbit-fetch-latest.js
 * Simple, reliable fetch of recent CodeRabbit reviews/comments for this repo.
 * - Requires GITHUB_TOKEN with repo read access
 * - Outputs:
 *   - coderabbit-reviews/latest.json (flat array, newest first)
 *   - coderabbit-reviews/actionable-summary.json (grouped by file)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Octokit } from '@octokit/rest';

const OWNER = 'edwardfalk';
const REPO = 'vibe';
const BOT_LOGINS = new Set(['coderabbit[bot]', 'coderabbitai[bot]', 'CodeRabbitAI']);
const PR_LIMIT = 30;

function ensureDir(dir) {
  try {
    mkdirSync(dir, { recursive: true });
  } catch {}
}

function isActionableText(text) {
  if (!text) return false;
  const body = String(text).toLowerCase();
  const keywords = [
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
  return keywords.some((k) => body.includes(k));
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('❌ GITHUB_TOKEN is required');
    process.exit(1);
  }
  const octokit = new Octokit({ auth: token });

  const { data: prs } = await octokit.pulls.list({
    owner: OWNER,
    repo: REPO,
    state: 'all',
    sort: 'updated',
    direction: 'desc',
    per_page: PR_LIMIT,
  });

  const items = [];

  for (const pr of prs) {
    // Issue comments (top-level)
    const { data: issueComments } = await octokit.issues.listComments({
      owner: OWNER,
      repo: REPO,
      issue_number: pr.number,
      per_page: 100,
    });
    for (const c of issueComments) {
      if (!BOT_LOGINS.has(c.user?.login)) continue;
      items.push({
        type: 'comment',
        pr: pr.number,
        pr_title: pr.title,
        id: c.id,
        created_at: c.created_at,
        body: c.body || '',
        user: c.user?.login,
        html_url: c.html_url,
      });
    }

    // Inline review comments (per PR)
    const { data: reviewComments } = await octokit.pulls.listReviewComments({
      owner: OWNER,
      repo: REPO,
      pull_number: pr.number,
      per_page: 100,
    });
    for (const ic of reviewComments) {
      if (!BOT_LOGINS.has(ic.user?.login)) continue;
      items.push({
        type: 'inline',
        pr: pr.number,
        pr_title: pr.title,
        id: ic.id,
        created_at: ic.created_at,
        body: ic.body || '',
        user: ic.user?.login,
        html_url: ic.html_url,
        path: ic.path,
        line: ic.line ?? ic.original_line ?? null,
        position: ic.position ?? ic.original_position ?? null,
      });
    }

    // Review bodies (optional, sometimes empty)
    const { data: reviews } = await octokit.pulls.listReviews({
      owner: OWNER,
      repo: REPO,
      pull_number: pr.number,
      per_page: 50,
    });
    for (const r of reviews) {
      if (!BOT_LOGINS.has(r.user?.login)) continue;
      items.push({
        type: 'review',
        pr: pr.number,
        pr_title: pr.title,
        id: r.id,
        created_at: r.submitted_at || r.created_at,
        body: r.body || '',
        user: r.user?.login,
        html_url: r.html_url || pr.html_url,
      });
    }
  }

  // Sort newest first
  items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // Write outputs
  const outDir = join(process.cwd(), 'coderabbit-reviews');
  ensureDir(outDir);
  const latestPath = join(outDir, 'latest.json');
  writeFileSync(latestPath, JSON.stringify(items, null, 2));

  // Actionable summary by file
  const grouped = {};
  for (const it of items) {
    if (it.type !== 'inline') continue; // actionable focus: inline comments
    if (!isActionableText(it.body)) continue;
    const key = it.path || 'NO_FILE';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({
      pr: it.pr,
      url: it.html_url,
      line: it.line ?? it.position,
      created_at: it.created_at,
      snippet: (it.body || '').slice(0, 200).replace(/\s+/g, ' '),
    });
  }
  const summary = Object.entries(grouped)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([file, suggestions]) => ({ file, suggestions }));
  const summaryPath = join(outDir, 'actionable-summary.json');
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log(`✅ Saved ${items.length} items → ${latestPath}`);
  console.log(`✅ Actionable summary (${summary.length} files) → ${summaryPath}`);
}

main().catch((err) => {
  console.error('❌ coderabbit-fetch-latest failed:', err?.message || err);
  process.exit(1);
});



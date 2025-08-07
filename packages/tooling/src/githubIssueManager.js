// githubIssueManager.js - Thin wrapper around GitHub Issues API for automated bug/feature tracking
// Requires: process.env.GITHUB_TOKEN with repo-scoped permissions (public_repo or repo)
// Usage (ESM):
//   import { createIssue } from './githubIssueManager.js';
//   await createIssue({ title: 'Bug: player stuck', body: 'Steps to reproduce...', labels: ['bug'] });
//
// NOTE: This is a minimal first pass implementation targeting Bun's native fetch.
//       It is intentionally dependency-free; switch to Octokit if we need advanced features later.

const DEFAULT_API_BASE = 'https://api.github.com';

/**
 * Resolve the owner/repo slug from git remote URL (best-effort).
 * Falls back to env.GITHUB_REPO ("owner/repo") if auto-detection fails.
 */
async function resolveRepoSlug() {
  if (process.env.GITHUB_REPO) return process.env.GITHUB_REPO;
  try {
    const proc = Bun.spawnSync(['git', 'config', '--get', 'remote.origin.url']);
    const url = proc.stdout.toString().trim();
    if (!url) throw new Error('empty remote url');
    // Possible forms: https://github.com/owner/repo.git | git@github.com:owner/repo.git
    const match = url.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/i);
    if (match) {
      const owner = match[1];
      const repo = match[2].replace(/\.git$/, ''); // Remove .git suffix if present
      return `${owner}/${repo}`;
    }
  } catch (e) {
    // ignore
  }
  throw new Error(
    'Unable to determine GitHub repo slug – set GITHUB_REPO env var'
  );
}

/**
 * POST JSON helper with auth header.
 */
async function ghRequest(path, { method = 'GET', body } = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN missing in environment');
  const res = await fetch(`${DEFAULT_API_BASE}${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(
      `GitHub API ${method} ${path} failed: ${res.status} – ${txt}`
    );
  }
  return res.json();
}

/**
 * Create a new GitHub Issue.
 * @param {object} params
 * @param {string} params.title  – Issue title (≤ 100 chars recommended)
 * @param {string} params.body   – Markdown body
 * @param {string[]} [params.labels] – Labels to apply
 * @returns {Promise<number>} Issue number
 */
export async function createIssue({ title, body = '', labels = [] } = {}) {
  if (!title) throw new Error('createIssue: title required');
  const repo = await resolveRepoSlug();
  const [owner, repoName] = repo.split('/');
  const issue = await ghRequest(`/repos/${owner}/${repoName}/issues`, {
    method: 'POST',
    body: { title, body, labels },
  });
  console.log(`🐛 Created GitHub Issue #${issue.number}: ${issue.html_url}`);
  return issue.number;
}

/**
 * Update an existing GitHub Issue.
 */
export async function updateIssue(issueNumber, { title, body, labels }) {
  const repo = await resolveRepoSlug();
  const [owner, repoName] = repo.split('/');
  const issue = await ghRequest(`/repos/${owner}/${repoName}/issues/${issueNumber}`, {
    method: 'PATCH',
    body: { title, body, labels },
  });
  return issue;
}

/**
 * Add a comment to an existing GitHub Issue.
 */
export async function addComment(issueNumber, comment) {
  const repo = await resolveRepoSlug();
  const [owner, repoName] = repo.split('/');
  const result = await ghRequest(`/repos/${owner}/${repoName}/issues/${issueNumber}/comments`, {
    method: 'POST',
    body: { body: comment },
  });
  return result;
}

/**
 * Close a GitHub Issue.
 */
export async function closeIssue(issueNumber) {
  const repo = await resolveRepoSlug();
  const [owner, repoName] = repo.split('/');
  const issue = await ghRequest(`/repos/${owner}/${repoName}/issues/${issueNumber}`, {
    method: 'PATCH',
    body: { state: 'closed' },
  });
  return issue;
}

// ---------------------------------------------------------------------------
// OPTIONAL: Alias to ease migration – probes currently call createTicket
// ---------------------------------------------------------------------------
export async function createTicket(ticketData) {
  const {
    title = 'untitled',
    description = '',
    labels = ['bug'],
  } = ticketData || {};
  const body = `${description}\n\n## Raw Ticket Data\n\n\n
`; // Could stringify ticketData if needed
  return createIssue({ title, body, labels });
}

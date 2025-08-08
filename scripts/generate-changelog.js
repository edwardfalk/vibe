#!/usr/bin/env bun
// Enhanced Changelog generator – pulls closed GitHub Issues labeled `released`
// and groups them by type label (bug, feature, enhancement, task).
// Requires: GITHUB_TOKEN env var.

import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { Octokit } from '@octokit/rest';

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

function resolveRepo() {
  if (process.env.GITHUB_REPO) return process.env.GITHUB_REPO;
  try {
    const url = sh('git config --get remote.origin.url');
    const m = url.match(/github\.com[/:]([\w.-]+)\/([\w.-]+)(?:\.git)?$/i);
    if (m) return `${m[1]}/${m[2]}`;
  } catch {}
  throw new Error('Unable to determine repo slug – set GITHUB_REPO');
}

function getLastTagDate() {
  try {
    const tag = sh('git describe --tags --abbrev=0');
    const date = sh(`git log -1 --format=%aI ${tag}`);
    return new Date(date).toISOString();
  } catch {
    // Fallback to epoch start if no tag
    return '1970-01-01T00:00:00Z';
  }
}

async function fetchReleasedIssues(octokit, owner, repo, since) {
  const issues = [];
  let page = 1;
  while (true) {
    const { data } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state: 'closed',
      labels: 'released',
      since,
      per_page: 100,
      page,
    });
    if (data.length === 0) break;
    issues.push(...data.filter((it) => !it.pull_request));
    page += 1;
  }
  return issues;
}

function typeFromLabels(labels) {
  const lbls = labels.map((l) => l.name);
  if (lbls.includes('bug')) return 'bug';
  if (lbls.includes('feature')) return 'feature';
  if (lbls.includes('enhancement')) return 'enhancement';
  return 'task';
}

(async () => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('❌ GITHUB_TOKEN env var required');
    process.exit(1);
  }
  const repoSlug = resolveRepo();
  const [owner, repo] = repoSlug.split('/');
  const since = getLastTagDate();

  const octokit = new Octokit({ auth: token });
  console.log(`ℹ️  Fetching released issues closed since ${since}…`);
  const issues = await fetchReleasedIssues(octokit, owner, repo, since);
  if (issues.length === 0) {
    console.log('ℹ️  No released issues found – skipping CHANGELOG update.');
    process.exit(0);
  }

  // Group by type
  const groups = {};
  for (const issue of issues) {
    const type = typeFromLabels(issue.labels);
    if (!groups[type]) groups[type] = [];
    groups[type].push(issue);
  }

  // Build markdown
  const today = new Date().toISOString().slice(0, 10);
  let section = `## ${today} (via GitHub Issues)\n`;
  for (const type of Object.keys(groups)) {
    section += `\n### ${type}\n`;
    for (const iss of groups[type]) {
      section += `- ${iss.title} (#${iss.number})\n`;
    }
  }
  section += '\n';

  const changelogPath = join('docs', 'CHANGELOG.md');
  let existing = '';
  if (existsSync(changelogPath)) existing = readFileSync(changelogPath, 'utf8');
  if (existing.includes(`## ${today}`)) {
    console.log("ℹ️  CHANGELOG already contains today's section.");
    process.exit(0);
  }
  writeFileSync(changelogPath, section + existing, 'utf8');
  console.log(`✅ CHANGELOG updated with ${issues.length} issues.`);
})();

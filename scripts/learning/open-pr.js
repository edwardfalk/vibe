/**
 * Open PR utility
 * Creates a Pull Request from the current branch to the specified base branch.
 * Requires GITHUB_TOKEN in env (GitHub Actions provides this automatically).
 */

import { Octokit } from '@octokit/rest';
import { execSync } from 'child_process';

function sh(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] })
    .toString()
    .trim();
}

function parseOwnerRepo(remoteUrl) {
  // Supports git@github.com:owner/repo.git and https://github.com/owner/repo.git
  const ssh = /^git@[^:]+:([^/]+)\/([^\.]+)(?:\.git)?$/;
  const https = /^https?:\/\/[^/]+\/([^/]+)\/([^\.]+)(?:\.git)?$/;
  let m = remoteUrl.match(ssh);
  if (m) return { owner: m[1], repo: m[2] };
  m = remoteUrl.match(https);
  if (m) return { owner: m[1], repo: m[2] };
  throw new Error('Unrecognized remote URL: ' + remoteUrl);
}

async function main() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    console.error('GITHUB_TOKEN not set. Cannot open PR.');
    process.exit(2);
  }

  const base = process.env.PR_BASE || 'unstable';
  const head = sh('git rev-parse --abbrev-ref HEAD');
  const remoteUrl = sh('git config --get remote.origin.url');
  const { owner, repo } = parseOwnerRepo(remoteUrl);

  const title = process.env.PR_TITLE || `chore: automated update from ${head}`;
  const body =
    process.env.PR_BODY || 'Automated update. See checks for details.';

  const octokit = new Octokit({ auth: token });

  try {
    const resp = await octokit.pulls.create({
      owner,
      repo,
      title,
      head,
      base,
      body,
    });
    console.log('✅ PR created:', resp.data.html_url);
  } catch (e) {
    const msg = e?.message || String(e);
    if (msg.includes('A pull request already exists')) {
      console.log('ℹ️  PR already exists for this branch.');
      process.exit(0);
    }
    console.error('PR creation failed:', msg);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}

export {};

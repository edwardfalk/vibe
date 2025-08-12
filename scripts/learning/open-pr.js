/**
 * Open PR utility
 * Creates a Pull Request from the current branch to the specified base branch.
 * Requires GITHUB_TOKEN in env (GitHub Actions provides this automatically).
 */

import { Octokit } from '@octokit/rest';
// Load .env if available to pick up GITHUB_TOKEN locally
try {
  (await import('dotenv')).default?.config?.();
} catch {}
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

  const requestedBase = process.env.PR_BASE;
  const headBranch = sh('git rev-parse --abbrev-ref HEAD');
  const remoteUrl = sh('git config --get remote.origin.url');
  const { owner, repo } = parseOwnerRepo(remoteUrl);

  const title = process.env.PR_TITLE || `chore: automated update from ${headBranch}`;
  const body =
    process.env.PR_BODY || 'Automated update. See checks for details.';

  const octokit = new Octokit({ auth: token });

  try {
    // pick a valid base (prefer explicit env, else default_branch)
    let base = requestedBase;
    if (!base) {
      const repoInfo = await octokit.repos.get({ owner, repo });
      base = repoInfo.data.default_branch || 'main';
    }
    // verify base exists; fallback to main
    try {
      await octokit.repos.getBranch({ owner, repo, branch: base });
    } catch {
      if (base !== 'main') {
        await octokit.repos.getBranch({ owner, repo, branch: 'main' });
        base = 'main';
      } else {
        throw new Error(`Base branch '${base}' not found`);
      }
    }

    const head = `${owner}:${headBranch}`;
    const resp = await octokit.pulls.create({ owner, repo, title, head, base, body });
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

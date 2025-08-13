// scripts/probes-open-issue.js
// Create a GitHub Issue summarizing current probe reliability findings and plan.
import { createIssue } from '../packages/tooling/src/githubIssueManager.js';
import fs from 'fs/promises';

async function main() {
  const findings = [
    '## Probe Reliability Audit – Findings (2025-08-12)',
    '',
    '- Readiness gating',
    '  - Good: Most probes now wait for p5 draw start via frameCount checks.',
    "  - Risk: Some tests still rely on bare page.click('canvas') without locator fallback; prefer locator-based click or page.mouse fallback.",
    '- Determinism',
    '  - Liveness/collision rely on existing enemies; only some tests seed deterministically and force-spawn when needed.',
    '- Audio unlock',
    '  - Audio probe attempts explicit Tone.start() and clicks, good. Keep locator-first pattern.',
    '- Non-mutating checks',
    '  - Collision probe uses snapshot-restore and probeCheck({dryRun:true}) when present – good.',
    '- Over/under-asserting',
    '  - Startup dev-server probe asserts #ui/#score – OK.',
    '  - Comprehensive runner returns overallHealth and retries on context-destroy – good.',
    '',
    '## Concrete Issues',
    '',
    '1) Inconsistent gesture pattern across tests',
    "   - Some use page.click('canvas') (selector), others use page.mouse.click(x,y). Prefer locator('canvas').click() and fallback to mouse center when selector flaps.",
    '2) Deterministic enemy presence',
    '   - Liveness/collision can report failure if spawn cadence changes. Use setRandomSeed(1337) and force-spawn specific enemy types when asserting behaviors.',
    '3) Missing uniform readiness helper',
    '   - Multiple copies of waitForDrawStart exist (tests + probes). Centralize via tests/playwright.setup.js and ensure all tests use it.',
    '',
    '## Plan',
    '',
    '- Standardize helpers',
    '  - Ensure all tests import and use: gotoIndex, waitForDrawStart, setDeterministicSeed.',
    "  - Update tests to prefer page.locator('canvas').click() with fallback to page.mouse.click(center).",
    '- Deterministic seeding + spawning',
    '  - Before probes requiring enemies, call setRandomSeed(1337); if array empty, force-spawn via window.spawnSystem.forceSpawn().',
    '- Assertions',
    '  - Keep expect(result.failure).toBeNull() then minimal booleans (e.g., playerAlive, collisionsChecked).',
    '- Ticketing automation',
    '  - Keep GitHub creation in probes on failure, but guard behind presence of GITHUB_TOKEN and repo detection; otherwise no-op.',
    '',
    '## Acceptance criteria',
    '- 10 consecutive runs of bun run test:orchestrated pass without flake on a warm dev machine.',
    '- Headless and headed both pass in CI.',
    '- Probe failures produce actionable logs and (if configured) a GitHub issue with summary.',
  ].join('\n');

  const body =
    findings +
    `\n\n---\n\nRule added: a-probe-reliability-standards-20250812-01.mdc`;
  try {
    const issueNumber = await createIssue({
      title: 'Probe reliability audit: tighten readiness/gestures/determinism',
      body,
      labels: ['bug', 'probe', 'testing'],
    });
    console.log('Created issue #', issueNumber);
  } catch (e) {
    console.error('Failed to create issue:', e);
    // Fallback: write a local artifact under tests/bug-reports
    const dir = `tests/bug-reports/${new Date().toISOString().replace(/[:.]/g, '-')}_PROBE-RELIABILITY/`;
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(`${dir}PROBE-RELIABILITY.md`, body, 'utf8');
    console.log('Wrote fallback report to', `${dir}PROBE-RELIABILITY.md`);
  }
}

main().catch((e) => {
  console.error('Script error:', e);
  process.exit(1);
});

import { test, expect } from '@playwright/test';
import { spawnSync, spawn } from 'child_process';
import { DebugLogger } from '../packages/tooling/src/DebugLogger.js';

/** Helper to run shell commands and capture stdout. Throws on non-zero exit. */
function run(cmd) {
  const res = spawnSync(cmd, { shell: true, encoding: 'utf8' });
  if (res.status !== 0) throw new Error(res.stderr || res.stdout);
  return res.stdout.trim();
}

/** Ensure Ticket API is running (same helper as other probe). */
async function ensureTicketApi() {
  try {
    const ping = await fetch('http://localhost:3001/api/tickets');
    if (ping.ok) return;
  } catch {}
  console.log('⚙️  Starting Ticket API for workflow probe …');
  const apiProc = spawn('bun', ['run', 'ticket-api.js'], {
    shell: true,
    stdio: 'ignore',
    detached: true,
  });
  apiProc.unref();
  await new Promise((r) => setTimeout(r, 3000));
}

test.beforeAll(() => {
  DebugLogger.log('Playwright ticket workflow probe started');
});

test.describe('Ticket CLI workflow (AI stable)', () => {
  test('create → update → checklist → latest', async () => {
    await ensureTicketApi();

    // CREATE
    const createOut = run(
      'bun run ticket:create type=bug title="Workflow probe bug" tags=probe checklist="[\"Reproduce\",\"Fix\"]"'
    );
    const created = JSON.parse(createOut.split('Ticket created: ')[1] || '{}');
    expect(created.id).toBeTruthy();

    // UPDATE status
    const updOut = run(
      `bun run ticket:update id=${created.id} status=in-progress tags=probe,focus`
    );
    const updated = JSON.parse(updOut.split('Ticket updated: ')[1] || '{}');
    expect(updated.status).toBe('in-progress');

    // CHECK checklist step
    const checkOut = run(
      `bun run ticket:check id=${created.id} step="Reproduce" result="Confirmed"`
    );
    expect(checkOut).toMatch(/Checklist step 'Reproduce' checked/);

    // LATEST should return our focused ticket
    const latestOut = run('bun run ticket:latest');
    expect(latestOut).toMatch(created.id);
  });
});

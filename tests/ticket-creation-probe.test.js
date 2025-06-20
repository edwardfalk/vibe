import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';
import { DebugLogger } from '../packages/tooling/src/DebugLogger.js';

/** Ensure Ticket API is running on localhost:3001. If not, auto-start via Bun. */
async function ensureTicketApi() {
  const url = 'http://localhost:3001/api/tickets';
  try {
    const res = await fetch(url);
    if (res.ok) return;
  } catch {
    // not running – spawn detached API server
  }
  console.log('⚙️  Starting Ticket API for probe…');
  const proc = spawn('bun', ['run', 'ticket-api.js'], {
    shell: true,
    stdio: 'ignore',
    detached: true,
  });
  proc.unref();
  // wait up to 3s
  await new Promise((r) => setTimeout(r, 3000));
}

test.describe('Ticketing workflow probes', () => {
  test.beforeAll(async () => {
    DebugLogger.log('Playwright ticket creation probe started');
    await ensureTicketApi();
  });

  test('Create ticket via API and verify', async ({ page }) => {
    const id = `PROBE-${Date.now().toString(36)}`;
    const ticket = {
      id,
      type: 'task',
      title: 'Probe ticket creation',
      status: 'open',
      tags: ['probe'],
      checklist: [],
      history: [],
      artifacts: [],
      relatedTickets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // Create
    const createRes = await fetch('http://localhost:3001/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ticket),
    });
    expect(createRes.ok).toBe(true);
    // Retrieve
    const getRes = await fetch(`http://localhost:3001/api/tickets/${id}`);
    expect(getRes.ok).toBe(true);
    const fetched = await getRes.json();
    expect(fetched.id).toBe(id);
    expect(fetched.title).toBe(ticket.title);
  });
});

// ticket-cli.js
// Minimal CLI for ticket API (AI/automation-friendly)
// Usage:
//   bun run scripts/ticket-cli.js create type=bug title="My bug" status=open tags=test,urgent checklist='["step1","step2"]'
//   bun run scripts/ticket-cli.js update id=BUG-... status=closed
//   bun run scripts/ticket-cli.js get id=BUG-...
//   bun run scripts/ticket-cli.js list
//   bun run scripts/ticket-cli.js check id=BUG-... step="step1" result="Passed"
//   bun run scripts/ticket-cli.js latest
//
// Ticket IDs are always generated using the same logic as ticketManager.js (UI):
//   <TYPE>-<YYYY-MM-DD>-<random6>
// Example: BUG-2024-06-11-abc123
//
// Arguments: key=value pairs (type, title, status, tags, id, checklist, etc.)
// Checklist: pass as a JSON array of step names or objects
//
// Examples:
//   bun run scripts/ticket-cli.js create type=bug title="Something broke" tags=ai,urgent checklist='["Reproduce bug","Fix bug","Verify fix"]'
//   bun run scripts/ticket-cli.js check id=BUG-... step="Reproduce bug" result="Confirmed"
//   bun run scripts/ticket-cli.js latest

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import minimist from 'minimist';

const argv = minimist(process.argv.slice(2));
// first positional is the command
const [cmd] = argv._;

function buildParamsFromArgv() {
  const p = { ...argv };
  delete p._;
  // allow --step multi, convert to checklist
  if (Array.isArray(p.step)) {
    p.checklist = p.step;
    delete p.step;
  }
  // handle comma separated tags
  if (typeof p.tags === 'string') {
    p.tags = p.tags.split(',');
  }
  return p;
}

let params = buildParamsFromArgv();

// If --file is provided, merge JSON
if (params.file) {
  const filePath = params.file;
  if (!existsSync(filePath)) {
    console.error(`⛔ File not found: ${filePath}`);
    process.exit(1);
  }
  const fileData = JSON.parse(readFileSync(filePath, 'utf8'));
  params = { ...fileData, ...params };
  delete params.file;
}

const API = 'http://localhost:3001/api/tickets';

function parseTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}
function parseChecklist(cl) {
  if (!cl) return [];
  if (typeof cl === 'string') {
    try {
      const arr = JSON.parse(cl);
      return arr.map((s) =>
        typeof s === 'string'
          ? { step: s, done: false, result: null, timestamp: null }
          : s
      );
    } catch {
      // fallback: comma-separated
      return cl.split(',').map((s) => ({
        step: s.trim(),
        done: false,
        result: null,
        timestamp: null,
      }));
    }
  }
  if (Array.isArray(cl))
    return cl.map((s) =>
      typeof s === 'string'
        ? { step: s, done: false, result: null, timestamp: null }
        : s
    );
  return [];
}
// Unified ticket ID generation (matches ticketManager.js)
function generateTicketId(type = 'bug') {
  const prefix = type.toUpperCase().substring(0, 4);
  const date = new Date().toISOString().split('T')[0];
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${date}-${random}`;
}

async function handleError(action, err) {
  const msg = err.message || '';
  if (
    msg.includes('ConnectionRefused') ||
    msg.includes('connect ECONNREFUSED')
  ) {
    console.error(
      '⚠️  Ticket API not reachable. Attempting to auto-start on port 3001...'
    );
    const { spawn } = await import('child_process');
    const apiProc = spawn('bun', ['run', 'ticket-api.js'], {
      stdio: 'inherit',
      shell: true,
    });
    // Wait up to 3 seconds for server
    setTimeout(async () => {
      try {
        const ping = await fetch('http://localhost:3001/api/tickets');
        if (ping.ok) {
          console.log('✅ Ticket API started, retrying action...');
          main();
          return;
        }
      } catch {}
      console.error('❌ Auto-start failed. Please run "bun run api" manually.');
      process.exit(1);
    }, 3000);
  } else {
    console.error(`Error ${action}:`, msg);
    console.error(
      '⚠️  Ticket API unreachable? Ensure the server is running on port 3001 (bun run api).'
    );
    process.exit(1);
  }
}

function showErrorAndExit(msg, example = '') {
  console.error(`⛔ ${msg}`);
  if (example) console.error(`👉 Example: ${example}`);
  process.exit(1);
}

async function main() {
  if (cmd === 'create') {
    if (!params.title) {
      showErrorAndExit(
        'create requires title="..."',
        'bun run ticket:create type=bug title="Game crashes on start" tags=ai,urgent'
      );
    }
    if (!params.type) {
      showErrorAndExit(
        'create requires type=bug|feature|enhancement|task',
        'bun run ticket:create type=feature title="Add co-op mode"'
      );
    }
    const ticket = {
      id: params.id || generateTicketId(params.type || 'bug'),
      type: params.type || 'bug',
      title: params.title || 'No title',
      status: params.status || 'open',
      tags: parseTags(params.tags),
      history: [],
      artifacts: [],
      relatedTickets: [],
      checklist: parseChecklist(params.checklist),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticket),
      });
      const result = await res.json();
      console.log('Ticket created:', result);
    } catch (err) {
      await handleError('creating ticket', err);
    }
  } else if (cmd === 'update') {
    if (!params.id) {
      showErrorAndExit(
        'update requires id=...',
        'bun run ticket:update id=BUG-... status=closed'
      );
    }
    const updates = { ...params };
    delete updates.id;
    if (updates.tags) updates.tags = parseTags(updates.tags);
    if (updates.checklist)
      updates.checklist = parseChecklist(updates.checklist);
    updates.updatedAt = new Date().toISOString();
    try {
      const res = await fetch(`${API}/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const result = await res.json();
      console.log('Ticket updated:', result);
    } catch (err) {
      await handleError('updating ticket', err);
    }
  } else if (cmd === 'get') {
    if (!params.id) {
      showErrorAndExit('get requires id=...', 'bun run ticket:get id=BUG-123');
    }
    try {
      const res = await fetch(`${API}/${params.id}`);
      const result = await res.json();
      console.log('Ticket:', result);
    } catch (err) {
      await handleError('getting ticket', err);
    }
  } else if (cmd === 'list') {
    try {
      const res = await fetch(API);
      const result = await res.json();
      console.log('Tickets:', result);
    } catch (err) {
      await handleError('listing tickets', err);
    }
  } else if (cmd === 'check') {
    if (!params.id || !params.step) {
      showErrorAndExit(
        'check requires id=... and step=...',
        'bun run ticket:check id=BUG-123 step="Reproduce bug" result="Confirmed"'
      );
    }
    // Fetch ticket, update checklist
    try {
      const res = await fetch(`${API}/${params.id}`);
      const ticket = await res.json();
      if (!Array.isArray(ticket.checklist)) {
        console.error('No checklist found on ticket.');
        process.exit(1);
      }
      const idx = ticket.checklist.findIndex(
        (item) => item.step === params.step
      );
      if (idx === -1) {
        console.error('Checklist step not found.');
        process.exit(1);
      }
      ticket.checklist[idx].done = true;
      ticket.checklist[idx].result = params.result || 'done';
      ticket.checklist[idx].timestamp = new Date().toISOString();
      ticket.updatedAt = new Date().toISOString();
      // PATCH update
      const patchRes = await fetch(`${API}/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checklist: ticket.checklist,
          updatedAt: ticket.updatedAt,
        }),
      });
      const updated = await patchRes.json();
      console.log(
        `Checklist step '${params.step}' checked for ticket ${params.id}:`,
        updated.checklist[idx]
      );
    } catch (err) {
      await handleError('checking checklist step', err);
    }
  } else if (cmd === 'latest') {
    // Find the focused ticket (tag 'focus' and not closed), else most recently updated not closed
    try {
      const res = await fetch(API);
      const files = await res.json();
      if (!Array.isArray(files) || files.length === 0) {
        console.log('No tickets found.');
        process.exit(0);
      }
      // Fetch all ticket details
      Promise.all(
        files.map(async (file) => {
          const r = await fetch(`${API}/${file}`);
          return await r.json();
        })
      ).then((tickets) => {
        // Prefer focused, not closed
        const focused = tickets.filter(
          (t) =>
            Array.isArray(t.tags) &&
            t.tags.includes('focus') &&
            t.status !== 'closed'
        );
        if (focused.length > 0) {
          // If multiple, pick most recently updated
          focused.sort(
            (a, b) =>
              new Date(b.updatedAt || b.createdAt) -
              new Date(a.updatedAt || a.createdAt)
          );
          console.log('Returning focused ticket:', focused[0].id);
          console.log(focused[0]);
          process.exit(0);
        }
        // Else, most recently updated, not closed
        const active = tickets.filter((t) => t.status !== 'closed');
        if (active.length > 0) {
          active.sort(
            (a, b) =>
              new Date(b.updatedAt || b.createdAt) -
              new Date(a.updatedAt || a.createdAt)
          );
          console.log(
            'No focused ticket found. Returning most recently updated active ticket:',
            active[0].id
          );
          console.log(active[0]);
          process.exit(0);
        }
        // Else, all closed
        console.log('No active tickets found.');
        process.exit(0);
      });
    } catch (err) {
      await handleError('finding latest ticket', err);
    }
  } else {
    console.log('Usage:');
    console.log(
      '  bun run scripts/ticket-cli.js create type=bug title="..." status=open tags=ai,urgent checklist="[\"step1\",\"step2\"]"'
    );
    console.log(
      '  bun run scripts/ticket-cli.js update id=BUG-... status=closed'
    );
    console.log('  bun run scripts/ticket-cli.js get id=BUG-...');
    console.log('  bun run scripts/ticket-cli.js list');
    console.log(
      '  bun run scripts/ticket-cli.js check id=BUG-... step="step1" result="Passed"'
    );
    console.log('  bun run scripts/ticket-cli.js latest');
    process.exit(1);
  }
}

main();

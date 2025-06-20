// ticket-cli.js (migrated from js/ to packages/tooling/src/)
// Usage:
//   bun run packages/tooling/src/ticket-cli.js <verb> k1=v1 k2=v2 ...
// Verbs: create, update, get, list, latest, check
// Example: bun run packages/tooling/src/ticket-cli.js create type=bug title="My bug" tags=ai,urgent

import {
  generateId,
  writeTicket,
  readTicket,
  listTickets,
  ensureMeta,
  log
} from '../../core/src/TicketCore.js';

function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    const eq = arg.indexOf('=');
    if (eq > 0) {
      const k = arg.slice(0, eq);
      let v = arg.slice(eq + 1);
      if (v.startsWith('[') || v.startsWith('{')) {
        try { v = JSON.parse(v); } catch { /* leave as string */ }
      } else if (v.includes(',')) {
        v = v.split(',');
      }
      args[k] = v;
    }
  }
  return args;
}

async function main() {
  const [,, verb, ...rest] = process.argv;
  if (!verb || !['create','update','get','list','latest','check'].includes(verb)) {
    console.log('📝 Usage: bun run packages/tooling/src/ticket-cli.js <verb> k1=v1 k2=v2 ...');
    console.log('Verbs: create, update, get, list, latest, check');
    process.exit(1);
  }
  const args = parseArgs(rest);
  try {
    if (verb === 'create') {
      if (!args.type || !args.title) throw new Error('type and title required');
      args.id = args.id || generateId(args.type, args.title);
      ensureMeta(args, true);
      const ticket = await writeTicket(args);
      log('info', '📝', `Created ticket ${ticket.id}`);
      console.log(JSON.stringify(ticket, null, 2));
    } else if (verb === 'update') {
      if (!args.id) throw new Error('id required');
      let ticket = await readTicket(args.id);
      Object.assign(ticket, args);
      ensureMeta(ticket, false);
      const updated = await writeTicket(ticket);
      log('info', '✏️', `Updated ticket ${updated.id}`);
      console.log(JSON.stringify(updated, null, 2));
    } else if (verb === 'get') {
      if (!args.id) throw new Error('id required');
      const ticket = await readTicket(args.id);
      log('info', '🔎', `Read ticket ${ticket.id}`);
      console.log(JSON.stringify(ticket, null, 2));
    } else if (verb === 'list') {
      const tickets = await listTickets(args);
      log('info', '📋', `Listed ${tickets.length} tickets`);
      console.log(JSON.stringify(tickets, null, 2));
    } else if (verb === 'latest') {
      const tickets = await listTickets({ focus: true, ...args });
      const ticket = tickets[0] || null;
      if (ticket) {
        log('info', '🎯', `Latest/focused ticket: ${ticket.id}`);
        console.log(JSON.stringify(ticket, null, 2));
      } else {
        log('warn', '❓', 'No active/focused ticket found');
        process.exit(1);
      }
    } else if (verb === 'check') {
      if (!args.id || !args.step) throw new Error('id and step required');
      let ticket = await readTicket(args.id);
      if (!Array.isArray(ticket.checklist)) ticket.checklist = [];
      const idx = ticket.checklist.findIndex(s => s.step === args.step);
      const now = new Date().toISOString();
      if (idx >= 0) {
        ticket.checklist[idx] = { ...ticket.checklist[idx], done: true, result: args.result || 'Checked', timestamp: now };
      } else {
        ticket.checklist.push({ step: args.step, done: true, result: args.result || 'Checked', timestamp: now });
      }
      ensureMeta(ticket, false);
      const updated = await writeTicket(ticket);
      log('info', '☑️', `Checked step '${args.step}' for ticket ${updated.id}`);
      console.log(JSON.stringify(updated, null, 2));
    }
  } catch (err) {
    log('error', '❌', err.message);
    process.exit(1);
  }
}

main(); 
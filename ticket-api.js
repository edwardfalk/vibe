// ticket-api.js
const express = require('express');
const path = require('path');

// Dynamic import for ESM TicketCore
const TicketCorePath = path.resolve(
  __dirname,
  'packages/core/src/TicketCore.js'
);

const app = express();
app.use(express.json());

// Allow cross-origin requests from Five Server (port 5500) and others during local dev
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Handle preflight quickly
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// -----------------------------------------------------------------------------
// Remote debug logging endpoint
// -----------------------------------------------------------------------------
// Allows the game running in the browser (port 5500) to POST console log entries
// to the server. Logs are written via DebugLogger to the `.debug/YYYY-MM-DD.log`
// file so that they can be inspected later when diagnosing issues.
// -----------------------------------------------------------------------------
const { DebugLogger } = require('./packages/tooling/src/DebugLogger.js');

app.post('/api/logs', (req, res) => {
  try {
    const { level = 'log', message = '', stack = '' } = req.body || {};
    const combinedMessage = `[${level.toUpperCase()}] ${message}`;
    DebugLogger.log(combinedMessage, stack);
    res.status(204).end();
  } catch (err) {
    console.error('⚠️  Failed to write remote log:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check endpoint
app.head('/api/health', (req, res) => {
  res.status(200).end();
});

// List all tickets with filtering and pagination
app.get('/api/tickets', async (req, res) => {
  try {
    const TicketCore = await import(TicketCorePath);
    const { status, focus, limit, offset } = req.query;
    const tickets = await TicketCore.listTickets({
      status: status || undefined,
      focus: focus === 'true',
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    TicketCore.log('info', '📋', `Listed ${tickets.length} tickets`);
    res.json(tickets);
  } catch (err) {
    console.error('❌ Failed to list tickets:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get a ticket by ID
app.get('/api/tickets/:id', async (req, res) => {
  try {
    const TicketCore = await import(TicketCorePath);
    const ticket = await TicketCore.readTicket(req.params.id);
    TicketCore.log('info', '🔎', `Read ticket ${req.params.id}`);
    res.json(ticket);
  } catch (err) {
    console.error('❌ Failed to read ticket:', err);
    res.status(404).json({ error: err.message });
  }
});

// Create a new ticket
app.post('/api/tickets', async (req, res) => {
  try {
    const TicketCore = await import(TicketCorePath);
    const ticket = req.body;
    await TicketCore.ensureMeta(ticket, true);
    const written = await TicketCore.writeTicket(ticket);
    TicketCore.log('info', '📝', `Created ticket ${written.id}`);
    res.status(201).json(written);
  } catch (err) {
    console.error('❌ Failed to create ticket:', err);
    res.status(400).json({ error: err.message });
  }
});

// Update a ticket (partial update)
app.patch('/api/tickets/:id', async (req, res) => {
  try {
    const TicketCore = await import(TicketCorePath);
    const ticket = await TicketCore.readTicket(req.params.id);
    Object.assign(ticket, req.body);
    await TicketCore.ensureMeta(ticket, false);
    const written = await TicketCore.writeTicket(ticket);
    TicketCore.log('info', '✏️', `Updated ticket ${written.id}`);
    res.json(written);
  } catch (err) {
    console.error('❌ Failed to update ticket:', err);
    res.status(400).json({ error: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Ticket API running on http://localhost:${PORT}/api/tickets`);
  console.log(
    `Remote log endpoint available at http://localhost:${PORT}/api/logs`
  );
});

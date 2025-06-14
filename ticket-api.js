// ticket-api.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const TICKETS_DIR = path.join(__dirname, 'tests/bug-reports');

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
const { DebugLogger } = require('./js/DebugLogger.js');

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

// List all tickets
app.get('/api/tickets', (req, res) => {
  fs.readdir(TICKETS_DIR, (err, files) => {
    if (err) return res.status(500).json({ error: err.message });
    const tickets = files.filter((f) => f.endsWith('.json'));
    res.json(tickets);
  });
});

// Get a ticket by ID (filename)
app.get('/api/tickets/:id', (req, res) => {
  const file = path.join(TICKETS_DIR, req.params.id);
  if (!file.endsWith('.json'))
    return res.status(400).json({ error: 'Invalid ticket id' });
  fs.readFile(file, 'utf8', (err, data) => {
    if (err) return res.status(404).json({ error: 'Ticket not found' });
    res.json(JSON.parse(data));
  });
});

// Helper: validate and initialize ticket metadata
function ensureTicketMetadata(ticket, isNew = false) {
  if (!ticket.id) throw new Error('Missing ticket id');
  if (!ticket.title) throw new Error('Missing ticket title');
  if (!ticket.type)
    throw new Error('Missing ticket type (bug, enhancement, feature, task)');
  const allowedTypes = ['bug', 'enhancement', 'feature', 'task'];
  if (!allowedTypes.includes(ticket.type))
    throw new Error('Invalid ticket type');
  // Initialize required fields if missing
  if (isNew && !ticket.status) ticket.status = 'Open';
  if (!Array.isArray(ticket.history)) ticket.history = [];
  if (!Array.isArray(ticket.artifacts)) ticket.artifacts = [];
  if (!Array.isArray(ticket.verification)) ticket.verification = [];
  if (!Array.isArray(ticket.relatedTickets)) ticket.relatedTickets = [];
  // Optionally, add more fields as needed
}

// Create a new ticket
app.post('/api/tickets', (req, res) => {
  const ticket = req.body;
  try {
    ensureTicketMetadata(ticket, true);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const file = path.join(TICKETS_DIR, ticket.id + '.json');
  fs.writeFile(file, JSON.stringify(ticket, null, 2), (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json(ticket);
  });
});

// Update a ticket (partial update)
app.patch('/api/tickets/:id', (req, res) => {
  const file = path.join(TICKETS_DIR, req.params.id);
  fs.readFile(file, 'utf8', (err, data) => {
    if (err) return res.status(404).json({ error: 'Ticket not found' });
    const ticket = JSON.parse(data);
    Object.assign(ticket, req.body);
    try {
      ensureTicketMetadata(ticket, false);
    } catch (err2) {
      return res.status(400).json({ error: err2.message });
    }
    fs.writeFile(file, JSON.stringify(ticket, null, 2), (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json(ticket);
    });
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Ticket API running on http://localhost:${PORT}/api/tickets`);
  console.log(
    `Remote log endpoint available at http://localhost:${PORT}/api/logs`
  );
});

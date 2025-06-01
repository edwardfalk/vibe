// ticketManager.js (browser-compatible, for in-game and admin UI)
// This module provides ticket management functions using fetch to a backend API.
// You must implement the backend endpoints for file I/O (see below).

export async function createTicket(ticketData) {
  const res = await fetch('/api/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ticketData)
  });
  if (!res.ok) throw new Error('Failed to create ticket');
  return await res.json();
}

export async function updateTicket(ticketId, updates) {
  const res = await fetch(`/api/tickets/${ticketId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error('Failed to update ticket');
  return await res.json();
}

export async function loadTicket(ticketId) {
  const res = await fetch(`/api/tickets/${ticketId}`);
  if (!res.ok) throw new Error('Failed to load ticket');
  return await res.json();
}

export async function listTickets() {
  const res = await fetch('/api/tickets');
  if (!res.ok) throw new Error('Failed to list tickets');
  return await res.json();
}

// --- Backend API (Node.js/Express example) ---
// POST   /api/tickets         -> create new ticket JSON file
// PATCH  /api/tickets/:id     -> update ticket JSON file
// GET    /api/tickets/:id     -> get ticket JSON file
// GET    /api/tickets         -> list all ticket JSON files
// (You can add DELETE, artifact upload, etc. as needed)

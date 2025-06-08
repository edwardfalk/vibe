// ticketManager.js (browser-compatible, for in-game and admin UI)
// This module provides ticket management functions using fetch to a backend API.
// Backend runs on port 3001 as defined in ticket-api.js

const API_BASE_URL = 'http://localhost:3001/api/tickets';

export async function createTicket(ticketData) {
  try {
    console.log('🎫 Creating ticket:', ticketData.id);
    const res = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ticketData),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `Failed to create ticket: ${res.status} ${res.statusText} - ${errorText}`
      );
    }
    const result = await res.json();
    console.log('✅ Ticket created successfully:', result.id);
    return result;
  } catch (error) {
    console.error('❌ Failed to create ticket:', error);
    throw error;
  }
}

export async function updateTicket(ticketId, updates) {
  try {
    console.log('🎫 Updating ticket:', ticketId);
    const res = await fetch(`${API_BASE_URL}/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `Failed to update ticket: ${res.status} ${res.statusText} - ${errorText}`
      );
    }
    const result = await res.json();
    console.log('✅ Ticket updated successfully:', result.id);
    return result;
  } catch (error) {
    console.error('❌ Failed to update ticket:', error);
    throw error;
  }
}

export async function loadTicket(ticketId) {
  try {
    const res = await fetch(`${API_BASE_URL}/${ticketId}`);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `Failed to load ticket: ${res.status} ${res.statusText} - ${errorText}`
      );
    }
    return await res.json();
  } catch (error) {
    console.error('❌ Failed to load ticket:', error);
    throw error;
  }
}

export async function listTickets() {
  try {
    const res = await fetch(API_BASE_URL);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `Failed to list tickets: ${res.status} ${res.statusText} - ${errorText}`
      );
    }
    return await res.json();
  } catch (error) {
    console.error('❌ Failed to list tickets:', error);
    throw error;
  }
}

// Health check function to verify API is available
export async function checkApiHealth() {
  try {
    const res = await fetch(API_BASE_URL, { method: 'HEAD' });
    return res.ok;
  } catch (error) {
    console.warn('⚠️ Ticket API not available:', error.message);
    return false;
  }
}

// --- Backend API (Node.js/Express) runs on port 3001 ---
// POST   /api/tickets         -> create new ticket JSON file
// PATCH  /api/tickets/:id     -> update ticket JSON file
// GET    /api/tickets/:id     -> get ticket JSON file
// GET    /api/tickets         -> list all ticket JSON files
// (Backend implemented in ticket-api.js)

// ticketManager.js (browser-compatible, for in-game and admin UI)
// Enhanced ticket management with error handling and caching
// Backend runs on port 3001 as defined in ticket-api.js

// Default API base URL (can be overridden in constructor)
const API_BASE_URL = 'http://localhost:3001/api/tickets';

/**
 * Browser-compatible ticket manager with caching and error handling
 */
class TicketManager {
  constructor(apiBaseUrl = API_BASE_URL) {
    this.apiBaseUrl = apiBaseUrl;
    this.cache = new Map();
    this.lastFetch = 0;
    this.cacheTimeout = 30000; // 30 seconds
  }

  /**
   * Generate a unique ticket ID
   * @param {string} type - Ticket type (bug, feature, enhancement, task)
   * @returns {string} Unique ticket ID
   */
  generateTicketId(type = 'bug') {
    const prefix = type.toUpperCase().substring(0, 4);
    const timestamp = new Date().toISOString().split('T')[0];
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Validate ticket data
   * @param {Object} ticket - Ticket data to validate
   */
  validateTicket(ticket) {
    if (!ticket.id) throw new Error('Ticket ID is required');
    if (!ticket.type) throw new Error('Ticket type is required');
    if (!ticket.title) throw new Error('Ticket title is required');
    if (!['bug', 'feature', 'enhancement', 'task'].includes(ticket.type)) {
      throw new Error('Invalid ticket type');
    }
  }

  /**
   * Create a new ticket
   * @param {Object} ticketData - Ticket data
   * @returns {Promise<Object>} Created ticket
   */
  async createTicket(ticketData) {
    try {
      // Ensure required fields
      if (!ticketData.id) {
        ticketData.id = this.generateTicketId(ticketData.type || 'bug');
      }

      // Validate required fields
      this.validateTicket(ticketData);

      // Add timestamp if not present
      if (!ticketData.timestamp) {
        ticketData.timestamp = new Date().toISOString();
      }

      console.log('🎫 Creating ticket:', ticketData.id);
      const res = await fetch(this.apiBaseUrl, {
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

      const ticket = await res.json();
      this.cache.set(ticket.id, ticket);

      console.log('✅ Ticket created successfully:', ticket.id);
      return ticket;
    } catch (error) {
      console.error('❌ Failed to create ticket:', error);
      throw error;
    }
  }

  /**
   * Update an existing ticket
   * @param {string} ticketId - Ticket ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated ticket
   */
  async updateTicket(ticketId, updates) {
    try {
      console.log('🎫 Updating ticket:', ticketId);
      const res = await fetch(`${this.apiBaseUrl}/${ticketId}`, {
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

      const ticket = await res.json();
      this.cache.set(ticket.id, ticket);

      console.log('✅ Ticket updated successfully:', ticket.id);
      return ticket;
    } catch (error) {
      console.error('❌ Failed to update ticket:', error);
      throw error;
    }
  }

  /**
   * Get a ticket by ID
   * @param {string} ticketId - Ticket ID
   * @returns {Promise<Object>} Ticket data
   */
  async getTicket(ticketId) {
    try {
      // Check cache first
      if (this.cache.has(ticketId)) {
        return this.cache.get(ticketId);
      }

      const res = await fetch(`${this.apiBaseUrl}/${ticketId}`);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(
          `Failed to load ticket: ${res.status} ${res.statusText} - ${errorText}`
        );
      }

      const ticket = await res.json();
      this.cache.set(ticket.id, ticket);
      return ticket;
    } catch (error) {
      console.error('❌ Failed to load ticket:', error);
      throw error;
    }
  }

  /**
   * List all tickets
   * @param {boolean} useCache - Whether to use cached data
   * @returns {Promise<Array>} List of tickets
   */
  async listTickets(useCache = true) {
    try {
      const now = Date.now();
      if (useCache && now - this.lastFetch < this.cacheTimeout) {
        return Array.from(this.cache.values());
      }

      const res = await fetch(this.apiBaseUrl);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(
          `Failed to list tickets: ${res.status} ${res.statusText} - ${errorText}`
        );
      }

      const tickets = await res.json();
      this.lastFetch = now;
      return tickets;
    } catch (error) {
      console.error('❌ Failed to list tickets:', error);
      throw error;
    }
  }

  /**
   * Create a bug report ticket with game state
   * @param {Object} bugData - Bug report data
   * @param {Object} gameState - Current game state
   * @returns {Promise<Object>} Created bug ticket
   */
  async createBugReport(bugData, gameState = null) {
    const bugTicket = {
      type: 'bug',
      title: bugData.title || 'Untitled Bug Report',
      description: bugData.description || 'No description provided',
      tags: bugData.tags || ['bug'],
      status: 'open',
      artifacts: bugData.artifacts || [],
      verification: [],
      relatedTickets: [],
      gameState: gameState
        ? {
            timestamp: new Date().toISOString(),
            playerPosition: gameState.playerPosition,
            enemyCount: gameState.enemyCount,
            score: gameState.score,
            level: gameState.level,
            gameMode: gameState.gameMode,
          }
        : null,
    };

    return this.createTicket(bugTicket);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    this.lastFetch = 0;
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

// Export both class and convenience functions for backward compatibility
export { TicketManager };

// Convenience functions using default instance
const defaultManager = new TicketManager();

export async function createTicket(ticketData) {
  return defaultManager.createTicket(ticketData);
}

export async function updateTicket(ticketId, updates) {
  return defaultManager.updateTicket(ticketId, updates);
}

export async function loadTicket(ticketId) {
  return defaultManager.getTicket(ticketId);
}

export async function listTickets() {
  return defaultManager.listTickets();
}

// --- Backend API (Node.js/Express) runs on port 3001 ---
// POST   /api/tickets         -> create new ticket JSON file
// PATCH  /api/tickets/:id     -> update ticket JSON file
// GET    /api/tickets/:id     -> get ticket JSON file
// GET    /api/tickets         -> list all ticket JSON files
// (Backend implemented in ticket-api.js)

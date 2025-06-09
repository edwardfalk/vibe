// ticketManager.js
// Client-side ticket management utilities for the Vibe game
// Integrates with ticket-api.js backend and supports in-game bug reporting

import { CONFIG } from './js/config.js';
import { retryOperation, logError, validateApiResponse } from './js/errorHandler.js';

/**
 * Client-side ticket manager for handling bug reports, features, and tasks
 * Provides utilities for creating, updating, and managing tickets from the game
 */
class TicketManager {
  constructor(apiBaseUrl = CONFIG.TICKET_API.BASE_URL) {
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

      const response = await retryOperation(async () => {
        const res = await fetch(this.apiBaseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(ticketData),
        });
        return validateApiResponse(res, { operation: 'createTicket', ticketId: ticketData.id });
      });

      const ticket = await response.json();
      this.cache.set(ticket.id, ticket);

      console.log('🎫 Ticket created:', ticket.id);
      return ticket;
    } catch (error) {
      logError(error, { operation: 'createTicket', ticketId: ticketData.id });
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
      const response = await fetch(`${this.apiBaseUrl}/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update ticket: ${response.statusText}`);
      }

      const ticket = await response.json();
      this.cache.set(ticket.id, ticket);

      console.log('🎫 Ticket updated:', ticket.id);
      return ticket;
    } catch (error) {
      logError(error, { operation: 'updateTicket', ticketId });
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

      const response = await fetch(`${this.apiBaseUrl}/${ticketId}`);

      if (!response.ok) {
        throw new Error(`Failed to get ticket: ${response.statusText}`);
      }

      const ticket = await response.json();
      this.cache.set(ticket.id, ticket);

      return ticket;
    } catch (error) {
      logError(error, { operation: 'getTicket', ticketId });
      throw error;
    }
  }

  /**
   * List all tickets
   * @param {boolean} useCache - Whether to use cached data
   * @returns {Promise<Array>} List of ticket filenames
   */
  async listTickets(useCache = true) {
    try {
      const now = Date.now();
      if (useCache && now - this.lastFetch < this.cacheTimeout) {
        return Array.from(this.cache.keys());
      }

      const response = await fetch(this.apiBaseUrl);

      if (!response.ok) {
        throw new Error(`Failed to list tickets: ${response.statusText}`);
      }

      const tickets = await response.json();
      this.lastFetch = now;

      return tickets;
    } catch (error) {
      logError(error, { operation: 'listTickets' });
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
   * Add history entry to a ticket
   * @param {string} ticketId - Ticket ID
   * @param {string} action - Action taken
   * @param {string} details - Action details
   * @returns {Promise<Object>} Updated ticket
   */
  async addHistory(ticketId, action, details) {
    const historyEntry = {
      timestamp: new Date().toISOString(),
      action: action,
      details: details,
    };

    const ticket = await this.getTicket(ticketId);
    if (!ticket.history) {
      ticket.history = [];
    }
    ticket.history.push(historyEntry);

    return this.updateTicket(ticketId, { history: ticket.history });
  }

  /**
   * Change ticket status
   * @param {string} ticketId - Ticket ID
   * @param {string} newStatus - New status
   * @param {string} note - Optional note
   * @returns {Promise<Object>} Updated ticket
   */
  async changeStatus(ticketId, newStatus, note = '') {
    const ticket = await this.getTicket(ticketId);
    const oldStatus = ticket.status;

    await this.addHistory(
      ticketId,
      'status_change',
      `Status changed from ${oldStatus} to ${newStatus}${note ? ': ' + note : ''}`
    );

    return this.updateTicket(ticketId, {
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Validate ticket data
   * @param {Object} ticket - Ticket to validate
   * @throws {Error} If validation fails
   */
  validateTicket(ticket) {
    if (!ticket.id) {
      throw new Error('Ticket ID is required');
    }
    if (!ticket.title) {
      throw new Error('Ticket title is required');
    }
    if (!ticket.type) {
      throw new Error('Ticket type is required');
    }

    const allowedTypes = ['bug', 'feature', 'enhancement', 'task'];
    if (!allowedTypes.includes(ticket.type)) {
      throw new Error(
        `Invalid ticket type. Must be one of: ${allowedTypes.join(', ')}`
      );
    }
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
    this.lastFetch = 0;
    console.log('🎫 Ticket cache cleared');
  }
}

// Global instance for easy access (browser only)
if (typeof window !== 'undefined') {
  window.ticketManager = new TicketManager();
}

// Export for module usage
export { TicketManager };
export default TicketManager;

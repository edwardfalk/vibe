/**
 * Simple script to update ticket status
 */

import { TicketManager } from './ticketManager.js';

async function updateTicketStatus(ticketId, status, resolution = '') {
  const ticketManager = new TicketManager();

  try {
    const ticket = await ticketManager.getTicket(ticketId);
    if (!ticket) {
      console.error(`❌ Ticket ${ticketId} not found`);
      return;
    }

    ticket.status = status;
    if (resolution) {
      ticket.resolution = resolution;
    }
    ticket.updatedAt = new Date().toISOString();

    const updated = await ticketManager.updateTicket(ticketId, ticket);
    console.log(`✅ Updated ticket ${ticketId} to status: ${status}`);
    return updated;
  } catch (error) {
    console.error(`❌ Failed to update ticket ${ticketId}:`, error.message);
  }
}

// Update security tickets to resolved
const securityTickets = [
  'CR-2025-06-08-sec-eq1b',
  'CR-2025-06-08-sec-9fzt',
  'CR-2025-06-08-sec-qp9z',
  'CR-2025-06-08-sec-b4zk',
];

async function updateSecurityTickets() {
  console.log('🎫 Updating security tickets to resolved status...\n');

  for (const ticketId of securityTickets) {
    await updateTicketStatus(
      ticketId,
      'resolved',
      'Implemented centralized configuration with environment variable validation and security improvements'
    );
  }

  console.log('\n✅ All security tickets updated!');
}

// Run the update
updateSecurityTickets();

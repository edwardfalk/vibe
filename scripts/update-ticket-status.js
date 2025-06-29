/**
 * Simple script to update ticket status
 *
 * SAFETY GUARD: Requires --confirm flag to run batch update
 */

import { TicketManager } from '../packages/tooling/src/ticketManager.js';
import { reportError } from '../packages/tooling/src/ErrorReporter.js';

if (!process.argv.includes('--confirm')) {
  reportError('CONFIRM_FLAG_MISSING', 'Refusing to run batch update. Add --confirm to proceed.');
}

async function updateTicketStatus(ticketId, status, resolution = '') {
  const ticketManager = new TicketManager();

  try {
    const ticket = await ticketManager.getTicket(ticketId);
    if (!ticket) {
      reportError('TICKET_NOT_FOUND', `Ticket ${ticketId} not found`, { ticketId }, null);
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
    reportError('TICKET_UPDATE_FAILURE', `Failed to update ticket ${ticketId}`, { ticketId, message: error.message }, null);
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

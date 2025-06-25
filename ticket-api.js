console.log('[DEBUG] Starting ticket-api.js...');

// ticket-api-bun.js
import { TicketRouter } from './packages/api/src/TicketRouter.js';
console.log('[DEBUG] Imported TicketRouter.');
import { TicketService } from './packages/api/src/TicketService.js';
console.log('[DEBUG] Imported TicketService.');
import * as TicketCore from './packages/core/src/TicketCore.js';
console.log('[DEBUG] Imported TicketCore.');

const PORT = process.env.TICKET_API_PORT || 3001;
console.log(`[DEBUG] Port set to: ${PORT}`);

// A simple logger for now. Will be replaced with pino.
const logger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  error: (msg, err) => console.error(`[ERROR] ${msg}`, err),
};
console.log('[DEBUG] Logger created.');

const ticketService = new TicketService(TicketCore, logger);
console.log('[DEBUG] TicketService instantiated.');
const ticketRouter = new TicketRouter(ticketService, logger);
console.log('[DEBUG] TicketRouter instantiated.');

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});
console.log('[DEBUG] Unhandled rejection handler set.');

let server;

// This condition prevents Bun's runner from starting a second server.
// We only start the server if the file is the main entry point.
if (import.meta.main) {
  server = Bun.serve({
    port: PORT,
    fetch: ticketRouter.handle.bind(ticketRouter),
    error(error) {
      logger.error('Unhandled error', error);
      return new Response('Internal Server Error', { status: 500 });
    },
  });
  logger.info(`✅ Bun Ticket API running on http://localhost:${server.port}`);
}

// Add a default export for test environments
export default server || ticketRouter;

// Tooling package barrel file
// TODO: export ticketManager, probes, debug logger after migration.

// Expose tooling utilities for browser context

export { setupRemoteConsoleLogger } from './RemoteConsoleLogger.js';

// Dynamically import TicketManager so it can attach itself to window (in browser)
if (typeof window !== 'undefined') {
  import('./ticketManager.js').catch(() => {
    console.warn('⚠️ Failed to load TicketManager');
  });
}

import { test, expect } from './playwright.setup.js';
import { DebugLogger } from '../packages/tooling/src/DebugLogger.js';
import { generateId } from '../packages/core/src/TicketCore.js';

test.describe('Ticketing workflow probes', () => {
  test.beforeAll(async () => {
    DebugLogger.log('Playwright ticket creation probe started');
  });

  test('Create ticket via API and verify', async ({ page }) => {
    const title = 'Probe ticket creation';
    const type = 'task';
    const id = generateId(type, title);

    try {
      const ticket = {
        id,
        type,
        title,
        status: 'open',
        tags: ['probe'],
        checklist: [],
        history: [],
        artifacts: [],
        relatedTickets: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      // Create
      const createRes = await fetch('http://localhost:3001/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticket),
      });
      expect(createRes.ok, `Ticket creation failed: ${await createRes.text()}`).toBe(
        true
      );
      // Retrieve
      const getRes = await fetch(`http://localhost:3001/api/tickets/${id}`);
      expect(getRes.ok).toBe(true);
      const fetched = await getRes.json();
      expect(fetched.id).toBe(id);
      expect(fetched.title).toBe(ticket.title);
    } catch (error) {
        console.error(`Ticket creation probe failed for ID ${id}:`, error);
        throw error; // Re-throw to fail the test
    } finally {
      // Cleanup
      if (id) {
          try {
            const delRes = await fetch(`http://localhost:3001/api/tickets/${id}`, {
                method: 'DELETE',
            });
            if (!delRes.ok) {
                console.error(`Cleanup failed for ticket ${id} with status ${delRes.status}`);
            } else {
                console.log(`Successfully cleaned up ticket ${id}`);
            }
          } catch (cleanupError) {
              console.error(`Error during cleanup for ticket ${id}:`, cleanupError);
          }
      }
    }
  });
});

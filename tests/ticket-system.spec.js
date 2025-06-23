import { test, expect } from '@playwright/test';

test.describe('Ticketing System - E2E', () => {
  const BASE_URL = 'http://localhost:5500';
  const API_URL = 'http://localhost:3001/api/health';

  test.beforeAll(async () => {
    // Health check to ensure the API server is up before running any tests
    await new Promise((resolve, reject) => {
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        if (attempts > 20) { // 20 seconds timeout
          clearInterval(interval);
          reject(new Error('API server did not start in time.'));
          return;
        }
        try {
          const response = await fetch(API_URL, { method: 'HEAD' });
          if (response.ok) {
            clearInterval(interval);
            resolve();
          }
        } catch (e) { /* ignore */ }
      }, 1000);
    });
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    // Wait for the game and dependent systems to be ready
    await page.waitForFunction(() => window.p5 && window.p5.instance);
  });

  test('TicketManager should be available on the window object', async ({ page }) => {
    const ticketManagerExists = await page.evaluate(() => typeof window.TicketManager === 'function');
    expect(ticketManagerExists).toBe(true);
  });

  test.describe('TicketManager Class Functionality', () => {
    test('should create, get, and update a ticket', async ({ page }) => {
      const ticketData = await page.evaluate(async () => {
        const manager = new window.TicketManager();
        const newTicket = {
          id: window.TicketCore.generateId('task', 'E2E Test'),
          type: 'task',
          title: 'E2E Test Ticket',
        };
        const created = await manager.createTicket(newTicket);

        const fetched = await manager.getTicket(created.id);

        const updated = await manager.updateTicket(fetched.id, { status: 'done' });

        return { created, fetched, updated };
      });

      expect(ticketData.created.id).toBe(ticketData.fetched.id);
      expect(ticketData.fetched.status).toBe('open');
      expect(ticketData.updated.status).toBe('done');
    });
  });

  // More tests for the bug report modal UI will go here
}); 
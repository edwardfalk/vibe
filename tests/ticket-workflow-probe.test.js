import { test, expect } from '@playwright/test';
import request from 'supertest';
import { spawn, exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const API_URL = 'http://localhost:3001';
const TEMPLATE_PATH = path.resolve('./tests/bug-reports/template.json');
const REPORTS_DIR = path.resolve('./tests/bug-reports/');

test.describe('Ticket Workflow Probe', () => {
  let createdIds = [];
  let apiProcess;

  test.beforeAll(async () => {
    // Ensure the bug reports directory exists
    await fs.mkdir(REPORTS_DIR, { recursive: true });

    // Create the template file for the test
    const templateData = {
      id: "TEMPLATE-2025-01-01-abcdef",
      type: "task",
      title: "Test Template",
      status: "open",
      tags: ["template"],
      slug: "test-template",
      checklist: [],
      history: [{ timestamp: "2025-01-01T00:00:00.000Z", action: "Created as a template for testing." }],
      artifacts: [],
      relatedTickets: [],
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
      folder: ""
    };
    await fs.writeFile(TEMPLATE_PATH, JSON.stringify(templateData, null, 2));
    
    // Reuse existing API server if running to avoid port conflicts
    let apiHealthy = false;
    try {
      const res = await request(API_URL).head('/api/health');
      apiHealthy = res.status === 200;
    } catch {}

    if (!apiHealthy) {
      console.log('Spawning API server for ticket workflow probe...');
      apiProcess = spawn('bun', ['run', 'api'], {
        stdio: 'pipe',
        detached: true,
      });

      apiProcess.stdout.on('data', (data) => console.log(`API_STDOUT: ${data}`));
      apiProcess.stderr.on('data', (data) => console.error(`API_STDERR: ${data}`));

      // Poll the server until it's ready
      const startTime = Date.now();
      while (Date.now() - startTime < 10000 && !apiHealthy) {
        try {
          const response = await request(API_URL).head('/api/health');
          if (response.status === 200) {
            apiHealthy = true;
            console.log('✅ API server is ready.');
          }
        } catch {
          /* ignore */
        }
        if (!apiHealthy) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      if (!apiHealthy) {
        throw new Error('API server failed to start within 10 seconds.');
      }
    } else {
      console.log('✅ Reusing existing Ticket API server.');
    }
  });

  test('should create, update, and delete a ticket via the API', async () => {
    // 1. Create a ticket using a template
    const datePart = new Date().toISOString().split('T')[0];
    const debugId = `BUG-${datePart}-${Math.random().toString(36).substr(2,6)}`;
    console.log('DEBUG_ID', debugId);
    const ticketData = {
      id: debugId,
      type: 'bug',
      title: 'Workflow probe bug',
      tags: ['probe'],
      checklist: [{ step: 'Reproduce' }, { step: 'Fix' }],
    };

    const createRes = await request(API_URL)
      .post('/api/tickets')
      .send(ticketData);

    if (createRes.status !== 201) {
      console.error('CREATE_ERROR', createRes.body);
    }
    expect(createRes.status).toBe(201);
    const ticketId = createRes.body.id;
    expect(createRes.body.id).toBe(ticketId);
    createdIds.push(ticketId);
    console.log(`✅ Created ticket: ${ticketId}`);

    // 2. Update the ticket
    const updateRes = await request(API_URL)
      .patch(`/api/tickets/${ticketId}`)
      .send({ status: 'in-progress', tags: ['probe', 'focus'] });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.status).toBe('in-progress');
    expect(updateRes.body.tags).toContain('focus');
    console.log(`✅ Updated ticket status to in-progress and added focus tag.`);

    // 3. Check off a checklist item
    const checkRes = await request(API_URL)
      .patch(`/api/tickets/${ticketId}`)
      .send({ checklist: [{ step: 'Reproduce', done: true, result: 'Confirmed' }] });
    expect(checkRes.status).toBe(200);
    const checkedItem = checkRes.body.checklist.find(item => item.step === 'Reproduce');
    expect(checkedItem.done).toBe(true);
    expect(checkedItem.result).toBe('Confirmed');
    console.log(`✅ Checked off 'Reproduce' step.`);

    // 4. Verify ticket can be fetched individually
    const fetchRes = await request(API_URL).get(`/api/tickets/${ticketId}`);
    expect(fetchRes.status).toBe(200);
    expect(fetchRes.body.id).toBe(ticketId);
    console.log(`✅ Fetched ticket ${ticketId} successfully.`);
  });

  test.afterAll(async () => {
    // Delete all created tickets
    for (const id of createdIds) {
      try {
        const deleteRes = await request(API_URL).delete(`/api/tickets/${id}`);
        if (deleteRes.status === 204) {
          console.log(`✅ Deleted ticket: ${id}`);
        }
      } catch (err) {
        console.error(`Failed to delete ticket ${id}:`, err);
      }
    }

    // Delete the template file
    try {
      await fs.unlink(TEMPLATE_PATH);
      console.log('✅ Deleted test template file.');
    } catch (error) {
      if (error.code !== 'ENOENT') { // Ignore if file doesn't exist
        console.error('Failed to delete template file:', error);
      }
    }

    // Kill the API server process
    if (apiProcess) {
      console.log('Killing API server...');
      // Use exec to kill the process group on Windows
      exec(`taskkill /pid ${apiProcess.pid} /f /t`, (err, stdout, stderr) => {
        if (err) {
          console.error('Failed to kill API process:', stderr);
        } else {
          console.log('API server process killed.');
        }
      });
    }
  });
});

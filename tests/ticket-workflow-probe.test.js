import { test, expect } from '@playwright/test';
import request from 'supertest';
import { spawn, exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const API_URL = 'http://localhost:3001';
const TEMPLATE_PATH = path.resolve('./tests/bug-reports/template.json');
const REPORTS_DIR = path.resolve('./tests/bug-reports/');

test.describe('Ticket Workflow Probe', () => {
  let createdId;
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
    
    console.log('Spawning API server...');
    apiProcess = spawn('bun', ['run', 'api'], {
      stdio: 'pipe',
      detached: true,
    });

    apiProcess.stdout.on('data', (data) => console.log(`API_STDOUT: ${data}`));
    apiProcess.stderr.on('data', (data) => console.error(`API_STDERR: ${data}`));

    // Poll the server until it's ready
    const startTime = Date.now();
    let isReady = false;
    while (Date.now() - startTime < 10000 && !isReady) { // 10-second timeout
      try {
        const response = await request(API_URL).head('/api/health');
        if (response.status === 200) {
          isReady = true;
          console.log('✅ API server is ready.');
        }
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait before retrying
      }
    }

    if (!isReady) {
      throw new Error('API server failed to start within 10 seconds.');
    }
  });

  test('should create, update, and delete a ticket via the API', async () => {
    // 1. Create a ticket using a template
    const templateJson = await fs.readFile(TEMPLATE_PATH, 'utf8');
    const ticketData = JSON.parse(templateJson);

    const ticketId = `BUG-TEST-${Date.now()}`;
    ticketData.id = ticketId;
    ticketData.title = 'Workflow probe bug';
    ticketData.type = 'bug';
    ticketData.tags = ['probe'];
    ticketData.checklist = [{ step: 'Reproduce' }, { step: 'Fix' }];

    const createRes = await request(API_URL)
      .post('/api/tickets')
      .send(ticketData);

    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBe(ticketId);
    createdId = createRes.body.id;
    console.log(`✅ Created ticket: ${createdId}`);

    // 2. Update the ticket
    const updateRes = await request(API_URL)
      .patch(`/api/tickets/${createdId}`)
      .send({ status: 'in-progress', tags: ['probe', 'focus'] });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.status).toBe('in-progress');
    expect(updateRes.body.tags).toContain('focus');
    console.log(`✅ Updated ticket status to in-progress and added focus tag.`);

    // 3. Check off a checklist item
    const checkRes = await request(API_URL)
      .patch(`/api/tickets/${createdId}`)
      .send({ checklist: [{ step: 'Reproduce', done: true, result: 'Confirmed' }] });
    expect(checkRes.status).toBe(200);
    const checkedItem = checkRes.body.checklist.find(item => item.step === 'Reproduce');
    expect(checkedItem.done).toBe(true);
    expect(checkedItem.result).toBe('Confirmed');
    console.log(`✅ Checked off 'Reproduce' step.`);

    // 4. Verify it's the latest focused ticket
    const latestRes = await request(API_URL).get('/api/tickets/latest');
    expect(latestRes.status).toBe(200);
    expect(latestRes.body.id).toBe(createdId);
    console.log(`✅ Verified ${createdId} is the latest focused ticket.`);
  });

  test.afterAll(async () => {
    // 5. Delete the ticket
    if (createdId) {
      const deleteRes = await request(API_URL).delete(`/api/tickets/${createdId}`);
      expect(deleteRes.status).toBe(204);
      console.log(`✅ Deleted ticket: ${createdId}`);

      // Verify it's gone
      const getRes = await request(API_URL).get(`/api/tickets/${createdId}`);
      expect(getRes.status).toBe(404);
      console.log(`✅ Verified ticket deletion.`);
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

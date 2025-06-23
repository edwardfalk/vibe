import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import server from '../../ticket-api.js';
import fs from 'fs';
import path from 'path';
import * as TicketCore from '../../packages/core/src/TicketCore.js';

const TEST_TICKETS_DIR = 'tests/bug-reports';
const TEST_TICKET_SLUG = '_api-test-ticket_';

const agent = request(`http://localhost:${server.port}`);

function cleanupTestTickets() {
    const files = fs.readdirSync(TEST_TICKETS_DIR);
    for (const file of files) {
        if (file.includes(TEST_TICKET_SLUG)) {
            const folderPath = path.join(TEST_TICKETS_DIR, file);
            fs.rmSync(folderPath, { recursive: true, force: true });
        }
    }
}

describe('Ticket API', () => {
    let testTickets = {};

    beforeAll(async () => {
        cleanupTestTickets();
        
        const ticketsToCreate = [
            { id: TicketCore.generateId('task'), type: 'task', title: `Task Ticket ${TEST_TICKET_SLUG}`, status: 'open', tags: ['testing', 'api'] },
            { id: TicketCore.generateId('bug'), type: 'bug', title: `Bug Ticket ${TEST_TICKET_SLUG}`, status: 'open', tags: ['testing', 'bug'] },
            { id: TicketCore.generateId('feature'), type: 'feature', title: `Feature Ticket ${TEST_TICKET_SLUG}`, status: 'in-progress', tags: ['testing', 'feature'], focus: true },
            { id: TicketCore.generateId('task'), type: 'task', title: `Another Task ${TEST_TICKET_SLUG}`, status: 'closed' },
        ];

        for (const ticket of ticketsToCreate) {
            const response = await agent.post('/api/tickets').send(ticket);
            testTickets[ticket.id] = response.body;
        }
    }, 20000);

    afterAll(() => {
        cleanupTestTickets();
        server.stop();
    });

    test('HEAD /api/health should return 200', async () => {
        await agent.head('/api/health').expect(200);
    });

    describe('GET /api/tickets', () => {
        test('should return all tickets created in the test', async () => {
            const response = await agent.get('/api/tickets').expect(200);
            expect(response.body.length).toBeGreaterThanOrEqual(4);
        });

        test('should filter tickets by type', async () => {
            const response = await agent.get('/api/tickets?type=task').expect(200);
            expect(response.body.length).toBeGreaterThanOrEqual(2);
            expect(response.body.every(t => t.type === 'task')).toBe(true);
        });
    });

    describe('GET / PATCH / DELETE /api/tickets/:id', () => {
        let ticketToTest;
        beforeAll(() => {
            ticketToTest = Object.values(testTickets).find(t => t.type === 'task');
        });

        test('should get a single ticket by ID', async () => {
            const response = await agent.get(`/api/tickets/${ticketToTest.id}`).expect(200);
            expect(response.body.id).toBe(ticketToTest.id);
        });

        test('should update a ticket by ID', async () => {
            const response = await agent
                .patch(`/api/tickets/${ticketToTest.id}`)
                .send({ status: 'in-progress', title: 'Updated Title' })
                .expect(200);
            expect(response.body.status).toBe('in-progress');
            expect(response.body.title).toBe('Updated Title');
        });

        test('should delete a ticket by ID', async () => {
            await agent.delete(`/api/tickets/${ticketToTest.id}`).expect(204);
            await agent.get(`/api/tickets/${ticketToTest.id}`).expect(404);
        });

        test('should return 404 for a non-existent ticket ID', async () => {
            await agent.get('/api/tickets/TASK-0000-00-00-000000').expect(404);
        });
    });
    
    describe('Malformed and faulty requests', () => {
        test('should return helpful error for malformed JSON', async () => {
            const res = await agent
                .post('/api/tickets')
                .set('Content-Type', 'application/json')
                .send('{"bad json"}')
                .expect(400);

            expect(res.body.error).toBe('Malformed JSON');
        });
    });
}); 
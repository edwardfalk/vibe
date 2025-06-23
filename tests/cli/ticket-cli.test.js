// tests/cli/ticket-cli.test.js

import { describe, test, expect, beforeEach, afterAll, vi } from 'vitest';
import { cliMain } from '../../packages/tooling/src/ticket-cli.js';
import fs from 'fs';
import path from 'path';

const TEST_TICKETS_DIR = 'tests/bug-reports';
const TEST_TICKET_SLUG = '_test-ticket_';

function cleanupTestTickets() {
    const files = fs.readdirSync(TEST_TICKETS_DIR);
    for (const file of files) {
        if (file.includes(TEST_TICKET_SLUG)) {
            const dirPath = path.join(TEST_TICKETS_DIR, file);
            fs.rmSync(dirPath, { recursive: true, force: true });
        }
    }
}

describe('Ticket System CLI - Direct Call', () => {
    const originalArgv = process.argv;
    const originalExit = process.exit;
    let exitCode = 0;

    beforeEach(() => {
        process.exit = vi.fn((code) => {
            exitCode = code;
        });
        console.log = vi.fn();
        console.error = vi.fn();
        cleanupTestTickets();
        exitCode = 0;
    });

    afterAll(() => {
        process.argv = originalArgv;
        process.exit = originalExit;
        cleanupTestTickets();
    });

    async function runCli(...args) {
        process.argv = ['node', 'ticket-cli.js', ...args];
        await cliMain();
        // Get the last thing logged to console.log, which is usually the JSON output
        const lastCall = console.log.mock.calls[console.log.mock.calls.length - 1];
        return {
            stdout: lastCall ? lastCall[0] : '',
            exitCode,
        };
    }

    test('should create a ticket', async () => {
        await runCli('create', 'type=bug', `title=My Test`, `slug=${TEST_TICKET_SLUG}`);
        expect(exitCode).toBe(0);
        const lastLog = console.log.mock.calls[console.log.mock.calls.length - 1][0];
        const ticket = JSON.parse(lastLog);
        expect(ticket.type).toBe('bug');
    });

    test('should fail to create without required args', async () => {
        await runCli('create', `title=My Test`);
        expect(exitCode).toBe(1);
    });

    test('should get a ticket', async () => {
        const { stdout: createOut } = await runCli('create', 'type=bug', `title=Get Me`, `slug=${TEST_TICKET_SLUG}`);
        const createdTicket = JSON.parse(createOut);
        
        await runCli('get', `id=${createdTicket.id}`);
        expect(exitCode).toBe(0);
        const lastLog = console.log.mock.calls[console.log.mock.calls.length - 1][0];
        const gottenTicket = JSON.parse(lastLog);
        expect(gottenTicket.id).toBe(createdTicket.id);
    });
}); 
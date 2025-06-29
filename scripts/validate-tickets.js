// validate-tickets.js (ESM)
// Scans all tickets for JSON validity and required fields. Logs any corrupt or invalid tickets.
import fs from 'node:fs';
import path from 'node:path';
import { reportError } from '../packages/tooling/src/ErrorReporter.js';

const TICKETS_DIR = path.resolve(process.cwd(), 'tests/bug-reports');
const REQUIRED_FIELDS = ['id', 'type', 'title', 'status'];

function validateTicket(ticket, filePath) {
  for (const field of REQUIRED_FIELDS) {
    if (!ticket[field]) {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

function scanTickets() {
  const results = [];
  const folders = fs.readdirSync(TICKETS_DIR, { withFileTypes: true });
  for (const dirent of folders) {
    if (dirent.isDirectory()) {
      const subDir = path.join(TICKETS_DIR, dirent.name);
      const files = fs.readdirSync(subDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(subDir, file);
          try {
            const data = fs.readFileSync(filePath, 'utf8');
            const ticket = JSON.parse(data);
            const err = validateTicket(ticket, filePath);
            if (err) {
              results.push({ file: filePath, error: err });
            }
          } catch (e) {
            results.push({ file: filePath, error: 'Invalid JSON' });
          }
        }
      }
    }
  }
  return results;
}

const invalids = scanTickets();
if (invalids.length === 0) {
  console.log('✅ All tickets valid.');
} else {
  reportError('TICKET_VALIDATION_FAILED', 'Invalid/corrupt tickets found', { issues: invalids });
}

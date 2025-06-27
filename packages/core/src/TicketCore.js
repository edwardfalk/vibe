// TicketCore.js - single-source-of-truth for ticket file operations
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { existsSync, copyFileSync, mkdirSync, rmSync } from 'fs';

const TICKETS_DIR = path.resolve(process.cwd(), 'tests/bug-reports');
const BACKUP_DIR = path.resolve(process.cwd(), 'backups');
const ALLOWED_TYPES = ['bug', 'feature', 'enhancement', 'task'];
const TICKET_ID_REGEX = /^[A-Z]{2,4}-\d{4}-\d{2}-\d{2}-[a-z0-9]{6,}$/i;
const DEBUG_LOG_FILE = path.resolve(process.cwd(), 'debug-ticketcore.log');

// Simple file logger
function debugLog(msg) {
  fs.appendFile(DEBUG_LOG_FILE, `${new Date().toISOString()} - ${msg}\n`);
}

function log(level, emoji, msg) {
  const out = `${emoji} [TicketCore] ${msg}`;
  if (level === 'error') console.error(out);
  else if (level === 'warn') console.warn(out);
  else console.log(out);
}

function slugify(title, maxLen = 16) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen);
}

async function generateId(type = 'bug') {
  const prefix = type.toUpperCase().slice(0, 4);
  let base = new Date().toISOString().replace(/[:.]/g, '-'); // 2024-06-25T22-15-30-123Z
  base = base.replace('Z', ''); // Ta bort Z
  let id = `${prefix}-${base}`;
  let counter = 0;
  // Kolla om id redan finns, lägg på siffra om det behövs
  while (true) {
    try {
      await readTicket(id);
      counter++;
      id = `${prefix}-${base}-${counter}`;
    } catch (e) {
      if (e.message && e.message.includes('not found')) {
        break; // id är unikt
      }
      throw e;
    }
  }
  return id;
}

function folderName(ticket) {
  const iso = ticket.createdAt
    ? new Date(ticket.createdAt).toISOString().replace(/[:.]/g, '-')
    : new Date().toISOString().replace(/[:.]/g, '-');
  const slug = slugify(ticket.title || ticket.id || 'ticket', 16);
  return `${iso}_${ticket.id}_${slug}`;
}

function validateTicketFields(ticket) {
  // Type checks
  if (ticket.tags && !Array.isArray(ticket.tags))
    throw new Error('Invalid type for tags: must be array');
  if (ticket.checklist && !Array.isArray(ticket.checklist))
    throw new Error('Invalid type for checklist: must be array');
  if (ticket.artifacts && !Array.isArray(ticket.artifacts))
    throw new Error('Invalid type for artifacts: must be array');
  if (ticket.relatedTickets && !Array.isArray(ticket.relatedTickets))
    throw new Error('Invalid type for relatedTickets: must be array');
  // Reasonable limits
  if (ticket.title && ticket.title.length > 256)
    throw new Error('Error: Title too long (max 256 chars)');
  if (ticket.description && ticket.description.length > 2048)
    throw new Error('Error: Description too long (max 2048 chars)');
}

async function ensureMeta(ticket, isNew = false) {
  log('info', '🪪', `[ensureMeta] called. isNew=${isNew}, id=${ticket.id}`);
  validateTicketFields(ticket);
  if (isNew && !ticket.id) {
    log('info', '🪪', `[ensureMeta] id saknas, genererar automatiskt...`);
    ticket.id = await generateId(ticket.type || 'bug');
    log('info', '🪪', `[ensureMeta] id genererat: ${ticket.id}`);
  }
  if (!ticket.id) throw new Error('Missing ticket id');
  if (!TICKET_ID_REGEX.test(ticket.id))
    throw new Error('Invalid ticket id format');
  if (!ticket.title) throw new Error('Missing ticket title');
  if (!ticket.type || !ALLOWED_TYPES.includes(ticket.type))
    throw new Error('Invalid ticket type');
  if (isNew && !ticket.status) ticket.status = 'open';
  if (!Array.isArray(ticket.history)) ticket.history = [];
  if (!Array.isArray(ticket.artifacts)) ticket.artifacts = [];
  if (!Array.isArray(ticket.relatedTickets)) ticket.relatedTickets = [];
  if (!ticket.createdAt) ticket.createdAt = new Date().toISOString();
  ticket.updatedAt = new Date().toISOString();

  if (isNew || !ticket.slug) {
    ticket.slug = slugify(ticket.title, 16);
  }
  if (isNew || !ticket.folder) {
    ticket.folder = folderName(ticket);
  }

  if (isNew) {
    addHistoryEntry(ticket, 'created');
  }
}

function addHistoryEntry(ticket, action, details = {}) {
  if (!Array.isArray(ticket.history)) {
    ticket.history = [];
  }
  const newEntry = {
    timestamp: new Date().toISOString(),
    action,
    user: 'system', // For now, user is always system.
    ...details,
  };
  ticket.history.push(newEntry);
}

function validateId(id) {
  if (!TICKET_ID_REGEX.test(id)) throw new Error('Invalid ticket id');
  if (id.includes('..') || id.includes('/') || id.includes('\\'))
    throw new Error('Path traversal detected');
}

async function writeTicket(ticket, isNew = false) {
  await ensureMeta(ticket, isNew);
  const folder = path.join(TICKETS_DIR, ticket.folder);
  await fs.mkdir(folder, { recursive: true });
  const tmp = path.join(folder, `tmp-${ticket.id}.json`);
  const final = path.join(folder, `${ticket.id}.json`);
  try {
    await fs.writeFile(tmp, JSON.stringify(ticket, null, 2));
    await fs.rename(tmp, final); // atomic on most platforms
    log('info', '🎫', `Wrote ticket ${ticket.id} to ${final}`);
    return { ...ticket };
  } catch (e) {
    log('error', '❌', `Failed to write ticket ${ticket.id}: ${e.message}`);
    throw e;
  }
}

async function readTicket(id) {
  validateId(id);
  const folders = await fs.readdir(TICKETS_DIR);
  const folderName = folders.find((f) => f.includes(id));

  if (!folderName) {
    throw new Error(`Ticket ${id} not found`);
  }
  const file = path.join(TICKETS_DIR, folderName, `${id}.json`);
  try {
    const data = await fs.readFile(file, 'utf8');
    const ticket = JSON.parse(data);
    return { ...ticket };
  } catch (e) {
    throw new Error(`Ticket ${id} not found`);
  }
}

async function deleteTicket(id) {
  validateId(id);
  const folders = await fs.readdir(TICKETS_DIR);
  const folderName = folders.find((f) => f.includes(id));

  if (!folderName) {
    // If folder doesn't exist, we can consider it deleted.
    log(
      'warn',
      '⚠️',
      `Folder for ticket ${id} not found, assuming already deleted.`
    );
    return { id: id, status: 'deleted' };
  }

  const folderPath = path.join(TICKETS_DIR, folderName);
  try {
    await fs.rm(folderPath, { recursive: true, force: true });
    log('info', '🗑️', `Deleted ticket ${id} and folder ${folderName}`);
    return { id: id, status: 'deleted' };
  } catch (err) {
    log(
      'error',
      '❌',
      `Failed to delete folder for ticket ${id}: ${err.message}`
    );
    throw err;
  }
}

async function listTickets({
  type,
  status,
  focus,
  limit = 100,
  offset = 0,
} = {}) {
  const dirents = await fs.readdir(TICKETS_DIR, { withFileTypes: true });
  let tickets = [];

  for (const dirent of dirents) {
    if (dirent.isDirectory()) {
      const subDirPath = path.join(TICKETS_DIR, dirent.name);
      try {
        const files = await fs.readdir(subDirPath);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(subDirPath, file);
            const data = await fs.readFile(filePath, 'utf8');
            try {
              const ticket = JSON.parse(data);
              tickets.push(ticket);
            } catch (parseErr) {
              log('warn', '⚠️', `Skipping invalid JSON file: ${filePath}`);
            }
          }
        }
      } catch (readDirErr) {
        log('warn', '⚠️', `Could not read directory: ${subDirPath}`);
      }
    } else if (dirent.isFile() && dirent.name.endsWith('.json')) {
      const filePath = path.join(TICKETS_DIR, dirent.name);
      const data = await fs.readFile(filePath, 'utf8');
      try {
        const ticket = JSON.parse(data);
        tickets.push(ticket);
      } catch (parseErr) {
        log('warn', '⚠️', `Skipping invalid JSON file: ${filePath}`);
      }
    }
  }

  if (type) {
    tickets = tickets.filter((t) => t.type === type);
  }
  if (status) {
    tickets = tickets.filter((t) => t.status && t.status.trim() === status);
  }
  if (focus) {
    tickets = tickets.filter(
      (t) => t.tags?.includes('focus') && t.status !== 'closed'
    );
  }
  tickets.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return tickets.slice(offset, offset + limit);
}

export {
  generateId,
  slugify,
  folderName,
  writeTicket,
  readTicket,
  deleteTicket,
  listTickets,
  ensureMeta,
  addHistoryEntry,
  log,
  validateId,
};

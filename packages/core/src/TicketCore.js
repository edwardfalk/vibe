// TicketCore.js - single-source-of-truth for ticket file operations
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const TICKETS_DIR = path.resolve(process.cwd(), 'tests/bug-reports');
const ALLOWED_TYPES = ['bug', 'feature', 'enhancement', 'task'];
const TICKET_ID_REGEX = /^[A-Z]{2,4}-\d{4}-\d{2}-\d{2}-[a-z0-9]{6,}$/i;

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

function generateId(type = 'bug', title = '') {
  const prefix = type.toUpperCase().slice(0, 4);
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const ms = now.getTime() % 1000;
  const rand = crypto.randomBytes(3).toString('hex');
  return `${prefix}-${date}-${rand}`;
}

function folderName(ticket) {
  const iso = new Date().toISOString().replace(/[:.]/g, '-');
  const slug = slugify(ticket.title || ticket.id || 'ticket', 16);
  return `${iso}_${ticket.id}_${slug}`;
}

function ensureMeta(ticket, isNew = false) {
  if (!ticket.id) throw new Error('Missing ticket id');
  if (!TICKET_ID_REGEX.test(ticket.id)) throw new Error('Invalid ticket id format');
  if (!ticket.title) throw new Error('Missing ticket title');
  if (!ticket.type || !ALLOWED_TYPES.includes(ticket.type)) throw new Error('Invalid ticket type');
  if (isNew && !ticket.status) ticket.status = 'open';
  if (!Array.isArray(ticket.history)) ticket.history = [];
  if (!Array.isArray(ticket.artifacts)) ticket.artifacts = [];
  if (!Array.isArray(ticket.relatedTickets)) ticket.relatedTickets = [];
  if (!ticket.createdAt) ticket.createdAt = new Date().toISOString();
  ticket.updatedAt = new Date().toISOString();
  ticket.slug = slugify(ticket.title, 16);
  ticket.folder = folderName(ticket);
}

function validateId(id) {
  if (!TICKET_ID_REGEX.test(id)) throw new Error('Invalid ticket id');
  if (id.includes('..') || id.includes('/') || id.includes('\\')) throw new Error('Path traversal detected');
}

async function writeTicket(ticket) {
  ensureMeta(ticket, true);
  const folder = path.join(TICKETS_DIR, ticket.folder);
  await fs.mkdir(folder, { recursive: true });
  const tmp = path.join(folder, `tmp-${ticket.id}.json`);
  const final = path.join(folder, `${ticket.id}.json`);
  await fs.writeFile(tmp, JSON.stringify(ticket, null, 2));
  await fs.rename(tmp, final);
  log('info', '🎫', `Wrote ticket ${ticket.id} to ${final}`);
  return { ...ticket };
}

async function readTicket(id) {
  validateId(id);
  // Find ticket in all subfolders
  const folders = await fs.readdir(TICKETS_DIR);
  for (const folder of folders) {
    const stat = await fs.stat(path.join(TICKETS_DIR, folder));
    if (!stat.isDirectory()) continue;
    const file = path.join(TICKETS_DIR, folder, `${id}.json`);
    try {
      const data = await fs.readFile(file, 'utf8');
      const ticket = JSON.parse(data);
      return { ...ticket };
    } catch (e) { /* not found, keep searching */ }
  }
  throw new Error(`Ticket ${id} not found`);
}

async function listTickets({ status, focus, limit = 100, offset = 0 } = {}) {
  const folders = await fs.readdir(TICKETS_DIR);
  let tickets = [];
  for (const folder of folders) {
    const stat = await fs.stat(path.join(TICKETS_DIR, folder));
    if (!stat.isDirectory()) continue;
    const files = await fs.readdir(path.join(TICKETS_DIR, folder));
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const data = await fs.readFile(path.join(TICKETS_DIR, folder, file), 'utf8');
      const ticket = JSON.parse(data);
      tickets.push(ticket);
    }
  }
  if (status) tickets = tickets.filter(t => t.status === status);
  if (focus) tickets = tickets.filter(t => t.tags && t.tags.includes('focus') && t.status !== 'closed');
  tickets.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return tickets.slice(offset, offset + limit);
}

export {
  generateId,
  slugify,
  folderName,
  writeTicket,
  readTicket,
  listTickets,
  ensureMeta,
  log,
  validateId
}; 
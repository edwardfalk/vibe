#!/usr/bin/env node
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

function usage() {
  console.log('Usage: bun run tickets:new "short slug" --area gameplay --prio high');
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) usage();

// parse flags
let area = 'gameplay';
let priority = 'medium';
const slugParts = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--area') {
    area = args[++i] || area;
  } else if (a === '--prio' || a === '--priority') {
    priority = args[++i] || priority;
  } else {
    slugParts.push(a);
  }
}
if (slugParts.length === 0) usage();

const slugRaw = slugParts.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '-');
const date = new Date();
const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, '');
const filename = `${yyyymmdd}-${slugRaw}.md`;
const dir = join(process.cwd(), 'docs', 'tickets');
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
const path = join(dir, filename);
if (existsSync(path)) {
  console.error(`Ticket already exists: ${path}`);
  process.exit(1);
}

const template = `---
id: TCK-${yyyymmdd}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}
status: open
priority: ${priority}
owner: @unassigned
area: ${area}
---
# ${slugParts.join(' ')}

## Problem

## Reproduction Steps

## Expected vs. Actual

## Acceptance Criteria
- [ ] 

## Suggested Fix (optional)

## References
`;

writeFileSync(path, template, 'utf8');
console.log(`Created ${path}`);

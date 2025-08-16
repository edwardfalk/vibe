#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const TICKETS_DIR = join(ROOT, 'docs', 'tickets');
const IGNORE = new Set(['README.md', '_TEMPLATE.md', 'UNSORTED.md', 'INDEX.md', 'labels.md', 'OWNERS.md']);

function parseFM(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
  const fm = {};
  if (m) {
    for (const line of m[1].split(/\r?\n/)) {
      const i = line.indexOf(':');
      if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return fm;
}

function countChecks(src) {
  const unchecked = (src.match(/^- \[ \]/gm) || []).length;
  const checked = (src.match(/^- \[x\]/gmi) || []).length;
  return { unchecked, checked };
}

function passFilters(fm, filters) {
  for (const [k, v] of Object.entries(filters)) {
    if (!v) continue;
    const cur = (fm[k] || '').toLowerCase();
    if (!cur.includes(String(v).toLowerCase())) return false;
  }
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const filters = { status: null, priority: null, area: null, owner: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--status') filters.status = args[++i];
    else if (a === '--prio' || a === '--priority') filters.priority = args[++i];
    else if (a === '--area') filters.area = args[++i];
    else if (a === '--owner') filters.owner = args[++i];
  }
  const files = (await fs.readdir(TICKETS_DIR)).filter(f => f.endsWith('.md') && !IGNORE.has(f));
  const rows = [];
  for (const f of files) {
    const src = await fs.readFile(join(TICKETS_DIR, f), 'utf8');
    const fm = parseFM(src);
    if (!passFilters(fm, filters)) continue;
    const { unchecked, checked } = countChecks(src);
    rows.push({ file: f, status: fm.status || '', priority: fm.priority || '', area: fm.area || '', owner: fm.owner || '', unchecked, checked });
  }
  rows.sort((a,b)=>a.status.localeCompare(b.status) || a.priority.localeCompare(b.priority) || a.file.localeCompare(b.file));
  if (!rows.length) { console.log('No tickets matched.'); return; }
  console.log('file\tstatus\tprio\tarea\towner\topen\tdone');
  for (const r of rows) console.log(`${r.file}\t${r.status}\t${r.priority}\t${r.area}\t${r.owner}\t${r.unchecked}\t${r.checked}`);
}

main().catch(e=>{ console.error(e); process.exit(1); });

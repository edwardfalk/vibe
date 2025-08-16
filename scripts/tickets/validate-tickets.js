#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const DIR = join(ROOT, 'docs', 'tickets');
const IGNORE = new Set(['README.md', '_TEMPLATE.md', 'UNSORTED.md', 'INDEX.md', 'labels.md', 'OWNERS.md']);
const AREAS = new Set(['gameplay','audio','fx','tooling','docs','perf']);
const STATUSES = new Set(['open','in-progress','done','wontfix']);

function fm(src){
  const m = src.match(/^---\n([\s\S]*?)\n---\n?/); const r={};
  if(m){ for(const line of m[1].split(/\r?\n/)){ const i=line.indexOf(':'); if(i>0) r[line.slice(0,i).trim()]=line.slice(i+1).trim(); } }
  return r;
}
function checks(src){ return { unchecked: (src.match(/^- \[ \]/gm)||[]).length, checked: (src.match(/^- \[x\]/gmi)||[]).length }; }

async function main(){
  const files = (await fs.readdir(DIR)).filter(f=>f.endsWith('.md') && !IGNORE.has(f));
  let errors = 0;
  for (const f of files){
    const src = await fs.readFile(join(DIR,f),'utf8');
    const m = fm(src);
    const {unchecked, checked} = checks(src);
    const req = ['status','priority','owner','area'];
    for(const k of req){ if(!m[k]){ console.error(`${f}: missing ${k}`); errors++; } }
    if(m.status && !STATUSES.has(m.status)) { console.error(`${f}: invalid status ${m.status}`); errors++; }
    if(m.area && !AREAS.has(m.area)) { console.error(`${f}: invalid area ${m.area}`); errors++; }
    if(m.status === 'open' && unchecked === 0){ console.error(`${f}: open but no unchecked acceptance criteria`); errors++; }
    if(m.status === 'done' && unchecked > 0){ console.error(`${f}: done but has unchecked items`); errors++; }
  }
  if(errors){ process.exit(1); }
  console.log('TICKETS_VALID');
}

main().catch(e=>{ console.error(e); process.exit(1); });

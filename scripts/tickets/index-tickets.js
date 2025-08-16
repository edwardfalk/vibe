#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const DIR = join(ROOT, 'docs', 'tickets');
const IGNORE = new Set(['README.md', '_TEMPLATE.md', 'UNSORTED.md', 'labels.md', 'OWNERS.md']);

function fm(src){
  const m = src.match(/^---\n([\s\S]*?)\n---\n?/); const r={};
  if(m){ for(const line of m[1].split(/\r?\n/)){ const i=line.indexOf(':'); if(i>0) r[line.slice(0,i).trim()]=line.slice(i+1).trim(); } }
  return r;
}
function counts(text){
  const unchecked=(text.match(/^- \[ \]/gm)||[]).length; const checked=(text.match(/^- \[x\]/gmi)||[]).length;
  return {unchecked, checked};
}

async function main(){
  const files=(await fs.readdir(DIR)).filter(f=>f.endsWith('.md') && !IGNORE.has(f));
  const byArea={}; let open=0, done=0;
  for(const f of files){
    const src=await fs.readFile(join(DIR,f),'utf8');
    const m=fm(src); const {unchecked}=counts(src);
    const area=(m.area||'misc').toLowerCase();
    if(!byArea[area]) byArea[area]={count:0};
    byArea[area].count++;
    if((m.status||'').startsWith('done')) done++; else open++;
  }
  let out='# Tickets Index\n\n';
  out+=`Open tickets: ${open}\n\n`; out+=`Done tickets: ${done}\n\n`;
  out+='## By area\n';
  for(const [k,v] of Object.entries(byArea)) out+=`- ${k}: ${v.count}\n`;
  await fs.writeFile(join(DIR,'INDEX.md'), out, 'utf8');
  console.log('TICKETS_INDEX_UPDATED');
}

main().catch(e=>{ console.error(e); process.exit(1); });

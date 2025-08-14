#!/usr/bin/env node
// Deterministic scan to flag rule precedence conflicts and metadata violations
// Usage: bun run scripts/check-rule-precedence.js

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const ROOT = process.cwd();
const RULES_DIR = path.join(ROOT, '.cursor', 'rules');
const MASTER_RULE = path.join(ROOT, '.cursorrules');

function listRuleFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.mdc'))
    .map((f) => path.join(dir, f));
}

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function extractRuleIdAndMeta(filePath) {
  const raw = readFile(filePath);
  const { data: fm, content } = matter(raw);
  // Pull ID from content (first "ID: RULE-..." line) if not in front matter
  const idMatch = content.match(/\bID:\s*(RULE-[0-9-]+)\b/);
  const id = fm.id || (idMatch ? idMatch[1] : path.basename(filePath));
  return { id, fm, content, filePath };
}

function isMasterDirectives(meta) {
  const name = path.basename(meta.filePath).toLowerCase();
  return (
    name.startsWith('a-master-directives-') &&
    meta.fm &&
    meta.fm.alwaysApply === true
  );
}

function tierOfMeta(meta) {
  // Highest tier is infrastructure-injected workspace rules (not in repo); we only validate repo tiers inside the repo
  if (isMasterDirectives(meta)) return 2; // Repo Master Directives (highest in-repo)
  if (path.basename(meta.filePath) === '.cursorrules') return 3; // repo master
  if (meta.filePath.includes(path.join('.cursor', 'rules'))) return 4; // topic/area
  // User Rules are external; treat as lowest in this scan if present
  return 99; // unknown/ignored
}

function isExpired(fm) {
  if (!fm || !fm.expires) return false;
  const now = new Date();
  const exp = new Date(fm.expires);
  return !isNaN(exp) && exp < now;
}

function validateNoLowerOverridesHigher(ruleMetaList) {
  const problems = [];
  const byId = new Map(ruleMetaList.map((r) => [r.id, r]));
  for (const r of ruleMetaList) {
    const fm = r.fm || {};
    if (!fm.overrides) continue;
    const rTier = tierOfMeta(r);
    for (const targetId of fm.overrides) {
      const target = byId.get(targetId);
      if (!target) continue;
      const tTier = tierOfMeta(target);
      if (rTier > tTier) {
        problems.push(
          `Lower-tier rule ${r.id} (${r.filePath}) claims to override higher-tier ${target.id} (${target.filePath}).`
        );
      }
    }
  }
  return problems;
}

function validateFrontMatter(ruleMetaList) {
  const problems = [];
  for (const r of ruleMetaList) {
    const fm = r.fm || {};
    if (fm.priority != null && typeof fm.priority !== 'number') {
      problems.push(`Rule ${r.id} has non-numeric priority in ${r.filePath}.`);
    }
    if (fm.expires) {
      const d = new Date(fm.expires);
      if (isNaN(d))
        problems.push(
          `Rule ${r.id} has invalid expires date in ${r.filePath} (use YYYY-MM-DD).`
        );
    }
  }
  return problems;
}

function run() {
  const files = [MASTER_RULE, ...listRuleFiles(RULES_DIR)].filter((f) =>
    fs.existsSync(f)
  );
  const metas = files.map(extractRuleIdAndMeta);

  // Ensure at most one non-expired Master Directives file
  const activeMasters = metas.filter(
    (m) => isMasterDirectives(m) && !isExpired(m.fm)
  );
  if (activeMasters.length > 1) {
    const names = activeMasters
      .map((m) => `${m.id} (${m.filePath})`)
      .join(', ');
    console.error('Multiple active Master Directives detected: ' + names);
    process.exit(1);
  }

  const problems = [
    ...validateNoLowerOverridesHigher(metas),
    ...validateFrontMatter(metas),
  ];

  if (problems.length) {
    console.error('Rule precedence scan found issues:');
    for (const p of problems) console.error(' - ' + p);
    process.exit(1);
  }
  console.log('✅ Rule precedence check passed');
}

run();

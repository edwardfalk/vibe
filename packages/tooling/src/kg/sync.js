#!/usr/bin/env bun
/**
 * KG Sync (Neo4j) – repo → knowledge graph
 *
 * Phases (v0.1):
 *  - Scan files under packages/** and create File nodes
 *  - Scan .cursor/rules/** for Rule nodes
 *  - Scan tests for files matching "*-probe.test.js" for Probe nodes
 *  - Parse SOUND ids and manifest assets; create Sound and Asset nodes
 *  - Create edges:
 *      Project(CONTAINS)→File
 *      File(USES)→Sound
 *      Sound(HAS_ASSET)→Asset
 *
 * Idempotent MERGE upserts using node key properties.
 *
 * Env:
 *  - NEO4J_URI (e.g., neo4j://127.0.0.1:7687)
 *  - NEO4J_USERNAME (e.g., neo4j)
 *  - NEO4J_PASSWORD (your password)
 *
 * Usage:
 *  - Dry run (default): bun run packages/tooling/src/kg/sync.js --dry
 *  - Write:             bun run packages/tooling/src/kg/sync.js --write
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, extname, basename, relative } from 'node:path';
import minimist from 'minimist';
import { Octokit } from '@octokit/rest';

// Lazy import to avoid hard failure if env is missing during dry-run
let neo4j = null;

const ROOT = process.cwd();
const PKG_DIR = join(ROOT, 'packages');
const RULES_DIR = join(ROOT, '.cursor', 'rules');
const TESTS_DIR = join(ROOT, 'tests');
const SOUND_IDS_FILE = join(
  ROOT,
  'packages',
  'core',
  'src',
  'audio',
  'SoundIds.js'
);
const AUDIO_MANIFEST = join(ROOT, 'public', 'audio', 'manifest.json');

const argv = minimist(process.argv.slice(2));
const isWrite = Boolean(argv.write) && !argv.dry;
const includeGithub = Boolean(argv.github);
const wantReport = Boolean(argv.report);
const projectName = 'Vibe';
const projectKey = `project:${projectName}`;

/**
 * Simple file tree walker
 */
function walk(dir, filterFn = () => true, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, filterFn, files);
    } else if (filterFn(full)) {
      files.push(full);
    }
  }
  return files;
}

function detectKindFromPath(p) {
  const norm = p.replace(/\\/g, '/');
  if (norm.includes('/systems/src/')) return 'system';
  if (norm.includes('/entities/src/')) return 'entity';
  if (norm.includes('/fx/src/')) return 'fx';
  if (norm.includes('/core/src/')) return 'core';
  if (norm.includes('/game/src/')) return 'game';
  if (norm.includes('/tooling/src/')) return 'tooling';
  return 'other';
}

function parseSoundIds(sourceText) {
  // Extract inside Object.freeze({ ... }) and parse key: 'value' pairs
  const out = new Set();
  const m = sourceText.match(/Object\.freeze\(\s*\{([\s\S]*?)\}\s*\)/);
  if (m) {
    const body = m[1];
    const re = /(\w+)\s*:\s*['"]([^'"\n]+)['"];?/g;
    let mm;
    while ((mm = re.exec(body)) !== null) {
      const key = mm[1];
      const val = mm[2];
      out.add(val || key);
    }
  }
  return Array.from(out);
}

function parseSoundUsages(filePath, fileText) {
  const ids = new Set();
  const re = /\bSOUND\.(\w+)/g;
  let m;
  while ((m = re.exec(fileText)) !== null) {
    ids.add(m[1]);
  }
  return Array.from(ids);
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function getDriver() {
  if (!isWrite) return null; // not needed for dry-run
  if (!neo4j) neo4j = await import('neo4j-driver');
  const uri = requireEnv('NEO4J_URI');
  const user = requireEnv('NEO4J_USERNAME');
  const pass = requireEnv('NEO4J_PASSWORD');
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, pass));
  await driver.getServerInfo();
  return driver;
}

function upsertPlan() {
  const plan = {
    nodes: [],
    edges: [],
    stats: { files: 0, rules: 0, probes: 0, sounds: 0, assets: 0 },
  };

  // Files under packages/**
  const jsFiles = walk(PKG_DIR, (p) => extname(p) === '.js');
  /** @type {{key:string, rel:string, name:string, kind:string}[]} */
  const fileRecs = [];
  for (const f of jsFiles) {
    const rel = relative(ROOT, f).replace(/\\/g, '/');
    const kind = detectKindFromPath(f);
    const name = basename(f, '.js');
    const key = `file:${rel}`;
    plan.nodes.push({ label: 'File', key, props: { path: rel, name, kind } });
    fileRecs.push({ key, rel, name, kind });
    plan.edges.push({ type: 'CONTAINS', fromKey: projectKey, toKey: key });
    plan.stats.files++;
  }

  // Rules under .cursor/rules/**
  const ruleRefs = [];
  if (existsSync(RULES_DIR)) {
    const ruleFiles = walk(RULES_DIR, (p) => extname(p) === '.mdc');
    for (const rf of ruleFiles) {
      const rel = relative(ROOT, rf).replace(/\\/g, '/');
      const id = basename(rf, '.mdc');
      const key = `rule:${id}`;
      plan.nodes.push({ label: 'Rule', key, props: { id, path: rel } });
      // Extract explicit file links of form mdcprefix:path (e.g., mdc:packages/tooling/src/cleanup/cli.js)
      const src = readFileSync(rf, 'utf8');
      const links = [];
      const re = /mdc:([^\]\s]+)/g;
      let m;
      while ((m = re.exec(src)) !== null) {
        const target = m[1].replace(/^\.\/?/, '');
        links.push(target);
      }
      if (links.length) ruleRefs.push({ ruleKey: key, links });
      plan.stats.rules++;
    }
  }

  // Probes under tests/** ending with -probe.test.js
  const probeKeys = [];
  if (existsSync(TESTS_DIR)) {
    const probeFiles = walk(TESTS_DIR, (p) => /-probe\.test\.js$/.test(p));
    for (const pf of probeFiles) {
      const rel = relative(ROOT, pf).replace(/\\/g, '/');
      const name = basename(pf).replace(/\.js$/, '');
      const key = `probe:${name}`;
      plan.nodes.push({ label: 'Probe', key, props: { name, path: rel } });
      probeKeys.push({ key, name });
      plan.stats.probes++;
    }
  }

  // Sounds and assets
  let soundIds = [];
  if (existsSync(SOUND_IDS_FILE)) {
    const txt = readFileSync(SOUND_IDS_FILE, 'utf8');
    soundIds = parseSoundIds(txt);
    for (const id of soundIds) {
      const key = `sound:${id}`;
      plan.nodes.push({ label: 'Sound', key, props: { id } });
      plan.stats.sounds++;
    }
  }
  let manifest = {};
  if (existsSync(AUDIO_MANIFEST)) {
    try {
      manifest = JSON.parse(readFileSync(AUDIO_MANIFEST, 'utf8'));
    } catch {
      // ignore
    }
    for (const [sid, url] of Object.entries(manifest)) {
      const assetKey = `asset:${url}`;
      plan.nodes.push({
        label: 'Asset',
        key: assetKey,
        props: { path: url, kind: 'audio' },
      });
      plan.edges.push({
        type: 'HAS_ASSET',
        fromKey: `sound:${sid}`,
        toKey: assetKey,
      });
      plan.stats.assets++;
    }
  }

  // File → Sound usages
  for (const f of jsFiles) {
    const rel = relative(ROOT, f).replace(/\\/g, '/');
    const fileText = readFileSync(f, 'utf8');
    const used = parseSoundUsages(f, fileText);
    for (const sid of used) {
      plan.edges.push({
        type: 'USES',
        fromKey: `file:${rel}`,
        toKey: `sound:${sid}`,
      });
    }
  }

  // Rule → Project (baseline applicability)
  for (const n of plan.nodes) {
    if (n.label === 'Rule') {
      plan.edges.push({
        type: 'APPLIES_TO',
        fromKey: n.key,
        toKey: projectKey,
      });
    }
  }

  // Rule → File edges from explicit mdc: links
  if (ruleRefs.length) {
    const fileKeySet = new Set(fileRecs.map((f) => f.key));
    for (const rr of ruleRefs) {
      for (const link of rr.links) {
        const toKey = `file:${link}`;
        if (fileKeySet.has(toKey)) {
          plan.edges.push({ type: 'APPLIES_TO', fromKey: rr.ruleKey, toKey });
        }
      }
    }
  }

  // Probe → File/System heuristic coverage mapping
  const allowedProbeTargets = new Set(['system', 'entity', 'game']);
  function tokenizeName(s) {
    const base = s.replace(/[^A-Za-z0-9]+/g, ' ');
    // split camelCase, then lower
    return base
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t && t.length >= 4);
  }
  const fileTokens = fileRecs.map((fr) => ({
    fr,
    tokens: tokenizeName(fr.name),
  }));
  for (const pr of probeKeys) {
    const pTokens = tokenizeName(pr.name);
    for (const { fr, tokens } of fileTokens) {
      if (!allowedProbeTargets.has(fr.kind)) continue;
      const hit = tokens.some((t) => pTokens.includes(t));
      if (hit) {
        plan.edges.push({ type: 'COVERS', fromKey: pr.key, toKey: fr.key });
      }
    }
    // Manual hints for broad probes → GameLoop
    if (!plan.edges.some((e) => e.type === 'COVERS' && e.fromKey === pr.key)) {
      if (/gameplay|startup|black|dev-server/.test(pr.name)) {
        const gl = fileRecs.find((fr) =>
          fr.rel.endsWith('packages/game/src/GameLoop.js')
        );
        if (gl)
          plan.edges.push({ type: 'COVERS', fromKey: pr.key, toKey: gl.key });
      }
    }
  }

  // Project node
  plan.nodes.push({
    label: 'Project',
    key: projectKey,
    props: { name: projectName, repo: 'local' },
  });

  return plan;
}

async function ensureConstraints(session) {
  const labels = ['Project', 'File', 'Rule', 'Probe', 'Sound', 'Asset'];
  for (const L of labels) {
    const cy = `CREATE CONSTRAINT ${L.toLowerCase()}_key IF NOT EXISTS FOR (n:${L}) REQUIRE n.key IS UNIQUE`;
    await session.run(cy);
  }
}

async function writePlan(plan, driver) {
  const session = driver.session();
  try {
    await ensureConstraints(session);

    // Upsert nodes
    for (const n of plan.nodes) {
      const cy = `MERGE (x:${n.label} {key: $key})\nON CREATE SET x += $props\nON MATCH SET x += $props`;
      await session.run(cy, { key: n.key, props: n.props });
    }

    // Upsert edges
    for (const e of plan.edges) {
      const cy = `MATCH (a {key: $fromKey}), (b {key: $toKey})\nMERGE (a)-[r:${e.type}]->(b)`;
      await session.run(cy, { fromKey: e.fromKey, toKey: e.toKey });
    }
  } finally {
    await session.close();
  }
}

function printPlan(plan) {
  console.log(`🎯 KG Sync Plan (dry=${!isWrite})`);
  console.log(`  Nodes: ${plan.nodes.length} | Edges: ${plan.edges.length}`);
  console.log(
    `  Files: ${plan.stats.files}, Rules: ${plan.stats.rules}, Probes: ${plan.stats.probes}, Sounds: ${plan.stats.sounds}, Assets: ${plan.stats.assets}`
  );
  if (includeGithub) {
    const prCount = plan.nodes.filter((n) => n.label === 'PR').length;
    const issueCount = plan.nodes.filter((n) => n.label === 'Issue').length;
    const refEdges = plan.edges.filter((e) => e.type === 'REFERENCES').length;
    console.log(
      `  GitHub overlay: PRs ${prCount}, Issues ${issueCount}, REFERENCES ${refEdges}`
    );
  }
  const previewNodes = plan.nodes
    .slice(0, 10)
    .map((n) => `${n.label}:${n.key}`);
  const previewEdges = plan.edges
    .slice(0, 10)
    .map((e) => `${e.fromKey}-[${e.type}]->${e.toKey}`);
  if (previewNodes.length) {
    console.log('  Sample nodes:');
    for (const s of previewNodes) console.log(`    ${s}`);
  }
  if (previewEdges.length) {
    console.log('  Sample edges:');
    for (const s of previewEdges) console.log(`    ${s}`);
  }
}

function printReport(plan) {
  console.log('--- Report ---');
  const nodesByKey = new Map(plan.nodes.map((n) => [n.key, n]));
  const fileNodes = plan.nodes.filter((n) => n.label === 'File');
  const probeNodes = plan.nodes.filter((n) => n.label === 'Probe');
  const soundNodes = plan.nodes.filter((n) => n.label === 'Sound');
  const coversTo = new Set(
    plan.edges.filter((e) => e.type === 'COVERS').map((e) => e.toKey)
  );
  const usesToSound = new Set(
    plan.edges.filter((e) => e.type === 'USES').map((e) => e.toKey)
  );
  const soundHasAsset = new Set(
    plan.edges.filter((e) => e.type === 'HAS_ASSET').map((e) => e.fromKey)
  );

  // Uncovered systems/entities/game files
  const targetKinds = new Set(['system', 'entity', 'game']);
  const uncovered = fileNodes
    .filter((f) => targetKinds.has(f.props.kind))
    .filter((f) => !coversTo.has(f.key))
    .map((f) => f.props.path)
    .sort();
  console.log(`• Uncovered targets (no Probe→COVERS): ${uncovered.length}`);
  for (const p of uncovered.slice(0, 20)) console.log(`  - ${p}`);
  if (uncovered.length > 20)
    console.log(`  ... +${uncovered.length - 20} more`);

  // Sounds usage and assets
  const soundKeys = soundNodes.map((s) => s.key);
  const unusedSounds = soundKeys
    .filter((k) => !usesToSound.has(k))
    .map((k) => k.slice('sound:'.length))
    .sort();
  const missingAsset = soundKeys
    .filter((k) => !soundHasAsset.has(k))
    .map((k) => k.slice('sound:'.length))
    .sort();
  console.log(`• Unused sounds (no File→USES): ${unusedSounds.length}`);
  for (const s of unusedSounds.slice(0, 20)) console.log(`  - ${s}`);
  if (unusedSounds.length > 20)
    console.log(`  ... +${unusedSounds.length - 20} more`);
  console.log(
    `• Sounds missing assets (no Sound→HAS_ASSET): ${missingAsset.length}`
  );
  for (const s of missingAsset.slice(0, 20)) console.log(`  - ${s}`);
  if (missingAsset.length > 20)
    console.log(`  ... +${missingAsset.length - 20} more`);

  // PR → probes to run (requires GitHub overlay)
  if (includeGithub) {
    const prNodes = plan.nodes.filter((n) => n.label === 'PR');
    if (prNodes.length) {
      const fileToProbes = new Map();
      for (const e of plan.edges) {
        if (e.type !== 'COVERS') continue;
        const fileKey = e.toKey;
        const probeKey = e.fromKey;
        if (!fileToProbes.has(fileKey)) fileToProbes.set(fileKey, new Set());
        fileToProbes.get(fileKey).add(probeKey);
      }
      const broadProbeNames = ['gameplay', 'comprehensive', 'startup'];
      const probeNameByKey = new Map(
        probeNodes.map((p) => [p.key, p.props.name])
      );
      const broadProbes = probeNodes
        .filter((p) => broadProbeNames.some((bn) => p.props.name.includes(bn)))
        .map((p) => p.key);
      for (const pr of prNodes) {
        const changedFiles = plan.edges
          .filter((e) => e.type === 'REFERENCES' && e.fromKey === pr.key)
          .map((e) => e.toKey);
        const recommend = new Set();
        for (const fk of changedFiles) {
          const probes = fileToProbes.get(fk);
          if (probes) for (const pk of probes) recommend.add(pk);
        }
        if (!recommend.size) for (const bp of broadProbes) recommend.add(bp);
        const list = Array.from(recommend)
          .map((k) => probeNameByKey.get(k) || k)
          .sort();
        const num = nodesByKey.get(pr.key)?.props?.number;
        console.log(`• PR #${num}: probes → ${list.join(', ')}`);
      }
    }
  }
}

async function main() {
  try {
    const plan = upsertPlan();
    // Optional: augment with GitHub PR/Issue nodes and REFERENCES edges
    if (includeGithub) {
      const token = process.env.GITHUB_TOKEN;
      const repoFull = process.env.GITHUB_REPO; // e.g., owner/name
      if (token && repoFull) {
        const [owner, repo] = repoFull.split('/');
        const octo = new Octokit({ auth: token });
        // Fetch a small window of open PRs and issues for context
        const [prs, issues] = await Promise.all([
          octo.pulls.list({ owner, repo, state: 'open', per_page: 20 }),
          octo.issues.listForRepo({ owner, repo, state: 'open', per_page: 20 }),
        ]);
        for (const pr of prs.data) {
          const key = `pr:${pr.number}`;
          plan.nodes.push({
            label: 'PR',
            key,
            props: { number: pr.number, title: pr.title, state: pr.state },
          });
          // Map changed files -> REFERENCES
          try {
            const files = await octo.pulls.listFiles({
              owner,
              repo,
              pull_number: pr.number,
              per_page: 100,
            });
            for (const f of files.data) {
              const fk = `file:${f.filename}`;
              plan.edges.push({ type: 'REFERENCES', fromKey: key, toKey: fk });
            }
          } catch {}
        }
        for (const is of issues.data) {
          // Skip PRs masquerading as issues
          if (is.pull_request) continue;
          const key = `issue:${is.number}`;
          plan.nodes.push({
            label: 'Issue',
            key,
            props: { number: is.number, title: is.title, state: is.state },
          });
          // Heuristic: link to files mentioned in body
          const body = is.body || '';
          const re = /packages\/[\w-]+\/src\/[\w\/.-]+\.js/g;
          const matches = body.match(re) || [];
          for (const m of matches)
            plan.edges.push({
              type: 'REFERENCES',
              fromKey: key,
              toKey: `file:${m}`,
            });
        }
      }
    }
    printPlan(plan);
    if (wantReport) {
      printReport(plan);
    }
    if (!isWrite) return;
    const driver = await getDriver();
    await writePlan(plan, driver);
    await driver.close();
    console.log('✅ KG sync complete.');
  } catch (err) {
    console.error('⚠️ KG sync failed:', err?.message || err);
    process.exit(1);
  }
}

await main();

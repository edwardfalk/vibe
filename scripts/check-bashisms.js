// check-bashisms.js – fail CI if bashisms or disallowed toolchain usage sneak into docs/CI/scripts
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, extname, posix } from 'path';

const ROOT = process.cwd();
const EXCLUDES = new Set([
  '.git', 'node_modules', 'playwright-report', 'test-results', 'coderabbit-reviews',
  '.debug', '.vite', '.next', '.dist'
]);
const SKIP_FILES = [/\.eslintcache$/i, /(^|\/)\.env$/i];
const TEXT_EXT = new Set([
  '.md', '.mdx', '.yml', '.yaml', '.json', '.js', '.mjs', '.cjs', '.cmd', '.bat', '.ps1', '.ts'
]);

// Hard errors everywhere (never allowed in repo content)
const HARD_PATTERNS = [
  { re: /\|\s*cat\b/, msg: "bash pipe to 'cat' is disallowed (cmd.exe default)" },
  { re: /\bgrep\b/, msg: 'use findstr (Windows) or our scan scripts instead of grep' },
  { re: /\brm\s+-rf\b/, msg: 'use rmdir /s /q (Windows) or our scripts' },
  { re: /(^|\s)ls(\s|$)/, msg: 'use dir (Windows) or explicit listing' },
  { re: /\btouch\b/, msg: 'use type nul > file or PowerShell New-Item' },
  { re: /(^|[\s"'])\/c\//, msg: 'WSL paths are disallowed; use Windows paths' },
  // Disallow bash/posix code fences in docs (use bat/cmd/powershell)
  { re: /```(?:bash|sh|zsh)\b/, msg: 'Use ```bat, ```cmd or ```powershell code fences in docs' },
];

// Node toolchain (prefer Bun)
const NODE_PATTERNS = [
  { re: /(^|\s)npm\s+/, msg: 'npm usage disallowed; use bun/bunx instead' },
  { re: /(^|\s)npx\s+/, msg: 'npx usage disallowed; use bunx instead' },
  { re: /(^|\s)node\s+[^\s]/, msg: 'direct node CLI disallowed; use bun to run JS' }
];

// Cmd-only hazards – check only in command contexts (not source code/prose)
const CMD_ONLY_PATTERNS = [
  { re: /(^|\s)start\s+\S+/i, msg: 'Do not use cmd `start` (spawns new console window)' },
  { re: /(\S)\s*;\s*(\S)/, msg: 'Semicolon command chaining is disallowed in cmd.exe' },
];

const ERROR_PATH_HINTS = [
  /^\.github\/workflows\//,
  /^scripts\//,
  /\.cmd$/i, /\.bat$/i, /\.ps1$/i,
  /package\.json$/i,
];

const ALLOW_MARKERS = [/bashism-allow/i, /BASHISM_ALLOW/i];

function normRel(p) {
  return p.replaceAll('\\', '/');
}
function shouldSkip(rel) {
  const parts = rel.split('/');
  if (parts.some((p) => EXCLUDES.has(p))) return true;
  if (SKIP_FILES.some((re) => re.test(rel))) return true;
  return false;
}
function isTextFile(name) {
  const ext = extname(name).toLowerCase();
  if (!ext) return true; // assume text
  return TEXT_EXT.has(ext);
}
function isErrorContext(rel) {
  return ERROR_PATH_HINTS.some((re) => re.test(rel));
}
function hasAllowMarker(text) {
  return ALLOW_MARKERS.some((m) => m.test(text));
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const rel = normRel(posix.relative(ROOT, p) || p.replace(ROOT + '/', ''));
    if (shouldSkip(rel)) continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (st.size <= 1024 * 1024 && isTextFile(p)) out.push({ abs: p, rel });
  }
  return out;
}

function scanMarkdownFences(text, languages, patterns) {
  const lines = text.split(/\r?\n/);
  let inFence = false;
  let fenceLang = '';
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceStart = line.match(/^```(\w+)?/);
    if (fenceStart) {
      if (!inFence) {
        inFence = true;
        fenceLang = (fenceStart[1] || '').toLowerCase();
      } else {
        inFence = false;
        fenceLang = '';
      }
      continue;
    }
    if (!inFence) continue;
    if (!languages.has(fenceLang)) continue;
    for (const { re, msg } of patterns) {
      if (re.test(line)) hits.push({ line: i + 1, msg });
    }
  }
  return hits;
}

function extractYamlRuns(text) {
  // naive: collect lines after 'run:' until next step name or end
  const runs = [];
  const lines = text.split(/\r?\n/);
  let collecting = false;
  let buf = [];
  for (const ln of lines) {
    const trimmed = ln.trimEnd();
    if (/^\s*-\s*name:\s*/.test(trimmed)) {
      if (buf.length) { runs.push(buf.join('\n')); buf = []; }
      collecting = false;
      continue;
    }
    if (/^\s*run:\s*/.test(trimmed)) {
      collecting = true;
      const after = trimmed.replace(/^\s*run:\s*/, '');
      if (after && after !== '|') buf.push(after);
      continue;
    }
    if (collecting) buf.push(trimmed);
  }
  if (buf.length) runs.push(buf.join('\n'));
  return runs;
}

let errors = [];
let warnings = [];

for (const file of walk(ROOT)) {
  const text = readFileSync(file.abs, 'utf8');
  if (hasAllowMarker(text)) continue;

  // Hard errors everywhere
  for (const { re, msg } of HARD_PATTERNS) {
    if (re.test(text)) errors.push({ file: file.rel, msg });
  }

  const rel = file.rel;
  const ext = extname(rel).toLowerCase();
  const isMd = ext === '.md' || ext === '.mdx';
  const isYaml = ext === '.yml' || ext === '.yaml';
  const isCmdScript = /\.(cmd|bat|ps1)$/i.test(rel);
  const isPkg = /package\.json$/i.test(rel);
  const execContext = isErrorContext(rel);

  // Node toolchain checks
  if (isMd) {
    const hits = scanMarkdownFences(text, new Set(['bash','sh','zsh','bat','cmd','powershell','ps1']), NODE_PATTERNS);
    for (const h of hits) errors.push({ file: `${rel}:${h.line}`, msg: h.msg });
  } else if (execContext || isCmdScript) {
    for (const { re, msg } of NODE_PATTERNS) {
      if (re.test(text)) errors.push({ file: rel, msg });
    }
  } else {
    for (const { re, msg } of NODE_PATTERNS) {
      if (re.test(text)) warnings.push({ file: rel, msg });
    }
  }

  // Cmd-only hazards
  if (isMd) {
    const hits = scanMarkdownFences(text, new Set(['bat','cmd','powershell','ps1']), CMD_ONLY_PATTERNS);
    for (const h of hits) errors.push({ file: `${rel}:${h.line}`, msg: h.msg });
  }
  if (isYaml) {
    const blocks = extractYamlRuns(text);
    for (const block of blocks) {
      for (const { re, msg } of CMD_ONLY_PATTERNS) {
        if (re.test(block)) errors.push({ file: rel, msg });
      }
    }
  }
  if (isCmdScript) {
    for (const { re, msg } of CMD_ONLY_PATTERNS) {
      if (re.test(text)) errors.push({ file: rel, msg });
    }
  }
  if (isPkg) {
    try {
      const pkg = JSON.parse(text);
      const scripts = pkg.scripts || {};
      for (const [name, cmd] of Object.entries(scripts)) {
        for (const { re, msg } of CMD_ONLY_PATTERNS) {
          if (re.test(String(cmd))) errors.push({ file: `${rel}#scripts.${name}`, msg });
        }
      }
    } catch {}
  }
}

if (warnings.length) {
  console.warn('⚠️ Node toolchain mentions (non-fatal):');
  for (const w of warnings) console.warn(` - ${w.file}: ${w.msg}`);
}

if (errors.length) {
  console.error('❌ Policy violations detected:');
  for (const v of errors) console.error(` - ${v.file}: ${v.msg}`);
  process.exit(1);
} else {
  console.log('✅ No disallowed bashisms or node-toolchain usages found.');
}

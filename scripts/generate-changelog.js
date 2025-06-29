#!/usr/bin/env bun
// Minimal changelog generator for Bun runtime
// Groups commits by Conventional-Commit type and prepends a section
// to docs/CHANGELOG.md. If no commits since last tag, exits silently.

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

// 1. Determine the range: from last tag (if any) to HEAD
let fromRef;
try {
  fromRef = sh("git describe --tags --abbrev=0");
} catch {
  // No tag yet – fallback to initial commit (empty range will include all)
  fromRef = sh("git rev-list --max-parents=0 HEAD");
}

const range = fromRef ? `${fromRef}..HEAD` : "";

// 2. Collect commits (skip merges)
const rawLog = sh(
  `git log ${range} --pretty=format:%h|%s --no-merges`
);
if (!rawLog) {
  console.log("ℹ️  No new commits to include in CHANGELOG.");
  process.exit(0);
}

// 3. Group by type (feat, fix, docs, chore, refactor, etc.)
const groups = {};
for (const line of rawLog.split("\n")) {
  const [hash, subject] = line.split("|");
  if (!hash || !subject) continue;
  const [typeToken] = subject.split(":");
  const type = /^[a-zA-Z]+$/.test(typeToken) ? typeToken : "other";
  if (!groups[type]) groups[type] = [];
  groups[type].push({ hash, subject: subject.replace(/^.*?:\s*/, "") });
}

// 4. Build markdown section
const today = new Date().toISOString().slice(0, 10);
let section = `## ${today}\n`;
for (const type of Object.keys(groups)) {
  section += `\n### ${type}\n`;
  for (const { hash, subject } of groups[type]) {
    section += `- ${subject} (${hash})\n`;
  }
}
section += "\n";

// 5. Prepend / update docs/CHANGELOG.md
const changelogPath = join("docs", "CHANGELOG.md");
let existing = "";
if (existsSync(changelogPath)) {
  existing = readFileSync(changelogPath, "utf8");
  if (existing.includes(`## ${today}`)) {
    console.log("ℹ️  CHANGELOG already contains today\'s section.");
    process.exit(0);
  }
}
writeFileSync(changelogPath, section + existing, "utf8");
console.log("✅ CHANGELOG updated (docs/CHANGELOG.md)"); 
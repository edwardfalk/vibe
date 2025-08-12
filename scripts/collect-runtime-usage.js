#!/usr/bin/env bun
/**
 * collect-runtime-usage.js
 * Launches Chromium, opens the game with a short sampling window, then
 * reads window.__runtimeUsage.counters and writes a JSON report to .debug/.
 */
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { chromium } from '@playwright/test';

const BASE_URL =
  process.env.BASE_URL || 'http://localhost:5500/index.html?usageSeconds=6';
const OUT_DIR = resolve('.debug');

function findSystemBrowser() {
  const candidates = [
    // Edge
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    // Chrome
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ];
  for (const p of candidates) {
    try {
      if (existsSync(p)) return p;
    } catch {}
  }
  return null;
}

async function tryLaunch() {
  const exe = findSystemBrowser();
  let lastErr;
  if (exe) {
    try {
      return await chromium.launch({ headless: true, executablePath: exe, args: ['--disable-gpu'], timeout: 90000 });
    } catch (e) { lastErr = e; }
  }
  const channels = ['msedge', 'chrome', undefined];
  for (const ch of channels) {
    try {
      return await chromium.launch({ headless: true, channel: ch, args: ['--disable-gpu'], timeout: 90000 });
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('Failed to launch any Chromium/Edge');
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const browser = await tryLaunch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Click canvas to trigger any user-gesture-required code paths
  try {
    await page.click('canvas');
  } catch {}
  // Wait a bit longer than usageSeconds
  await page.waitForTimeout(7500);
  const payload = await page.evaluate(() => {
    const counters = window.__runtimeUsage?.counters || {};
    return { when: new Date().toISOString(), counters };
  });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = join(OUT_DIR, `runtime-usage-${stamp}.json`);
  writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`[RuntimeUsage] Wrote ${outFile}`);
  await browser.close();
}

main().catch((e) => {
  console.error('collect-runtime-usage failed:', e?.message || e);
  process.exit(1);
});

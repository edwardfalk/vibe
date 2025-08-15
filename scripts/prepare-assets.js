// Prepare test/static assets needed by the browser (e.g., p5.js)
// Copies from node_modules to a web-served location under test-static/

import { promises as fs } from 'fs';
import path from 'path';

async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (_) {}
}

async function copyFileIfExists(src, dest) {
  try {
    const data = await fs.readFile(src);
    await ensureDir(path.dirname(dest));
    await fs.writeFile(dest, data);
    console.log(`Prepared asset: ${dest}`);
  } catch (err) {
    console.warn(`Skipping asset copy (not found?): ${src}`);
  }
}

async function main() {
  const root = process.cwd();
  const srcP5 = path.join(root, 'node_modules', 'p5', 'lib', 'p5.min.js');
  const dstP5a = path.join(root, 'test-static', 'p5.min.js');
  const dstP5b = path.join(root, 'p5.min.js');
  const dstP5c = path.join(root, 'public', 'p5.min.js');
  await copyFileIfExists(srcP5, dstP5a);
  await copyFileIfExists(srcP5, dstP5b);
  await copyFileIfExists(srcP5, dstP5c);
}

main().catch((err) => {
  console.error('prepare-assets failed:', err);
  process.exit(1);
});

// Programmatic ESLint runner with small console output for chat stability
// - Writes full formatted report to logs/lint_full.txt
// - Writes numeric exit to logs/lint_summary.exit
// - Prints only a short summary to stdout and exits 0

import { ESLint } from 'eslint';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

async function main() {
  const cwd = process.cwd();
  const logsDir = join(cwd, 'logs');
  try {
    mkdirSync(logsDir, { recursive: true });
  } catch {}

  const eslint = new ESLint({ cwd, cache: true });
  // Lint the entire repo (same scope as `bun run lint`)
  const files = ['.'];
  let results;
  try {
    results = await eslint.lintFiles(files);
  } catch (e) {
    const msg = `lint internal error: ${e?.message || e}`;
    writeFileSync(join(logsDir, 'lint_full.txt'), msg);
    writeFileSync(join(logsDir, 'lint_summary.exit'), '2');
    console.log(
      'lint finished: exit=2 (internal error). See logs/lint_full.txt'
    );
    process.exit(0);
    return;
  }

  const formatter = await eslint.loadFormatter('stylish');
  const reportText = await formatter.format(results);
  writeFileSync(join(logsDir, 'lint_full.txt'), reportText);

  const summary = results.reduce(
    (acc, r) => {
      acc.errorCount += r.errorCount || 0;
      acc.warningCount += r.warningCount || 0;
      return acc;
    },
    { errorCount: 0, warningCount: 0 }
  );

  const exitCode = summary.errorCount > 0 ? 1 : 0;
  writeFileSync(join(logsDir, 'lint_summary.exit'), String(exitCode));

  console.log(
    `lint summary: errors=${summary.errorCount} warnings=${summary.warningCount} (full: logs/lint_full.txt, exit: logs/lint_summary.exit)`
  );
  // Always exit 0 to keep chat stable; consumers read lint_summary.exit for the real code
  process.exit(0);
}

main();

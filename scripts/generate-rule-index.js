import { promises as fs } from 'fs';
import path from 'path';

/**
 * Generates a markdown index of all .mdc rule files under .cursor/rules.
 * The output is written to docs-site/RULES_INDEX.md so Docsify can render it.
 */
(async () => {
  const repoRoot = path.resolve(process.cwd());
  const rulesDir = path.join(repoRoot, '.cursor', 'rules');
  const outPath = path.join(repoRoot, 'docs-site', 'RULES_INDEX.md');

  const files = (await fs.readdir(rulesDir)).filter((f) => f.endsWith('.mdc'));

  // ensure local rules copy exists
  const localRulesDir = path.join(repoRoot, 'docs-site', 'rules');
  await fs.mkdir(localRulesDir, { recursive: true });

  const rows = await Promise.all(
    files.map(async (file) => {
      const filePath = path.join(rulesDir, file);
      const content = await fs.readFile(filePath, 'utf8');
      // copy file into docs-site/rules/
      await fs.copyFile(filePath, path.join(localRulesDir, file));

      const lines = content.split(/\r?\n/);

      const titleLine = lines.find((l) => l.startsWith('#')) || file;
      const title = titleLine.replace(/^#\s*/, '').trim();

      // description: look for <!-- desc: ... -->
      let desc = lines.find((l) => /<!--\s*desc:/i.test(l));
      if (desc) {
        desc = desc
          .replace(/<!--\s*desc:\s*/i, '')
          .replace(/-->.*$/, '')
          .trim();
      } else {
        // fallback: first non-empty, non-heading, non-comment line
        desc =
          lines
            .find((l) => l.trim() && !l.startsWith('#') && !l.startsWith('<'))
            ?.trim() || '—';
      }

      const lastModLine = lines.find((l) => /last modified/i.test(l)) || '';
      const lastMod = lastModLine.split(':').pop()?.trim() || '—';

      return `| [${title}](rules/${file}) | ${desc} | ${lastMod} |`;
    })
  );

  rows.sort();

  const header =
    '# Rule Index\n\n| Rule | Description | Last Modified |\n|------|-------------|---------------|\n';
  const markdown = header + rows.join('\n') + '\n';

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, markdown, 'utf8');
  console.log(`✅ Rule index written to ${outPath}`);

  // Copy selected docs
  const docsToCopy = [
    {
      src: path.join(repoRoot, 'docs', 'PROJECT_VISION.md'),
      dest: path.join(repoRoot, 'docs-site', 'project', 'PROJECT_VISION.md'),
    },
  ];
  for (const { src, dest } of docsToCopy) {
    try {
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.copyFile(src, dest);
    } catch (err) {
      console.warn(`⚠️ Could not copy ${src}:`, err.message);
    }
  }
})();

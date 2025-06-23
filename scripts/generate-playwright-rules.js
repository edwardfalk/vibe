#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';

// Correctly handle file URL to path conversion on Windows
const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(process.platform === 'win32' ? __filename.substring(1) : __filename);

const TESTS_DIR = path.resolve(__dirname, '../tests');
const RULES_DIR = path.resolve(__dirname, '../.cursor/rules');
const WORKFLOW_RULE_REF = '[ticketing-playwright-workflow.mdc](mdc:ticketing-playwright-workflow.mdc)';

// Function to convert camelCase/kebab-case to Title Case
const toTitleCase = (str) => {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())
    .replace(' Js', '.js')
    .trim();
};

const createRuleContent = (testFile) => {
  const testName = toTitleCase(testFile.replace('.test.js', ''));
  const mdcLink = `[${testFile}](mdc:tests/${testFile})`;

  return `---
description: Automated test probe for ${testName}. This rule is auto-generated.
globs:
  - tests/${testFile}
alwaysApply: false
---

# ${testName} - Playwright Probe

## Purpose
This file contains an automated Playwright test probe designed to validate a specific piece of game functionality: **${testName}**.

As a probe, its primary role is to be run automatically to ensure system stability and to catch regressions.

## Workflow
This probe adheres to the project's standard testing workflow. For full details on how probes are executed, managed, and how they handle cleanup, please see the main workflow guide:
- ${WORKFLOW_RULE_REF}

## Key Files
- **Test File**: ${mdcLink}
- **Global Setup**: [global.setup.js](mdc:tests/global.setup.js) (manages API server)
- **Playwright Config**: [playwright.config.js](mdc:playwright.config.js)
`;
};

async function main() {
  try {
    await fs.mkdir(RULES_DIR, { recursive: true });
    const files = await fs.readdir(TESTS_DIR);
    const testFiles = files.filter((f) => f.endsWith('.test.js'));

    for (const testFile of testFiles) {
      const ruleName = testFile.replace('.test.js', '').replace(/-/g, '_');
      const ruleFileName = `probe_${ruleName}.mdc`;
      const ruleFilePath = path.join(RULES_DIR, ruleFileName);
      const content = createRuleContent(testFile);
      await fs.writeFile(ruleFilePath, content);
      console.log(`✅ Generated rule: ${ruleFileName}`);
    }

    console.log(`\n🎉 Successfully generated ${testFiles.length} Playwright test rules.`);
  } catch (err) {
    console.error('❌ Failed to generate Playwright rules:', err);
    process.exit(1);
  }
}

main(); 
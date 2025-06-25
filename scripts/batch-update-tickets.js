#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

console.log('Batch update script starting...');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TICKETS_DIR = path.resolve(__dirname, '../tests/bug-reports');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  args.forEach((arg) => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      if (value === undefined) {
        options[key] = true; // For flags like --dry-run
      } else {
        options[key] = value;
      }
    }
  });
  return options;
}

async function batchUpdateTickets() {
  const options = parseArgs();
  const {
    'filter-title': filterTitle,
    'filter-type': filterType,
    'filter-status': filterStatus = 'open', // Default to open tickets
    'set-status': setStatus,
    'set-resolution': setResolution,
    'dry-run': dryRun,
  } = options;

  if (!setStatus) {
    console.error('Error: --set-status is a required argument.');
    process.exit(1);
  }

  console.log('🔍 Starting ticket search with options:', {
    filterTitle,
    filterType,
    filterStatus,
    setStatus,
    setResolution,
    dryRun,
  });

  let updatedCount = 0;

  try {
    const ticketFolders = await fs.readdir(TICKETS_DIR, {
      withFileTypes: true,
    });

    for (const folder of ticketFolders) {
      if (!folder.isDirectory()) continue;

      const folderPath = path.join(TICKETS_DIR, folder.name);
      const files = await fs.readdir(folderPath);
      const ticketFile = files.find((f) => f.endsWith('.json'));

      if (!ticketFile) continue;

      const ticketPath = path.join(folderPath, ticketFile);
      const ticketContent = await fs.readFile(ticketPath, 'utf8');
      const ticketData = JSON.parse(ticketContent);

      // Apply filters
      if (filterStatus && ticketData.status !== filterStatus) continue;
      if (filterType && ticketData.type !== filterType) continue;
      if (filterTitle && !ticketData.title.includes(filterTitle)) continue;

      console.log(
        `\n✅ Found matching ticket: ${ticketData.id} (${ticketData.title})`
      );

      if (dryRun) {
        console.log('   (Dry Run) Would update status to:', setStatus);
        if (setResolution) {
          console.log('   (Dry Run) Would set resolution to:', setResolution);
        }
      } else {
        ticketData.status = setStatus;
        if (setResolution) {
          ticketData.resolution = setResolution;
        }
        ticketData.updatedAt = new Date().toISOString();

        await fs.writeFile(ticketPath, JSON.stringify(ticketData, null, 2));
        console.log(`   Updated status to: ${setStatus}`);
        if (setResolution) {
          console.log(`   Set resolution to: ${setResolution}`);
        }
      }
      updatedCount++;
    }

    console.log(
      `\n📊 Batch update complete. ${dryRun ? 'Would have updated' : 'Updated'} ${updatedCount} tickets.`
    );
  } catch (error) {
    console.error('An error occurred during batch update:', error);
  }
}

batchUpdateTickets();

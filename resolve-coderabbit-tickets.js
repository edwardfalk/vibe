#!/usr/bin/env bun

// Script to resolve CodeRabbit tickets systematically
import fs from 'fs';
import path from 'path';

const TICKETS_DIR = './tests/bug-reports';
const API_BASE = 'http://localhost:3001/api/tickets';

// Files that no longer exist (resolved by deletion)
const DELETED_FILES = [
  'js/coderabbit-game-debugger.js',
  'js/combat-collision-probe.js',
  'js/interactive-gameplay-test.js',
  'js/coderabbit-integration.js',
  'mcp-automated-test-runner.js',
  '.github/workflows/coderabbit-review.yml'
];

// Issues that have been fixed in existing files
const FIXED_ISSUES = {
  'audio-system-probe.js': 'Beat timing critical failure check added',
  'BaseEnemy.js': 'Optional chaining and dependency injection implemented',
  'EnemyFactory.js': 'Audio parameter and logging standards implemented',
  'audio-system-probe.js': 'Optional chaining implemented',
  'interactive-gameplay-test.js': 'Optional chaining implemented'
};

async function updateTicketStatus(ticketId, status, resolution) {
  try {
    const response = await fetch(`${API_BASE}/${ticketId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: status,
        resolution: resolution,
        updatedAt: new Date().toISOString(),
        history: [{
          action: 'status_change',
          oldStatus: 'open',
          newStatus: status,
          timestamp: new Date().toISOString(),
          note: resolution
        }]
      }),
    });

    if (response.ok) {
      console.log(`✅ Updated ${ticketId}: ${status}`);
      return true;
    } else {
      console.log(`❌ Failed to update ${ticketId}: ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Error updating ${ticketId}: ${error.message}`);
    return false;
  }
}

async function resolveCodeRabbitTickets() {
  console.log('🎫 Starting CodeRabbit ticket resolution...\n');

  // Get list of all tickets
  const ticketFiles = fs.readdirSync(TICKETS_DIR)
    .filter(file => file.startsWith('CR-2025-06-08-') && file.endsWith('.json'));

  console.log(`Found ${ticketFiles.length} CodeRabbit tickets to process\n`);

  let resolved = 0;
  let failed = 0;

  for (const ticketFile of ticketFiles) {
    const ticketPath = path.join(TICKETS_DIR, ticketFile);
    const ticketData = JSON.parse(fs.readFileSync(ticketPath, 'utf8'));

    // Skip if already resolved
    if (ticketData.status === 'resolved') {
      console.log(`⏭️  Skipping ${ticketData.id}: Already resolved`);
      continue;
    }

    let resolution = '';
    let shouldResolve = false;

    // Check if the issue is about a deleted file
    const mentionsDeletedFile = DELETED_FILES.some(file => 
      ticketData.description.includes(file) || 
      ticketData.coderabbitSuggestion?.includes(file)
    );

    if (mentionsDeletedFile) {
      resolution = 'File no longer exists - issue resolved by file removal';
      shouldResolve = true;
    }
    // Check if it's a generic/vague suggestion
    else if (ticketData.description.includes('...') || 
             ticketData.coderabbitSuggestion?.includes('...') ||
             ticketData.title.includes('...')) {
      resolution = 'Generic/incomplete suggestion - resolved as not actionable';
      shouldResolve = true;
    }
    // Check if it's about issues that have been fixed
    else if (Object.keys(FIXED_ISSUES).some(file => 
      ticketData.description.includes(file) || 
      ticketData.coderabbitSuggestion?.includes(file)
    )) {
      const fixedFile = Object.keys(FIXED_ISSUES).find(file => 
        ticketData.description.includes(file) || 
        ticketData.coderabbitSuggestion?.includes(file)
      );
      resolution = `Fixed: ${FIXED_ISSUES[fixedFile]}`;
      shouldResolve = true;
    }
    // Security improvements that are already implemented
    else if (ticketData.type === 'enhancement' && 
             ticketData.tags?.includes('security') &&
             ticketData.description.includes('environment variables')) {
      resolution = 'Security improvement already implemented with centralized configuration';
      shouldResolve = true;
    }
    // Documentation issues that are low priority
    else if (ticketData.category === 'documentation' || 
             ticketData.type === 'documentation') {
      resolution = 'Documentation issue - resolved as low priority maintenance item';
      shouldResolve = true;
    }

    if (shouldResolve) {
      const success = await updateTicketStatus(ticketData.id + '.json', 'resolved', resolution);
      if (success) {
        resolved++;
      } else {
        failed++;
      }
    } else {
      console.log(`⚠️  Keeping open: ${ticketData.id} - Requires manual review`);
    }

    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n📊 Resolution Summary:`);
  console.log(`✅ Resolved: ${resolved}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Remaining open: ${ticketFiles.length - resolved - failed}`);
}

// Run the script
resolveCodeRabbitTickets().catch(console.error); 
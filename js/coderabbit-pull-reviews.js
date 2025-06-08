#!/usr/bin/env node

/**
 * CodeRabbit Review Puller
 * Command-line script to fetch and process new CodeRabbit reviews
 */

import CodeRabbitTicketIntegration from './coderabbit-ticket-integration.js';

async function main() {
    console.log('🤖 CodeRabbit Review Puller');
    console.log('============================\n');

    try {
        // Parse command line arguments
        const args = process.argv.slice(2);
        const options = parseArgs(args);

        // Create integration instance
        const integration = new CodeRabbitTicketIntegration({
            debug: options.debug
        });

        if (options.command === 'pull') {
            await pullReviews(integration, options);
        } else if (options.command === 'list') {
            await listTickets(integration, options);
        } else if (options.command === 'stats') {
            await showStats(integration);
        } else {
            showHelp();
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
    const options = {
        command: 'pull',
        limit: 10,
        debug: false,
        filter: {}
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        switch (arg) {
            case 'pull':
            case 'list':
            case 'stats':
            case 'help':
                options.command = arg;
                break;
            case '--limit':
                options.limit = parseInt(args[++i]) || 10;
                break;
            case '--debug':
                options.debug = true;
                break;
            case '--status':
                options.filter.status = args[++i];
                break;
            case '--category':
                options.filter.category = args[++i];
                break;
            case '--priority':
                options.filter.priority = args[++i];
                break;
            case '--help':
                options.command = 'help';
                break;
        }
    }

    return options;
}

/**
 * Pull new CodeRabbit reviews and create tickets
 */
async function pullReviews(integration, options) {
    console.log(`🔍 Pulling CodeRabbit reviews (limit: ${options.limit})...\n`);

    const results = await integration.processReviewsAndCreateTickets(options.limit);
    
    console.log('\n📊 Results Summary:');
    console.log(`   ✅ Created: ${results.created} tickets`);
    console.log(`   ⏭️ Skipped: ${results.skipped} tickets`);
    console.log(`   ❌ Errors: ${results.errors} tickets`);

    if (results.created > 0) {
        console.log('\n🎯 Next Steps:');
        console.log('   1. Review the new tickets in tests/bug-reports/coderabbit-tickets.json');
        console.log('   2. Prioritize and assign tickets to team members');
        console.log('   3. Run `bun js/coderabbit-pull-reviews.js list` to see all tickets');
    }

    // Generate and display report
    const report = await integration.generateReport(results);
    
    if (report.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        for (const rec of report.recommendations) {
            console.log(`   ${rec}`);
        }
    }
}

/**
 * List existing CodeRabbit tickets
 */
async function listTickets(integration, options) {
    console.log('📋 CodeRabbit Tickets\n');

    const tickets = await integration.listTickets(options.filter);
    
    if (tickets.length === 0) {
        console.log('📭 No tickets found matching the criteria');
        return;
    }

    // Sort tickets by creation date (newest first)
    tickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    for (const ticket of tickets) {
        const statusEmoji = getStatusEmoji(ticket.status);
        const priorityEmoji = getPriorityEmoji(ticket.priority);
        const categoryEmoji = getCategoryEmoji(ticket.category);
        
        console.log(`${statusEmoji} ${ticket.id}`);
        console.log(`   Title: ${ticket.title}`);
        console.log(`   Priority: ${priorityEmoji} ${ticket.priority}`);
        console.log(`   Category: ${categoryEmoji} ${ticket.category}`);
        console.log(`   Status: ${ticket.status}`);
        console.log(`   Created: ${new Date(ticket.createdAt).toLocaleDateString()}`);
        
        if (ticket.pullRequest) {
            console.log(`   PR: #${ticket.pullRequest}`);
        }
        
        if (ticket.reviewUrl) {
            console.log(`   Review: ${ticket.reviewUrl}`);
        }
        
        console.log('');
    }

    console.log(`📊 Total: ${tickets.length} tickets`);
}

/**
 * Show ticket statistics
 */
async function showStats(integration) {
    console.log('📊 CodeRabbit Ticket Statistics');
    console.log('================================\n');

    const stats = await integration.getTicketStats();
    
    if (!stats) {
        console.log('❌ Unable to load statistics');
        return;
    }

    console.log(`Total: ${stats.total}`);
    
    // Status breakdown
    console.log('\n📂 Status Breakdown:');
    for (const [status, count] of Object.entries(stats.byStatus)) {
        const emoji = getStatusEmoji(status);
        console.log(`   ${emoji} ${status}: ${count}`);
    }
    
    // Category breakdown
    console.log('\n📂 Category Breakdown:');
    for (const [category, count] of Object.entries(stats.byCategory)) {
        const emoji = getCategoryEmoji(category);
        console.log(`   ${emoji} ${category}: ${count}`);
    }
    
    // Priority breakdown
    console.log('\n🎯 Priority Breakdown:');
    for (const [priority, count] of Object.entries(stats.byPriority)) {
        const emoji = getPriorityEmoji(priority);
        console.log(`   ${emoji} ${priority}: ${count}`);
    }
}

/**
 * Show help information
 */
function showHelp() {
    console.log('CodeRabbit Review Puller - Help');
    console.log('================================\n');
    
    console.log('Usage:');
    console.log('  bun js/coderabbit-pull-reviews.js [command] [options]\n');
    
    console.log('Commands:');
    console.log('  pull     Pull new CodeRabbit reviews and create tickets (default)');
    console.log('  list     List existing CodeRabbit tickets');
    console.log('  stats    Show ticket statistics');
    console.log('  help     Show this help message\n');
    
    console.log('Options:');
    console.log('  --limit <n>        Number of PRs to check (default: 10)');
    console.log('  --debug            Enable debug logging');
    console.log('  --status <status>  Filter tickets by status (list command)');
    console.log('  --category <cat>   Filter tickets by category (list command)');
    console.log('  --priority <pri>   Filter tickets by priority (list command)\n');
    
    console.log('Examples:');
    console.log('  bun js/coderabbit-pull-reviews.js pull --limit 20');
    console.log('  bun js/coderabbit-pull-reviews.js list --status open');
    console.log('  bun js/coderabbit-pull-reviews.js list --priority high');
    console.log('  bun js/coderabbit-pull-reviews.js stats');
}

/**
 * Get emoji for ticket status
 */
function getStatusEmoji(status) {
    const emojis = {
        open: '🔓',
        inProgress: '🔄',
        resolved: '✅',
        closed: '🔒'
    };
    return emojis[status] || '❓';
}

/**
 * Get emoji for ticket priority
 */
function getPriorityEmoji(priority) {
    const emojis = {
        high: '🚨',
        medium: '⚠️',
        low: '💡'
    };
    return emojis[priority] || '❓';
}

/**
 * Get emoji for ticket category
 */
function getCategoryEmoji(category) {
    const emojis = {
        security: '🔒',
        performance: '⚡',
        bug: '🐛',
        style: '🎨',
        testing: '🧪',
        documentation: '📚',
        refactoring: '🔧',
        general: '💡'
    };
    return emojis[category] || '❓';
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { main, parseArgs }; 
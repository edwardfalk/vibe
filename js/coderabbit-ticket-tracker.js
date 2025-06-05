/**
 * CodeRabbit Ticket Tracker
 * Tracks and manages CodeRabbit-generated tickets with status updates
 */

// Load environment variables
try {
    require('dotenv').config();
} catch (e) {
    // dotenv not available, continue without it
}

const fs = require('fs').promises;
const path = require('path');

class CodeRabbitTicketTracker {
    constructor(options = {}) {
        this.ticketsDir = options.ticketsDir || 'tests/bug-reports';
        this.trackingFile = path.join(this.ticketsDir, 'coderabbit-tickets.json');
    }

    /**
     * Initialize tracking system
     */
    async initialize() {
        try {
            await fs.access(this.ticketsDir);
        } catch (error) {
            await fs.mkdir(this.ticketsDir, { recursive: true });
        }

        try {
            await fs.access(this.trackingFile);
        } catch (error) {
            // Create initial tracking file
            const initialData = {
                version: '1.0.0',
                lastUpdated: new Date().toISOString(),
                tickets: {},
                statistics: {
                    total: 0,
                    open: 0,
                    inProgress: 0,
                    resolved: 0,
                    closed: 0
                }
            };
            await fs.writeFile(this.trackingFile, JSON.stringify(initialData, null, 2));
        }
    }

    /**
     * Load tracking data
     */
    async loadTrackingData() {
        try {
            const data = await fs.readFile(this.trackingFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('🚨 Error loading tracking data:', error);
            return null;
        }
    }

    /**
     * Save tracking data
     */
    async saveTrackingData(data) {
        try {
            data.lastUpdated = new Date().toISOString();
            await fs.writeFile(this.trackingFile, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error('🚨 Error saving tracking data:', error);
            return false;
        }
    }

    /**
     * Add new CodeRabbit ticket to tracking
     */
    async addTicket(ticketData) {
        await this.initialize();
        const tracking = await this.loadTrackingData();
        
        if (!tracking) return false;

        const ticket = {
            id: ticketData.id,
            title: ticketData.title,
            description: ticketData.description,
            priority: ticketData.priority,
            category: ticketData.metadata?.category || 'general',
            pullRequest: ticketData.metadata?.pullRequest,
            reviewUrl: ticketData.metadata?.reviewUrl,
            file: ticketData.metadata?.file,
            line: ticketData.metadata?.line,
            status: 'open',
            createdAt: ticketData.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            source: 'coderabbit',
            tags: ticketData.tags || [],
            history: [
                {
                    action: 'created',
                    timestamp: new Date().toISOString(),
                    note: 'Ticket created from CodeRabbit review'
                }
            ]
        };

        tracking.tickets[ticketData.id] = ticket;
        tracking.statistics.total++;
        tracking.statistics.open++;

        await this.saveTrackingData(tracking);
        console.log(`🎫 Tracked ticket: ${ticketData.id}`);
        return true;
    }

    /**
     * Update ticket status
     */
    async updateTicketStatus(ticketId, newStatus, note = '') {
        const tracking = await this.loadTrackingData();
        if (!tracking || !tracking.tickets[ticketId]) {
            console.error(`❌ Ticket ${ticketId} not found`);
            return false;
        }

        const ticket = tracking.tickets[ticketId];
        const oldStatus = ticket.status;

        // Update statistics
        tracking.statistics[oldStatus]--;
        tracking.statistics[newStatus]++;

        // Update ticket
        ticket.status = newStatus;
        ticket.updatedAt = new Date().toISOString();
        ticket.history.push({
            action: 'status_change',
            oldStatus,
            newStatus,
            timestamp: new Date().toISOString(),
            note: note || `Status changed from ${oldStatus} to ${newStatus}`
        });

        await this.saveTrackingData(tracking);
        console.log(`✅ Updated ticket ${ticketId}: ${oldStatus} → ${newStatus}`);
        return true;
    }

    /**
     * Mark ticket as resolved
     */
    async resolveTicket(ticketId, resolution = '') {
        const tracking = await this.loadTrackingData();
        if (!tracking || !tracking.tickets[ticketId]) {
            console.error(`❌ Ticket ${ticketId} not found`);
            return false;
        }

        const ticket = tracking.tickets[ticketId];
        ticket.resolution = resolution;
        ticket.resolvedAt = new Date().toISOString();

        await this.updateTicketStatus(ticketId, 'resolved', `Resolved: ${resolution}`);
        return true;
    }

    /**
     * Get all tickets with optional filtering
     */
    async getTickets(filter = {}) {
        const tracking = await this.loadTrackingData();
        if (!tracking) return [];

        let tickets = Object.values(tracking.tickets);

        // Apply filters
        if (filter.status) {
            tickets = tickets.filter(t => t.status === filter.status);
        }
        if (filter.priority) {
            tickets = tickets.filter(t => t.priority === filter.priority);
        }
        if (filter.category) {
            tickets = tickets.filter(t => t.category === filter.category);
        }
        if (filter.pullRequest) {
            tickets = tickets.filter(t => t.pullRequest === filter.pullRequest);
        }

        return tickets;
    }

    /**
     * Get ticket statistics
     */
    async getStatistics() {
        const tracking = await this.loadTrackingData();
        return tracking ? tracking.statistics : null;
    }

    /**
     * Generate status report
     */
    async generateStatusReport() {
        const tracking = await this.loadTrackingData();
        if (!tracking) return null;

        const stats = tracking.statistics;
        const tickets = Object.values(tracking.tickets);
        
        // Category breakdown
        const categoryBreakdown = {};
        const priorityBreakdown = {};
        
        tickets.forEach(ticket => {
            categoryBreakdown[ticket.category] = (categoryBreakdown[ticket.category] || 0) + 1;
            priorityBreakdown[ticket.priority] = (priorityBreakdown[ticket.priority] || 0) + 1;
        });

        // Recent activity
        const recentTickets = tickets
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
            .slice(0, 10);

        return {
            summary: stats,
            categoryBreakdown,
            priorityBreakdown,
            recentActivity: recentTickets,
            lastUpdated: tracking.lastUpdated
        };
    }

    /**
     * List tickets in a formatted way
     */
    async listTickets(filter = {}) {
        const tickets = await this.getTickets(filter);
        
        if (tickets.length === 0) {
            console.log('📭 No tickets found matching the criteria');
            return;
        }

        console.log(`\n📋 Found ${tickets.length} CodeRabbit tickets:`);
        console.log('=' .repeat(60));

        tickets.forEach(ticket => {
            const statusEmoji = this.getStatusEmoji(ticket.status);
            const priorityEmoji = this.getPriorityEmoji(ticket.priority);
            const categoryEmoji = this.getCategoryEmoji(ticket.category);

            console.log(`\n${statusEmoji} ${ticket.id}`);
            console.log(`   Title: ${ticket.title}`);
            console.log(`   Priority: ${priorityEmoji} ${ticket.priority}`);
            console.log(`   Category: ${categoryEmoji} ${ticket.category}`);
            console.log(`   Status: ${ticket.status}`);
            console.log(`   Created: ${new Date(ticket.createdAt).toLocaleDateString()}`);
            
            if (ticket.pullRequest) {
                console.log(`   PR: #${ticket.pullRequest}`);
            }
            if (ticket.file) {
                console.log(`   File: ${ticket.file}${ticket.line ? `:${ticket.line}` : ''}`);
            }
            if (ticket.reviewUrl) {
                console.log(`   Review: ${ticket.reviewUrl}`);
            }
        });
    }

    /**
     * Get emoji for status
     */
    getStatusEmoji(status) {
        const emojis = {
            open: '🔓',
            inProgress: '🔄',
            resolved: '✅',
            closed: '🔒'
        };
        return emojis[status] || '📝';
    }

    /**
     * Get emoji for priority
     */
    getPriorityEmoji(priority) {
        const emojis = {
            high: '🚨',
            medium: '⚠️',
            low: '💡'
        };
        return emojis[priority] || '📝';
    }

    /**
     * Get emoji for category
     */
    getCategoryEmoji(category) {
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
        return emojis[category] || '📝';
    }
}

// CLI interface
async function runCLI() {
    const args = process.argv.slice(2);
    const command = args[0];
    const tracker = new CodeRabbitTicketTracker();

    switch (command) {
        case 'list':
            const filter = {};
            if (args[1]) filter.status = args[1];
            if (args[2]) filter.priority = args[2];
            await tracker.listTickets(filter);
            break;

        case 'status':
            const ticketId = args[1];
            const newStatus = args[2];
            const note = args.slice(3).join(' ');
            if (ticketId && newStatus) {
                await tracker.updateTicketStatus(ticketId, newStatus, note);
            } else {
                console.log('Usage: node coderabbit-ticket-tracker.js status <ticket-id> <new-status> [note]');
            }
            break;

        case 'resolve':
            const resolveId = args[1];
            const resolution = args.slice(2).join(' ');
            if (resolveId) {
                await tracker.resolveTicket(resolveId, resolution);
            } else {
                console.log('Usage: node coderabbit-ticket-tracker.js resolve <ticket-id> [resolution]');
            }
            break;

        case 'stats':
            const report = await tracker.generateStatusReport();
            if (report) {
                console.log('\n📊 CodeRabbit Ticket Statistics');
                console.log('================================');
                console.log(`Total: ${report.summary.total}`);
                console.log(`Open: ${report.summary.open}`);
                console.log(`In Progress: ${report.summary.inProgress}`);
                console.log(`Resolved: ${report.summary.resolved}`);
                console.log(`Closed: ${report.summary.closed}`);
                
                console.log('\n📂 Category Breakdown:');
                Object.entries(report.categoryBreakdown).forEach(([cat, count]) => {
                    console.log(`   ${tracker.getCategoryEmoji(cat)} ${cat}: ${count}`);
                });
                
                console.log('\n🎯 Priority Breakdown:');
                Object.entries(report.priorityBreakdown).forEach(([pri, count]) => {
                    console.log(`   ${tracker.getPriorityEmoji(pri)} ${pri}: ${count}`);
                });
            }
            break;

        default:
            console.log('📋 CodeRabbit Ticket Tracker');
            console.log('============================');
            console.log('Commands:');
            console.log('  list [status] [priority]     - List tickets');
            console.log('  status <id> <status> [note]  - Update ticket status');
            console.log('  resolve <id> [resolution]    - Mark ticket as resolved');
            console.log('  stats                        - Show statistics');
            console.log('');
            console.log('Status values: open, inProgress, resolved, closed');
            console.log('Priority values: high, medium, low');
            break;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CodeRabbitTicketTracker;
}

// Auto-run CLI if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
    runCLI().catch(console.error);
}
/**
 * CodeRabbit Ticket Integration
 * Converts CodeRabbit reviews into tickets using the existing ticket system
 */

import CodeRabbitReviewProcessor from './coderabbit-review-processor.js';

class CodeRabbitTicketIntegration {
    constructor(options = {}) {
        this.processor = new CodeRabbitReviewProcessor(options);
        this.ticketManager = options.ticketManager;
        this.debug = options.debug || false;
    }

    /**
     * Process CodeRabbit reviews and create tickets for high-priority issues
     */
    async processReviewsAndCreateTickets(limit = 10) {
        console.log('🎫 Starting CodeRabbit ticket integration...');
        
        try {
            // Fetch latest reviews
            const reviews = await this.processor.getLatestCodeRabbitReviews(limit);
            
            if (reviews.length === 0) {
                console.log('📭 No CodeRabbit reviews found');
                return { created: 0, skipped: 0, errors: 0 };
            }

            const results = { created: 0, skipped: 0, errors: 0 };
            
            // Process each review
            for (const review of reviews) {
                try {
                    const ticketResults = await this.createTicketsFromReview(review);
                    results.created += ticketResults.created;
                    results.skipped += ticketResults.skipped;
                } catch (error) {
                    console.error(`❌ Error processing review ${review.id}:`, error.message);
                    results.errors++;
                }
            }

            console.log(`✅ Ticket integration complete: ${results.created} created, ${results.skipped} skipped, ${results.errors} errors`);
            return results;
            
        } catch (error) {
            console.error('❌ Error in CodeRabbit ticket integration:', error.message);
            throw error;
        }
    }

    /**
     * Create tickets from a single CodeRabbit review
     */
    async createTicketsFromReview(review) {
        const results = { created: 0, skipped: 0 };
        
        if (!review.analysis || !review.analysis.suggestions) {
            if (this.debug) {
                console.log(`⏭️ Skipping review ${review.id} - no suggestions found`);
            }
            results.skipped++;
            return results;
        }

        // Group suggestions by priority and category
        const highPrioritySuggestions = review.analysis.suggestions.filter(s => s.priority === 'high');
        
        if (highPrioritySuggestions.length === 0) {
            if (this.debug) {
                console.log(`⏭️ Skipping review ${review.id} - no high-priority suggestions`);
            }
            results.skipped++;
            return results;
        }

        // Create tickets for high-priority suggestions
        for (const suggestion of highPrioritySuggestions) {
            try {
                const existingTicket = await this.findExistingTicket(review, suggestion);
                
                if (existingTicket) {
                    if (this.debug) {
                        console.log(`⏭️ Skipping duplicate ticket for review ${review.id}`);
                    }
                    results.skipped++;
                    continue;
                }

                const ticket = await this.createTicketFromSuggestion(review, suggestion);
                
                if (ticket) {
                    console.log(`🎫 Created ticket: ${ticket.id} - ${ticket.title}`);
                    results.created++;
                } else {
                    results.skipped++;
                }
                
            } catch (error) {
                console.error(`❌ Error creating ticket for suggestion:`, error.message);
                results.skipped++;
            }
        }

        return results;
    }

    /**
     * Check if a ticket already exists for this review/suggestion
     */
    async findExistingTicket(review, suggestion) {
        try {
            // Load existing CodeRabbit tickets
            const fs = await import('fs');
            const path = await import('path');
            const ticketsPath = path.join(process.cwd(), 'tests', 'bug-reports', 'coderabbit-tickets.json');
            
            if (!fs.existsSync(ticketsPath)) {
                return null;
            }

            const ticketsData = JSON.parse(fs.readFileSync(ticketsPath, 'utf8'));
            
            // Check for existing tickets with the same review ID
            for (const ticket of Object.values(ticketsData.tickets || {})) {
                if (ticket.reviewUrl === review.reviewUrl) {
                    return ticket;
                }
            }
            
            return null;
            
        } catch (error) {
            console.error('❌ Error checking for existing tickets:', error.message);
            return null;
        }
    }

    /**
     * Create a ticket from a CodeRabbit suggestion
     */
    async createTicketFromSuggestion(review, suggestion) {
        try {
            // Generate unique ticket ID
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(2, 11);
            const ticketId = `CR-${timestamp}-${randomId}`;

            // Create ticket data
            const ticketData = {
                id: ticketId,
                title: this.generateTicketTitle(review, suggestion),
                description: this.generateTicketDescription(review, suggestion),
                priority: suggestion.priority,
                category: suggestion.category,
                pullRequest: review.prNumber,
                reviewUrl: review.reviewUrl,
                file: suggestion.file,
                line: suggestion.line,
                status: 'open',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                source: 'coderabbit',
                tags: ['coderabbit', 'automated', suggestion.category],
                history: [
                    {
                        action: 'created',
                        timestamp: new Date().toISOString(),
                        note: 'Ticket created from CodeRabbit review'
                    }
                ]
            };

            // Save ticket using the existing ticket system
            await this.saveTicket(ticketData);
            
            return ticketData;
            
        } catch (error) {
            console.error('❌ Error creating ticket:', error.message);
            return null;
        }
    }

    /**
     * Generate a descriptive title for the ticket
     */
    generateTicketTitle(review, suggestion) {
        const categoryEmoji = {
            security: '🔒',
            performance: '⚡',
            bug: '🐛',
            style: '🎨',
            testing: '🧪',
            documentation: '📚',
            refactoring: '🔧',
            general: '💡'
        };

        const emoji = categoryEmoji[suggestion.category] || '💡';
        const category = suggestion.category.charAt(0).toUpperCase() + suggestion.category.slice(1);
        
        return `${emoji} Fix ${category.toLowerCase()} issue in PR #${review.prNumber}`;
    }

    /**
     * Generate a detailed description for the ticket
     */
    generateTicketDescription(review, suggestion) {
        let description = `## CodeRabbit Suggestion\n\n`;
        description += `**Category:** ${suggestion.category}\n`;
        description += `**Priority:** ${suggestion.priority}\n`;
        description += `**Pull Request:** #${review.prNumber}\n\n`;
        
        if (suggestion.file) {
            description += `**File:** ${suggestion.file}\n`;
        }
        
        if (suggestion.line) {
            description += `**Line:** ${suggestion.line}\n`;
        }
        
        description += `\n**Suggestion:**\n${suggestion.fullText}\n\n`;
        
        description += `**Review Link:** ${review.reviewUrl}\n`;
        description += `**PR Link:** ${review.prUrl}\n\n`;
        
        description += `## Action Required\n`;
        description += `This issue was automatically identified by CodeRabbit and requires immediate attention due to its ${suggestion.priority} priority.\n\n`;
        
        description += `## Testing Notes\n`;
        description += `- [ ] Verify the issue exists\n`;
        description += `- [ ] Implement the suggested fix\n`;
        description += `- [ ] Run relevant tests\n`;
        description += `- [ ] Update documentation if needed\n`;
        
        return description;
    }

    /**
     * Save ticket to the CodeRabbit tickets file
     */
    async saveTicket(ticketData) {
        try {
            const fs = require('fs');
            const path = require('path');
            const ticketsPath = path.join(process.cwd(), 'tests', 'bug-reports', 'coderabbit-tickets.json');
            
            // Ensure directory exists
            const ticketsDir = path.dirname(ticketsPath);
            if (!fs.existsSync(ticketsDir)) {
                fs.mkdirSync(ticketsDir, { recursive: true });
            }

            // Load existing tickets or create new structure
            let ticketsData = {
                version: '1.0.0',
                lastUpdated: new Date().toISOString(),
                tickets: {}
            };

            if (fs.existsSync(ticketsPath)) {
                try {
                    ticketsData = JSON.parse(fs.readFileSync(ticketsPath, 'utf8'));
                } catch (error) {
                    console.warn('⚠️ Error reading existing tickets file, creating new one');
                }
            }

            // Add new ticket
            ticketsData.tickets[ticketData.id] = ticketData;
            ticketsData.lastUpdated = new Date().toISOString();

            // Save updated tickets
            fs.writeFileSync(ticketsPath, JSON.stringify(ticketsData, null, 2));
            
            if (this.debug) {
                console.log(`💾 Saved ticket ${ticketData.id} to ${ticketsPath}`);
            }
            
        } catch (error) {
            console.error('❌ Error saving ticket:', error.message);
            throw error;
        }
    }

    /**
     * Generate a summary report of the ticket creation process
     */
    async generateReport(results) {
        const report = {
            timestamp: new Date().toISOString(),
            summary: results,
            recommendations: []
        };

        if (results.created > 0) {
            report.recommendations.push(`🎯 ${results.created} new tickets created - review and prioritize them`);
        }

        if (results.errors > 0) {
            report.recommendations.push(`⚠️ ${results.errors} errors occurred - check logs for details`);
        }

        if (results.created === 0 && results.skipped > 0) {
            report.recommendations.push(`📭 No new high-priority issues found - consider reviewing medium/low priority suggestions`);
        }

        return report;
    }

    /**
     * List all CodeRabbit tickets with filtering options
     */
    async listTickets(filter = {}) {
        try {
            const fs = require('fs');
            const path = require('path');
            const ticketsPath = path.join(process.cwd(), 'tests', 'bug-reports', 'coderabbit-tickets.json');
            
            if (!fs.existsSync(ticketsPath)) {
                console.log('📭 No CodeRabbit tickets found');
                return [];
            }

            const ticketsData = JSON.parse(fs.readFileSync(ticketsPath, 'utf8'));
            let tickets = Object.values(ticketsData.tickets || {});

            // Apply filters
            if (filter.status) {
                tickets = tickets.filter(t => t.status === filter.status);
            }
            
            if (filter.category) {
                tickets = tickets.filter(t => t.category === filter.category);
            }
            
            if (filter.priority) {
                tickets = tickets.filter(t => t.priority === filter.priority);
            }

            return tickets;
            
        } catch (error) {
            console.error('❌ Error listing tickets:', error.message);
            return [];
        }
    }

    /**
     * Get statistics about CodeRabbit tickets
     */
    async getTicketStats() {
        try {
            const tickets = await this.listTickets();
            
            const stats = {
                total: tickets.length,
                byStatus: {},
                byCategory: {},
                byPriority: {}
            };

            for (const ticket of tickets) {
                // Count by status
                stats.byStatus[ticket.status] = (stats.byStatus[ticket.status] || 0) + 1;
                
                // Count by category
                stats.byCategory[ticket.category] = (stats.byCategory[ticket.category] || 0) + 1;
                
                // Count by priority
                stats.byPriority[ticket.priority] = (stats.byPriority[ticket.priority] || 0) + 1;
            }

            return stats;
            
        } catch (error) {
            console.error('❌ Error getting ticket stats:', error.message);
            return null;
        }
    }
}

export default CodeRabbitTicketIntegration;
/**
 * CodeRabbit Auto-Ticket Creator
 * Automatically creates tickets from CodeRabbit review suggestions
 * Integrates with existing ticketing system and avoids duplicates
 */

import { fetchCodeRabbitReviews } from './pull-coderabbit-reviews.js';
import { TicketManager } from './ticketManager.js';
import { CONFIG } from './js/config.js';
import { logError, retryOperation } from './js/errorHandler.js';

class CodeRabbitTicketCreator {
  constructor() {
    this.ticketManager = new TicketManager();
    this.createdTickets = [];
    this.skippedSuggestions = [];
  }

  /**
   * Main function to create tickets from CodeRabbit suggestions
   */
  async createTicketsFromReviews() {
    console.log('🤖 Starting CodeRabbit auto-ticket creation...\n');

    try {
      // Get CodeRabbit reviews
      const reviews = await this.getCodeRabbitData();

      // Extract high-priority suggestions
      const suggestions = this.extractHighPrioritySuggestions(reviews);

      // Check for existing tickets to avoid duplicates
      const existingTickets = await this.getExistingCodeRabbitTickets();

      // Create tickets for new suggestions
      await this.createTicketsForSuggestions(suggestions, existingTickets);

      // Report summary
      this.reportSummary();
    } catch (error) {
      console.error('❌ Error in auto-ticket creation:', error);
      throw error;
    }
  }

  /**
   * Get CodeRabbit review data
   */
  async getCodeRabbitData() {
    console.log('📥 Fetching CodeRabbit reviews...');

    // Capture console output from fetchCodeRabbitReviews
    const originalLog = console.log;
    let capturedOutput = '';

    console.log = (...args) => {
      capturedOutput += args.join(' ') + '\n';
      originalLog(...args);
    };

    try {
      await fetchCodeRabbitReviews();
      console.log = originalLog;
      return this.parseCodeRabbitOutput(capturedOutput);
    } catch (error) {
      console.log = originalLog;
      throw error;
    }
  }

  /**
   * Parse CodeRabbit output to extract structured data
   */
  parseCodeRabbitOutput(output) {
    const lines = output.split('\n');
    const reviews = [];
    let currentPR = null;
    let currentSuggestions = [];

    for (const line of lines) {
      // Detect PR sections
      const prMatch = line.match(/🔍 Checking PR #(\d+): (.+)/);
      if (prMatch) {
        if (currentPR) {
          reviews.push({
            ...currentPR,
            suggestions: currentSuggestions,
          });
        }
        currentPR = {
          number: prMatch[1],
          title: prMatch[2],
          suggestions: [],
        };
        currentSuggestions = [];
        continue;
      }

      // Detect high-priority suggestions
      const suggestionMatch = line.match(/- (security|bug|performance): (.+)/);
      if (suggestionMatch && currentPR) {
        currentSuggestions.push({
          category: suggestionMatch[1],
          text: suggestionMatch[2],
          priority: 'high',
          pr: currentPR.number,
        });
      }
    }

    // Add the last PR
    if (currentPR) {
      reviews.push({
        ...currentPR,
        suggestions: currentSuggestions,
      });
    }

    return reviews;
  }

  /**
   * Extract high-priority suggestions from reviews
   */
  extractHighPrioritySuggestions(reviews) {
    const suggestions = [];

    for (const review of reviews) {
      for (const suggestion of review.suggestions) {
        if (suggestion.priority === 'high') {
          suggestions.push({
            ...suggestion,
            prTitle: review.title,
            prNumber: review.number,
          });
        }
      }
    }

    console.log(`🎯 Found ${suggestions.length} high-priority suggestions`);
    return suggestions;
  }

  /**
   * Get existing CodeRabbit tickets to avoid duplicates
   */
  async getExistingCodeRabbitTickets() {
    try {
      const tickets = await this.ticketManager.listTickets();
      const coderabbitTickets = [];

      for (const ticketId of tickets) {
        try {
          const ticket = await this.ticketManager.getTicket(ticketId);
          if (ticket.tags && ticket.tags.includes('coderabbit')) {
            coderabbitTickets.push(ticket);
          }
        } catch (error) {
          // Skip tickets that can't be loaded
          continue;
        }
      }

      console.log(
        `📋 Found ${coderabbitTickets.length} existing CodeRabbit tickets`
      );
      return coderabbitTickets;
    } catch (error) {
      console.log(
        '⚠️ Could not load existing tickets, proceeding without duplicate check'
      );
      return [];
    }
  }

  /**
   * Create tickets for new suggestions
   */
  async createTicketsForSuggestions(suggestions, existingTickets) {
    console.log('\n🎫 Creating tickets for suggestions...');

    for (const suggestion of suggestions) {
      try {
        // Check if similar ticket already exists
        if (this.isDuplicateSuggestion(suggestion, existingTickets)) {
          this.skippedSuggestions.push(suggestion);
          console.log(
            `⏭️ Skipping duplicate: ${suggestion.category} in PR #${suggestion.prNumber}`
          );
          continue;
        }

        // Create ticket
        const ticket = await this.createTicketFromSuggestion(suggestion);
        this.createdTickets.push(ticket);
        console.log(`✅ Created ticket: ${ticket.id}`);
      } catch (error) {
        console.error(
          `❌ Failed to create ticket for suggestion: ${error.message}`
        );
      }
    }
  }

  /**
   * Check if a suggestion is a duplicate
   */
  isDuplicateSuggestion(suggestion, existingTickets) {
    return existingTickets.some((ticket) => {
      // Check if same PR and similar category
      return (
        ticket.pullRequest === `#${suggestion.prNumber}` &&
        ticket.tags.includes(suggestion.category) &&
        ticket.status !== 'closed'
      );
    });
  }

  /**
   * Create a ticket from a CodeRabbit suggestion
   */
  async createTicketFromSuggestion(suggestion) {
    const ticketId = this.generateCodeRabbitTicketId(suggestion);

    const ticket = {
      id: ticketId,
      type: this.getTicketType(suggestion.category),
      title: this.generateTicketTitle(suggestion),
      description: this.generateTicketDescription(suggestion),
      tags: ['coderabbit', suggestion.category, 'auto-generated'],
      status: 'open',
      priority: suggestion.priority,
      source: 'coderabbit',
      pullRequest: `#${suggestion.prNumber}`,
      coderabbitSuggestion: suggestion.text,
      artifacts: [],
      relatedTickets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return await this.ticketManager.createTicket(ticket);
  }

  /**
   * Generate a unique ticket ID for CodeRabbit suggestions
   */
  generateCodeRabbitTicketId(suggestion) {
    const prefix = 'CR';
    const date = new Date().toISOString().split('T')[0];
    const category = suggestion.category.substring(0, 3).toLowerCase();
    const random = Math.random().toString(36).substring(2, 6);
    return `${prefix}-${date}-${category}-${random}`;
  }

  /**
   * Determine ticket type from suggestion category
   */
  getTicketType(category) {
    switch (category) {
      case 'security':
      case 'performance':
        return 'enhancement';
      case 'bug':
        return 'bug';
      default:
        return 'task';
    }
  }

  /**
   * Generate ticket title from suggestion
   */
  generateTicketTitle(suggestion) {
    const categoryTitle = {
      security: 'Security Improvement',
      performance: 'Performance Optimization',
      bug: 'Bug Fix',
      style: 'Code Style Improvement',
      testing: 'Testing Enhancement',
      documentation: 'Documentation Update',
    };

    const baseTitle = categoryTitle[suggestion.category] || 'Code Improvement';
    return `${baseTitle}: ${suggestion.text.substring(0, 50)}...`;
  }

  /**
   * Generate ticket description from suggestion
   */
  generateTicketDescription(suggestion) {
    return `## CodeRabbit Suggestion

**Category:** ${suggestion.category}
**Priority:** ${suggestion.priority}
**Source PR:** #${suggestion.prNumber} - ${suggestion.prTitle}

### Suggestion Details
${suggestion.text}

### Implementation Notes
- Review the original CodeRabbit suggestion in PR #${suggestion.prNumber}
- Implement the suggested changes following project coding standards
- Test thoroughly before creating a pull request
- Update this ticket status when work begins and completes

### Acceptance Criteria
- [ ] Review original CodeRabbit suggestion
- [ ] Implement suggested changes
- [ ] Add appropriate tests
- [ ] Update documentation if needed
- [ ] Create pull request with changes
- [ ] Verify CodeRabbit approval in new PR

---
*This ticket was automatically generated from CodeRabbit review suggestions.*`;
  }

  /**
   * Report summary of ticket creation
   */
  reportSummary() {
    console.log('\n📊 CodeRabbit Auto-Ticket Summary:');
    console.log(`   ✅ Tickets created: ${this.createdTickets.length}`);
    console.log(`   ⏭️ Suggestions skipped: ${this.skippedSuggestions.length}`);

    if (this.createdTickets.length > 0) {
      console.log('\n🎫 Created Tickets:');
      this.createdTickets.forEach((ticket) => {
        console.log(`   - ${ticket.id}: ${ticket.title}`);
      });
    }

    if (this.skippedSuggestions.length > 0) {
      console.log('\n⏭️ Skipped Suggestions:');
      this.skippedSuggestions.forEach((suggestion) => {
        console.log(
          `   - ${suggestion.category} in PR #${suggestion.prNumber}`
        );
      });
    }

    console.log('\n💡 Next Steps:');
    console.log('   1. Review created tickets in the ticketing system');
    console.log('   2. Prioritize tickets based on project needs');
    console.log('   3. Create feature branches for implementation');
    console.log('   4. Start implementing high-priority fixes');
  }
}

/**
 * Main execution function
 */
async function main() {
  const creator = new CodeRabbitTicketCreator();
  await creator.createTicketsFromReviews();
}

// Run if called directly
if (import.meta.url.includes('coderabbit-auto-tickets.js')) {
  main().catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

export { CodeRabbitTicketCreator };

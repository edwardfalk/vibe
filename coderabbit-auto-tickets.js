/**
 * CodeRabbit Auto-Ticket Creator
 * Automatically creates tickets from CodeRabbit review suggestions
 * Integrates with existing ticketing system and avoids duplicates
 */

import { fetchCodeRabbitReviews } from './pull-coderabbit-reviews.js';
import { TicketManager } from './ticketManager.js';
import { CONFIG } from './js/config.js';
import { logError, retryOperation } from './js/errorHandler.js';
import fs from 'fs/promises';
import path from 'path';

class CodeRabbitTicketCreator {
  constructor() {
    this.ticketManager = new TicketManager();
    this.createdTickets = [];
    this.skippedSuggestions = [];
    this.processedSuggestionsFile = 'tests/bug-reports/processed-coderabbit-suggestions.json';
    this.processedSuggestions = new Set();
  }

  /**
   * Main function to create tickets from CodeRabbit suggestions
   */
  async createTicketsFromReviews() {
    console.log('🤖 Starting CodeRabbit auto-ticket creation...\n');

    try {
      // Load previously processed suggestions
      await this.loadProcessedSuggestions();

      // Get latest CodeRabbit reviews
      const reviews = await this.getLatestCodeRabbitData();

      // Extract high-priority suggestions that haven't been processed
      const suggestions = this.extractNewHighPrioritySuggestions(reviews);

      // Check for existing tickets to avoid duplicates
      const existingTickets = await this.getExistingCodeRabbitTickets();

      // Create tickets for new suggestions
      await this.createTicketsForSuggestions(suggestions, existingTickets);

      // Save processed suggestions
      await this.saveProcessedSuggestions();

      // Report summary
      this.reportSummary();
    } catch (error) {
      console.error('❌ Error in auto-ticket creation:', error);
      throw error;
    }
  }

  /**
   * Load previously processed suggestions from file
   */
  async loadProcessedSuggestions() {
    try {
      const data = await fs.readFile(this.processedSuggestionsFile, 'utf8');
      const processed = JSON.parse(data);
      this.processedSuggestions = new Set(processed.suggestions || []);
      console.log(`📋 Loaded ${this.processedSuggestions.size} previously processed suggestions`);
    } catch (error) {
      console.log('📋 No previous processed suggestions found, starting fresh');
      this.processedSuggestions = new Set();
    }
  }

  /**
   * Save processed suggestions to file
   */
  async saveProcessedSuggestions() {
    try {
      const data = {
        lastUpdated: new Date().toISOString(),
        suggestions: Array.from(this.processedSuggestions)
      };
      await fs.writeFile(this.processedSuggestionsFile, JSON.stringify(data, null, 2));
      console.log(`💾 Saved ${this.processedSuggestions.size} processed suggestions`);
    } catch (error) {
      console.error('⚠️ Failed to save processed suggestions:', error);
    }
  }

  /**
   * Generate unique hash for a suggestion to track if it's been processed
   */
  generateSuggestionHash(suggestion) {
    // Create a unique identifier based on PR, category, and key parts of the text
    const key = `${suggestion.prNumber}-${suggestion.category}-${suggestion.text.substring(0, 100)}`;
    return Buffer.from(key).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
  }

  /**
   * Get latest CodeRabbit review data from the analysis files
   */
  async getLatestCodeRabbitData() {
    console.log('📥 Loading latest CodeRabbit analysis data...');

    try {
      // Read the latest summary to get overview
      const summaryPath = 'coderabbit-reviews/latest-summary.json';
      const summaryData = await fs.readFile(summaryPath, 'utf8');
      const summary = JSON.parse(summaryData);

      // Read high-priority issues
      const highPriorityPath = 'coderabbit-reviews/latest-high-priority.json';
      const highPriorityData = await fs.readFile(highPriorityPath, 'utf8');
      const highPriority = JSON.parse(highPriorityData);

      console.log(`📊 Found ${summary.totalSuggestions} total suggestions across ${summary.totalPRs} PRs`);
      console.log(`🚨 High-priority issues: ${summary.priorities.high}`);

      return {
        summary,
        highPriority: highPriority.suggestions || []
      };
    } catch (error) {
      console.error('❌ Failed to load CodeRabbit data:', error);
      throw error;
    }
  }

  /**
   * Extract new high-priority suggestions that haven't been processed
   */
  extractNewHighPrioritySuggestions(data) {
    const suggestions = [];
    const highPrioritySuggestions = data.highPriority;

    console.log(`🔍 Processing ${highPrioritySuggestions.length} high-priority suggestions...`);

    for (const suggestion of highPrioritySuggestions) {
      // Generate hash to check if already processed
      const hash = this.generateSuggestionHash(suggestion);
      
      if (this.processedSuggestions.has(hash)) {
        console.log(`⏭️ Skipping already processed: ${suggestion.category} in PR #${suggestion.prNumber}`);
        continue;
      }

      // Only process high-priority suggestions
      if (suggestion.priority === 'high') {
        suggestions.push({
          ...suggestion,
          hash
        });
      }
    }

    console.log(`🎯 Found ${suggestions.length} new high-priority suggestions to process`);
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
        
        // Mark suggestion as processed
        if (suggestion.hash) {
          this.processedSuggestions.add(suggestion.hash);
        }
        
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
    // First check if we've already processed this suggestion hash
    if (suggestion.hash && this.processedSuggestions.has(suggestion.hash)) {
      return true;
    }

    // Check against existing tickets
    const isDuplicate = existingTickets.some((ticket) => {
      // Check if same PR and similar category and similar content
      const samePR = ticket.pullRequest === `#${suggestion.prNumber}`;
      const sameCategory = ticket.tags && ticket.tags.includes(suggestion.category);
      const notClosed = ticket.status !== 'closed' && ticket.status !== 'resolved';
      
      // Also check for similar suggestion text to catch variations
      const similarText = ticket.coderabbitSuggestion && 
        suggestion.text && 
        this.calculateTextSimilarity(ticket.coderabbitSuggestion, suggestion.text) > 0.8;

      return samePR && sameCategory && notClosed && (similarText || 
        (ticket.coderabbitSuggestion === suggestion.text));
    });

    return isDuplicate;
  }

  /**
   * Calculate text similarity between two strings (simple approach)
   */
  calculateTextSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    
    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const norm1 = normalize(text1);
    const norm2 = normalize(text2);
    
    if (norm1 === norm2) return 1;
    
    // Simple word overlap similarity
    const words1 = new Set(norm1.split(/\s+/));
    const words2 = new Set(norm2.split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
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
      suggestionHash: suggestion.hash, // Track the hash for future deduplication
      file: suggestion.file || null,
      line: suggestion.line || null,
      reviewUrl: suggestion.reviewUrl || null,
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
    const fileInfo = suggestion.file ? `**File:** ${suggestion.file}${suggestion.line ? ` (Line ${suggestion.line})` : ''}\n` : '';
    const reviewLink = suggestion.reviewUrl ? `**Review Link:** ${suggestion.reviewUrl}\n` : '';
    
    return `## CodeRabbit Suggestion

**Category:** ${suggestion.category}
**Priority:** ${suggestion.priority}
**Source PR:** #${suggestion.prNumber}${suggestion.prTitle ? ` - ${suggestion.prTitle}` : ''}
${fileInfo}${reviewLink}
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

### Tracking
- **Suggestion Hash:** ${suggestion.hash}
- **Generated:** ${new Date().toISOString()}

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


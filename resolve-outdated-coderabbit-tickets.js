/**
 * Resolve Outdated CodeRabbit Tickets
 * Automatically resolves CodeRabbit tickets that are no longer relevant
 * based on newer PR analysis and resolved issues
 */

import { TicketManager } from './ticketManager.js';
import fs from 'fs/promises';

class OutdatedTicketResolver {
  constructor() {
    this.ticketManager = new TicketManager();
    this.resolvedTickets = [];
    this.checkedTickets = [];
  }

  /**
   * Main function to resolve outdated tickets
   */
  async resolveOutdatedTickets() {
    console.log('🔍 Starting outdated CodeRabbit ticket resolution...\n');

    try {
      // Get all existing CodeRabbit tickets
      const coderabbitTickets = await this.getCodeRabbitTickets();
      
      // Get latest CodeRabbit analysis
      const latestAnalysis = await this.getLatestAnalysis();
      
      // Check each ticket for relevance
      await this.checkTicketRelevance(coderabbitTickets, latestAnalysis);
      
      // Report summary
      this.reportSummary();
    } catch (error) {
      console.error('❌ Error in outdated ticket resolution:', error);
      throw error;
    }
  }

  /**
   * Get all CodeRabbit tickets
   */
  async getCodeRabbitTickets() {
    try {
      const tickets = await this.ticketManager.listTickets();
      const coderabbitTickets = [];

      for (const ticketId of tickets) {
        try {
          const ticket = await this.ticketManager.getTicket(ticketId);
          if (ticket.tags && ticket.tags.includes('coderabbit') && 
              ticket.status !== 'closed' && ticket.status !== 'resolved') {
            coderabbitTickets.push(ticket);
          }
        } catch (error) {
          // Skip tickets that can't be loaded
          continue;
        }
      }

      console.log(`📋 Found ${coderabbitTickets.length} open CodeRabbit tickets`);
      return coderabbitTickets;
    } catch (error) {
      console.error('❌ Failed to load CodeRabbit tickets:', error);
      return [];
    }
  }

  /**
   * Get latest CodeRabbit analysis data
   */
  async getLatestAnalysis() {
    try {
      // Read the latest summary
      const summaryPath = 'coderabbit-reviews/latest-summary.json';
      const summaryData = await fs.readFile(summaryPath, 'utf8');
      const summary = JSON.parse(summaryData);

      // Read complete data for detailed analysis
      const completePath = 'coderabbit-reviews/latest-complete.json';
      const completeData = await fs.readFile(completePath, 'utf8');
      const complete = JSON.parse(completeData);

      console.log(`📊 Loaded analysis for ${summary.totalPRs} PRs with ${summary.totalSuggestions} suggestions`);
      
      return {
        summary,
        complete: complete.reviews || []
      };
    } catch (error) {
      console.error('❌ Failed to load latest analysis:', error);
      return { summary: {}, complete: [] };
    }
  }

  /**
   * Check each ticket for relevance against latest analysis
   */
  async checkTicketRelevance(tickets, analysis) {
    console.log('\n🔍 Checking ticket relevance...');

    for (const ticket of tickets) {
      this.checkedTickets.push(ticket.id);
      
      try {
        const shouldResolve = await this.shouldResolveTicket(ticket, analysis);
        
        if (shouldResolve.resolve) {
          await this.resolveTicket(ticket, shouldResolve.reason);
          this.resolvedTickets.push({
            id: ticket.id,
            reason: shouldResolve.reason
          });
          console.log(`✅ Resolved: ${ticket.id} - ${shouldResolve.reason}`);
        } else {
          console.log(`⏭️ Keeping: ${ticket.id} - Still relevant`);
        }
      } catch (error) {
        console.error(`❌ Error checking ticket ${ticket.id}:`, error);
      }
    }
  }

  /**
   * Determine if a ticket should be resolved
   */
  async shouldResolveTicket(ticket, analysis) {
    // Extract PR number from ticket
    const prMatch = ticket.pullRequest?.match(/#(\d+)/);
    if (!prMatch) {
      return { resolve: false, reason: 'No PR number found' };
    }
    
    const prNumber = parseInt(prMatch[1]);
    
    // Check if this PR still exists in latest analysis
    const prExists = analysis.complete.some(review => 
      review.pullRequest && review.pullRequest.number === prNumber
    );
    
    if (!prExists) {
      return { 
        resolve: true, 
        reason: `PR #${prNumber} no longer in latest analysis - likely resolved or superseded` 
      };
    }

    // Check if the specific suggestion still exists
    if (ticket.coderabbitSuggestion) {
      const suggestionExists = this.findSimilarSuggestion(
        ticket.coderabbitSuggestion, 
        ticket.tags?.find(tag => ['bug', 'security', 'performance', 'style', 'documentation'].includes(tag)),
        analysis.complete
      );
      
      if (!suggestionExists) {
        return { 
          resolve: true, 
          reason: 'Specific suggestion no longer appears in latest analysis - likely fixed' 
        };
      }
    }

    // Check if ticket is very old (more than 30 days) and low priority
    const ticketAge = Date.now() - new Date(ticket.createdAt).getTime();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    
    if (ticketAge > thirtyDays && ticket.priority !== 'high') {
      return { 
        resolve: true, 
        reason: 'Ticket is over 30 days old and not high priority - likely stale' 
      };
    }

    return { resolve: false, reason: 'Still relevant' };
  }

  /**
   * Find similar suggestion in latest analysis
   */
  findSimilarSuggestion(suggestionText, category, reviews) {
    if (!suggestionText || !category) return false;

    for (const review of reviews) {
      if (!review.comments) continue;
      
      for (const comment of review.comments) {
        if (comment.category === category) {
          // Simple text similarity check
          const similarity = this.calculateTextSimilarity(suggestionText, comment.text || comment.suggestion || '');
          if (similarity > 0.7) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Calculate text similarity (same as in auto-tickets script)
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
   * Resolve a ticket with reason
   */
  async resolveTicket(ticket, reason) {
    const updatedTicket = {
      ...ticket,
      status: 'resolved',
      resolution: reason,
      updatedAt: new Date().toISOString(),
      history: [
        ...(ticket.history || []),
        {
          action: 'status_change',
          oldStatus: ticket.status,
          newStatus: 'resolved',
          timestamp: new Date().toISOString(),
          note: `Auto-resolved: ${reason}`
        }
      ]
    };

    await this.ticketManager.updateTicket(ticket.id, updatedTicket);
  }

  /**
   * Report summary of resolution process
   */
  reportSummary() {
    console.log('\n📊 Outdated Ticket Resolution Summary:');
    console.log(`   🔍 Tickets checked: ${this.checkedTickets.length}`);
    console.log(`   ✅ Tickets resolved: ${this.resolvedTickets.length}`);
    console.log(`   ⏭️ Tickets kept open: ${this.checkedTickets.length - this.resolvedTickets.length}`);

    if (this.resolvedTickets.length > 0) {
      console.log('\n✅ Resolved Tickets:');
      this.resolvedTickets.forEach((ticket) => {
        console.log(`   - ${ticket.id}: ${ticket.reason}`);
      });
    }

    console.log('\n💡 Next Steps:');
    console.log('   1. Review resolved tickets to ensure accuracy');
    console.log('   2. Run coderabbit-auto-tickets.js to create tickets for new issues');
    console.log('   3. Prioritize remaining open tickets');
  }
}

/**
 * Main execution function
 */
async function main() {
  const resolver = new OutdatedTicketResolver();
  await resolver.resolveOutdatedTickets();
}

// Run if called directly
if (import.meta.url.includes('resolve-outdated-coderabbit-tickets.js')) {
  main().catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

export { OutdatedTicketResolver }; 
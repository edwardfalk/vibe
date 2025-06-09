/**
 * CodeRabbit Ticket Workflow
 * Complete workflow for managing CodeRabbit tickets:
 * 1. Resolve outdated tickets
 * 2. Create tickets for new issues
 * 3. Update ticket priorities based on latest analysis
 */

import { CodeRabbitTicketCreator } from './coderabbit-auto-tickets.js';
import { OutdatedTicketResolver } from './resolve-outdated-coderabbit-tickets.js';
import { TicketManager } from './ticketManager.js';

class CodeRabbitTicketWorkflow {
  constructor() {
    this.ticketManager = new TicketManager();
    this.stats = {
      resolvedTickets: 0,
      createdTickets: 0,
      updatedTickets: 0,
      totalProcessed: 0
    };
  }

  /**
   * Run the complete CodeRabbit ticket workflow
   */
  async runWorkflow() {
    console.log('🚀 Starting CodeRabbit Ticket Workflow...\n');
    
    try {
      // Step 1: Resolve outdated tickets
      console.log('📋 Step 1: Resolving outdated tickets...');
      await this.resolveOutdatedTickets();
      
      // Step 2: Create tickets for new issues
      console.log('\n🎫 Step 2: Creating tickets for new issues...');
      await this.createNewTickets();
      
      // Step 3: Update priorities based on latest analysis
      console.log('\n⚡ Step 3: Updating ticket priorities...');
      await this.updateTicketPriorities();
      
      // Step 4: Generate comprehensive report
      console.log('\n📊 Step 4: Generating workflow report...');
      this.generateWorkflowReport();
      
    } catch (error) {
      console.error('❌ Workflow error:', error);
      throw error;
    }
  }

  /**
   * Resolve outdated tickets
   */
  async resolveOutdatedTickets() {
    const resolver = new OutdatedTicketResolver();
    await resolver.resolveOutdatedTickets();
    this.stats.resolvedTickets = resolver.resolvedTickets.length;
  }

  /**
   * Create tickets for new issues
   */
  async createNewTickets() {
    const creator = new CodeRabbitTicketCreator();
    await creator.createTicketsFromReviews();
    this.stats.createdTickets = creator.createdTickets.length;
  }

  /**
   * Update ticket priorities based on latest analysis
   */
  async updateTicketPriorities() {
    try {
      const tickets = await this.ticketManager.listTickets();
      let updatedCount = 0;

      for (const ticketId of tickets) {
        try {
          const ticket = await this.ticketManager.getTicket(ticketId);
          
          if (ticket.tags && ticket.tags.includes('coderabbit') && 
              ticket.status === 'open') {
            
            const newPriority = this.calculateUpdatedPriority(ticket);
            
            if (newPriority !== ticket.priority) {
              const updatedTicket = {
                ...ticket,
                priority: newPriority,
                updatedAt: new Date().toISOString(),
                history: [
                  ...(ticket.history || []),
                  {
                    action: 'priority_change',
                    oldPriority: ticket.priority,
                    newPriority: newPriority,
                    timestamp: new Date().toISOString(),
                    note: 'Auto-updated priority based on latest analysis'
                  }
                ]
              };
              
              await this.ticketManager.updateTicket(ticketId, updatedTicket);
              updatedCount++;
              console.log(`📈 Updated priority for ${ticketId}: ${ticket.priority} → ${newPriority}`);
            }
          }
        } catch (error) {
          // Skip tickets that can't be processed
          continue;
        }
      }

      this.stats.updatedTickets = updatedCount;
      console.log(`✅ Updated priorities for ${updatedCount} tickets`);
    } catch (error) {
      console.error('⚠️ Failed to update ticket priorities:', error);
    }
  }

  /**
   * Calculate updated priority for a ticket
   */
  calculateUpdatedPriority(ticket) {
    // Priority calculation based on category, age, and current status
    const category = ticket.tags?.find(tag => 
      ['security', 'bug', 'performance', 'style', 'documentation'].includes(tag)
    );
    
    const ticketAge = Date.now() - new Date(ticket.createdAt).getTime();
    const daysSinceCreated = ticketAge / (24 * 60 * 60 * 1000);
    
    // Security and bugs are always high priority
    if (category === 'security' || category === 'bug') {
      return 'high';
    }
    
    // Performance issues become high priority if old
    if (category === 'performance' && daysSinceCreated > 7) {
      return 'high';
    }
    
    // Style and documentation become low priority if old
    if ((category === 'style' || category === 'documentation') && daysSinceCreated > 14) {
      return 'low';
    }
    
    // Default to current priority if no changes needed
    return ticket.priority || 'medium';
  }

  /**
   * Generate comprehensive workflow report
   */
  generateWorkflowReport() {
    console.log('\n📊 CodeRabbit Ticket Workflow Report');
    console.log('=====================================');
    console.log(`🗑️  Resolved outdated tickets: ${this.stats.resolvedTickets}`);
    console.log(`🎫 Created new tickets: ${this.stats.createdTickets}`);
    console.log(`📈 Updated ticket priorities: ${this.stats.updatedTickets}`);
    console.log(`📋 Total tickets processed: ${this.stats.resolvedTickets + this.stats.createdTickets + this.stats.updatedTickets}`);
    
    console.log('\n💡 Recommended Next Steps:');
    console.log('   1. Review newly created tickets for accuracy');
    console.log('   2. Assign high-priority tickets to team members');
    console.log('   3. Create feature branches for implementation');
    console.log('   4. Schedule regular workflow runs (daily/weekly)');
    
    console.log('\n🔄 Automation Suggestions:');
    console.log('   • Set up GitHub Actions to run this workflow on PR merges');
    console.log('   • Configure notifications for high-priority ticket creation');
    console.log('   • Implement ticket assignment based on file ownership');
    console.log('   • Add integration with project management tools');
  }
}

/**
 * Main execution function
 */
async function main() {
  const workflow = new CodeRabbitTicketWorkflow();
  await workflow.runWorkflow();
}

// Run if called directly
if (import.meta.url.includes('coderabbit-ticket-workflow.js')) {
  main().catch((error) => {
    console.error('💥 Fatal workflow error:', error);
    process.exit(1);
  });
}

export { CodeRabbitTicketWorkflow }; 
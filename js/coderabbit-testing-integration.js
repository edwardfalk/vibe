/**
 * CodeRabbit Testing Integration
 * Integrates CodeRabbit review processing with automated testing workflow
 */

// Load environment variables from .env file if it exists
try {
    require('dotenv').config();
} catch (e) {
    // dotenv not available, continue without it
}

const CodeRabbitReviewProcessor = require('./coderabbit-review-processor.js');
const CodeRabbitTicketTracker = require('./coderabbit-ticket-tracker.js');
const { random } = require('./mathUtils.js');

class CodeRabbitTestingIntegration {
    constructor(options = {}) {
        this.processor = new CodeRabbitReviewProcessor(options);
        this.ticketManager = options.ticketManager;
        this.testRunner = options.testRunner;
        this.tracker = new CodeRabbitTicketTracker(options);
    }

    /**
     * Main workflow: Fetch CodeRabbit reviews and create actionable test tasks
     */
    async runCodeRabbitTestingWorkflow() {
        console.log('🚀 Starting CodeRabbit Testing Integration Workflow...');
        
        try {
            // Step 1: Fetch and analyze CodeRabbit reviews
            const reviewData = await this.processor.getLatestCodeRabbitReviews(5);
            
            if (reviewData.length === 0) {
                console.log('📭 No CodeRabbit reviews found. Workflow complete.');
                return { success: true, message: 'No reviews to process' };
            }

            // Step 2: Generate actionable tasks
            const tasks = this.processor.generateActionableTasks(reviewData);
            const report = this.processor.generateSummaryReport(reviewData, tasks);

            // Step 3: Create tickets for high-priority issues
            const tickets = await this.createTicketsFromTasks(tasks, reviewData);

            // Step 4: Run targeted tests based on suggestions
            const testResults = await this.runTargetedTests(tasks);

            // Step 5: Generate comprehensive report
            const finalReport = this.generateFinalReport(report, tickets, testResults);

            console.log('\n✅ CodeRabbit Testing Workflow Complete!');
            console.log(`📊 Created ${tickets.length} tickets`);
            console.log(`🧪 Ran ${testResults.length} targeted tests`);

            return {
                success: true,
                reviewData,
                tasks,
                tickets,
                testResults,
                report: finalReport
            };

        } catch (error) {
            console.error('🚨 CodeRabbit Testing Workflow failed:', error);
            throw error;
        }
    }

    /**
     * Create tickets from CodeRabbit tasks
     */
    async createTicketsFromTasks(tasks, reviewData) {
        if (!this.ticketManager) {
            console.log('⚠️ No ticket manager provided, skipping ticket creation');
            return [];
        }

        const tickets = [];
        // Create tickets for all priority levels (high, medium, low)
        const allTasks = tasks.filter(task => ['high', 'medium', 'low'].includes(task.priority));

        for (const task of allTasks) {
            try {
                const ticketData = {
                    id: `CR-${Date.now()}-${random().toString(36).substr(2, 9)}`,
                    type: task.priority === 'high' ? 'bug' : (task.priority === 'medium' ? 'enhancement' : 'task'),
                    title: task.title,
                    description: this.formatTicketDescription(task, reviewData),
                    priority: task.priority,
                    status: 'open',
                    tags: ['coderabbit', 'automated', task.category],
                    metadata: {
                        source: 'coderabbit',
                        pullRequest: task.pullRequest,
                        reviewUrl: task.reviewUrl,
                        file: task.file,
                        line: task.line,
                        category: task.category
                    },
                    createdAt: new Date().toISOString()
                };

                const ticket = await this.ticketManager.createTicket(ticketData);
                tickets.push(ticket);
                
                // Track the ticket
                await this.tracker.addTicket(ticketData);
                
                console.log(`🎫 Created ticket: ${ticketData.id} - ${task.title}`);

            } catch (error) {
                console.error(`🚨 Failed to create ticket for task: ${task.title}`, error);
            }
        }

        return tickets;
    }

    /**
     * Format ticket description with CodeRabbit context
     */
    formatTicketDescription(task, reviewData) {
        const reviewItem = reviewData.find(r => r.pullRequest.number === task.pullRequest);
        
        let description = `## CodeRabbit Suggestion\n\n`;
        description += `**Category:** ${task.category}\n`;
        description += `**Priority:** ${task.priority}\n`;
        description += `**Pull Request:** #${task.pullRequest}\n\n`;
        
        if (task.file) {
            description += `**File:** ${task.file}\n`;
            if (task.line) {
                description += `**Line:** ${task.line}\n`;
            }
            description += `\n`;
        }
        
        description += `**Suggestion:**\n${task.description}\n\n`;
        
        if (reviewItem) {
            description += `**Review Link:** ${task.reviewUrl}\n`;
            description += `**PR Link:** ${reviewItem.pullRequest.url}\n\n`;
        }
        
        description += `## Action Required\n`;
        if (task.priority === 'high') {
            description += `This issue was automatically identified by CodeRabbit and requires immediate attention due to its high priority.\n\n`;
        } else if (task.priority === 'medium') {
            description += `This enhancement was automatically identified by CodeRabbit and should be addressed when convenient.\n\n`;
        } else {
            description += `This task was automatically identified by CodeRabbit and can be addressed during maintenance cycles.\n\n`;
        }
        description += `## Testing Notes\n`;
        description += `- [ ] Verify the issue exists\n`;
        description += `- [ ] Implement the suggested fix\n`;
        description += `- [ ] Run relevant tests\n`;
        description += `- [ ] Update documentation if needed\n`;

        return description;
    }

    /**
     * Run targeted tests based on CodeRabbit suggestions
     */
    async runTargetedTests(tasks) {
        if (!this.testRunner) {
            console.log('⚠️ No test runner provided, skipping targeted tests');
            return [];
        }

        const testResults = [];
        const testableCategories = ['bug', 'performance', 'security', 'testing'];
        
        for (const task of tasks) {
            if (testableCategories.includes(task.category)) {
                try {
                    console.log(`🧪 Running targeted test for ${task.category} issue...`);
                    
                    const testConfig = this.generateTestConfig(task);
                    const result = await this.testRunner.runTest(testConfig);
                    
                    testResults.push({
                        task: task,
                        testConfig: testConfig,
                        result: result,
                        timestamp: new Date().toISOString()
                    });

                } catch (error) {
                    console.error(`🚨 Test failed for task: ${task.title}`, error);
                    testResults.push({
                        task: task,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        }

        return testResults;
    }

    /**
     * Generate test configuration based on task category
     */
    generateTestConfig(task) {
        const baseConfig = {
            name: `CodeRabbit-${task.category}-test`,
            description: `Automated test for CodeRabbit ${task.category} suggestion`,
            category: task.category,
            file: task.file,
            line: task.line
        };

        switch (task.category) {
            case 'bug':
                return {
                    ...baseConfig,
                    type: 'functional',
                    focus: 'error-reproduction',
                    steps: [
                        'Navigate to affected functionality',
                        'Attempt to reproduce the potential bug',
                        'Verify error handling',
                        'Check for unexpected behavior'
                    ]
                };

            case 'performance':
                return {
                    ...baseConfig,
                    type: 'performance',
                    focus: 'optimization-verification',
                    steps: [
                        'Measure current performance metrics',
                        'Identify performance bottlenecks',
                        'Verify optimization opportunities',
                        'Test under load conditions'
                    ]
                };

            case 'security':
                return {
                    ...baseConfig,
                    type: 'security',
                    focus: 'vulnerability-assessment',
                    steps: [
                        'Check for security vulnerabilities',
                        'Test input validation',
                        'Verify authentication/authorization',
                        'Check for data exposure'
                    ]
                };

            case 'testing':
                return {
                    ...baseConfig,
                    type: 'meta-testing',
                    focus: 'test-coverage',
                    steps: [
                        'Analyze test coverage',
                        'Identify missing test cases',
                        'Verify test quality',
                        'Check test reliability'
                    ]
                };

            default:
                return {
                    ...baseConfig,
                    type: 'general',
                    focus: 'code-quality',
                    steps: [
                        'Review code quality',
                        'Check for best practices',
                        'Verify maintainability',
                        'Test functionality'
                    ]
                };
        }
    }

    /**
     * Generate final comprehensive report
     */
    generateFinalReport(codeRabbitReport, tickets, testResults) {
        const successfulTests = testResults.filter(t => t.result && !t.error);
        const failedTests = testResults.filter(t => t.error);

        return {
            timestamp: new Date().toISOString(),
            codeRabbitAnalysis: codeRabbitReport,
            ticketsSummary: {
                total: tickets.length,
                created: tickets.filter(t => t.status === 'created').length,
                failed: tickets.filter(t => t.error).length
            },
            testingSummary: {
                total: testResults.length,
                successful: successfulTests.length,
                failed: failedTests.length,
                categories: this.getTestCategoryBreakdown(testResults)
            },
            recommendations: this.generateIntegratedRecommendations(codeRabbitReport, tickets, testResults),
            nextActions: this.generateNextActions(tickets, testResults)
        };
    }

    /**
     * Get test category breakdown
     */
    getTestCategoryBreakdown(testResults) {
        const breakdown = {};
        testResults.forEach(result => {
            const category = result.task.category;
            if (!breakdown[category]) {
                breakdown[category] = { total: 0, successful: 0, failed: 0 };
            }
            breakdown[category].total++;
            if (result.error) {
                breakdown[category].failed++;
            } else {
                breakdown[category].successful++;
            }
        });
        return breakdown;
    }

    /**
     * Generate integrated recommendations
     */
    generateIntegratedRecommendations(codeRabbitReport, tickets, testResults) {
        const recommendations = [...codeRabbitReport.recommendations];

        if (tickets.length > 0) {
            recommendations.push(`🎫 ${tickets.length} tickets created for high-priority issues`);
        }

        const failedTests = testResults.filter(t => t.error);
        if (failedTests.length > 0) {
            recommendations.push(`🧪 ${failedTests.length} tests failed - investigate immediately`);
        }

        const securityTests = testResults.filter(t => t.task.category === 'security');
        if (securityTests.length > 0) {
            recommendations.push(`🔒 Security tests run - review results carefully`);
        }

        return recommendations;
    }

    /**
     * Generate next actions
     */
    generateNextActions(tickets, testResults) {
        const actions = [];

        if (tickets.length > 0) {
            actions.push(`1. Review and assign ${tickets.length} created tickets`);
        }

        const failedTests = testResults.filter(t => t.error);
        if (failedTests.length > 0) {
            actions.push(`${actions.length + 1}. Investigate ${failedTests.length} failed tests`);
        }

        const securityIssues = tickets.filter(t => t.metadata?.category === 'security');
        if (securityIssues.length > 0) {
            actions.push(`${actions.length + 1}. Prioritize ${securityIssues.length} security issues`);
        }

        actions.push(`${actions.length + 1}. Schedule follow-up review in 24 hours`);
        actions.push(`${actions.length + 1}. Update team on CodeRabbit findings`);

        return actions;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CodeRabbitTestingIntegration;
}

// Example usage
async function runIntegratedWorkflow() {
    try {
        // Mock ticket manager and test runner for demonstration
        const mockTicketManager = {
            createTicket: async (ticketData) => {
                console.log(`📝 Mock: Creating ticket ${ticketData.id}`);
                return { ...ticketData, status: 'created' };
            }
        };

        const mockTestRunner = {
            runTest: async (testConfig) => {
                console.log(`🧪 Mock: Running test ${testConfig.name}`);
                return {
                    passed: random() > 0.3, // 70% pass rate
                    duration: Math.floor(random() * 5000) + 1000,
                    details: `Test completed for ${testConfig.category} issue`
                };
            }
        };

        const integration = new CodeRabbitTestingIntegration({
            owner: 'edwardfalk',
            repo: 'vibe',
            ticketManager: mockTicketManager,
            testRunner: mockTestRunner
        });

        const result = await integration.runCodeRabbitTestingWorkflow();
        
        console.log('\n📋 Final Integration Report:');
        console.log('============================');
        console.log(JSON.stringify(result.report, null, 2));

        return result;

    } catch (error) {
        console.error('🚨 Integrated workflow failed:', error);
        throw error;
    }
}

// Auto-run if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
    runIntegratedWorkflow().catch(console.error);
}
/**
 * Ticket Resolution Checker
 * Verifies if issues mentioned in tickets are actually resolved in the codebase
 */

const fs = require('fs').promises;
const path = require('path');

class TicketResolutionChecker {
    constructor(options = {}) {
        this.projectRoot = options.projectRoot || process.cwd();
        this.ticketsPath = options.ticketsPath || path.join(this.projectRoot, 'tests', 'bug-reports', 'coderabbit-tickets.json');
    }

    /**
     * Check if tickets marked as resolved are actually fixed
     */
    async verifyResolvedTickets() {
        console.log('🔍 Verifying resolved tickets...');
        
        try {
            const ticketsData = await this.loadTickets();
            const resolvedTickets = Object.values(ticketsData.tickets).filter(t => t.status === 'resolved');
            
            console.log(`📊 Found ${resolvedTickets.length} resolved tickets to verify`);
            
            const verificationResults = [];
            
            for (const ticket of resolvedTickets) {
                const result = await this.verifyTicketResolution(ticket);
                verificationResults.push(result);
                
                if (!result.isActuallyResolved) {
                    console.log(`⚠️ Ticket ${ticket.id} marked as resolved but issue may still exist`);
                    console.log(`   Issue: ${result.reason}`);
                }
            }
            
            return {
                total: resolvedTickets.length,
                verified: verificationResults.filter(r => r.isActuallyResolved).length,
                questionable: verificationResults.filter(r => !r.isActuallyResolved).length,
                results: verificationResults
            };
            
        } catch (error) {
            console.error('🚨 Error verifying resolved tickets:', error);
            throw error;
        }
    }

    /**
     * Check for duplicate tickets (same issue reported multiple times)
     */
    async findDuplicateTickets() {
        console.log('🔍 Checking for duplicate tickets...');
        
        try {
            const ticketsData = await this.loadTickets();
            const tickets = Object.values(ticketsData.tickets);
            
            const duplicateGroups = [];
            const processed = new Set();
            
            for (const ticket of tickets) {
                if (processed.has(ticket.id)) continue;
                
                const duplicates = tickets.filter(t => 
                    t.id !== ticket.id && 
                    !processed.has(t.id) &&
                    this.areTicketsSimilar(ticket, t)
                );
                
                if (duplicates.length > 0) {
                    const group = [ticket, ...duplicates];
                    duplicateGroups.push(group);
                    
                    // Mark all as processed
                    group.forEach(t => processed.add(t.id));
                    
                    console.log(`🔄 Found duplicate group: ${group.length} tickets for similar issue`);
                    console.log(`   Primary: ${ticket.id} - ${ticket.title}`);
                    duplicates.forEach(d => console.log(`   Duplicate: ${d.id} - ${d.title}`));
                }
            }
            
            return {
                totalGroups: duplicateGroups.length,
                totalDuplicates: duplicateGroups.reduce((sum, group) => sum + group.length - 1, 0),
                groups: duplicateGroups
            };
            
        } catch (error) {
            console.error('🚨 Error finding duplicate tickets:', error);
            throw error;
        }
    }

    /**
     * Verify if a specific ticket's issue is actually resolved
     */
    async verifyTicketResolution(ticket) {
        const result = {
            ticketId: ticket.id,
            title: ticket.title,
            isActuallyResolved: false,
            reason: '',
            confidence: 0
        };

        try {
            // Check based on ticket category and content
            if (ticket.file) {
                const fileExists = await this.checkFileExists(ticket.file);
                if (!fileExists) {
                    result.isActuallyResolved = true;
                    result.reason = 'File no longer exists - issue resolved by file removal';
                    result.confidence = 0.9;
                    return result;
                }

                // Check specific line issues
                if (ticket.line) {
                    const lineCheck = await this.checkLineIssue(ticket.file, ticket.line, ticket.description);
                    result.isActuallyResolved = lineCheck.resolved;
                    result.reason = lineCheck.reason;
                    result.confidence = lineCheck.confidence;
                    return result;
                }
            }

            // Check for specific patterns based on ticket content
            if (ticket.description.includes('undefined metadata')) {
                const metadataCheck = await this.checkMetadataIssues();
                result.isActuallyResolved = metadataCheck.resolved;
                result.reason = metadataCheck.reason;
                result.confidence = metadataCheck.confidence;
                return result;
            }

            if (ticket.description.includes('p5.js instance mode')) {
                const p5Check = await this.checkP5InstanceMode();
                result.isActuallyResolved = p5Check.resolved;
                result.reason = p5Check.reason;
                result.confidence = p5Check.confidence;
                return result;
            }

            if (ticket.description.includes('re-running tests')) {
                const testCheck = await this.checkTestRerunIssues();
                result.isActuallyResolved = testCheck.resolved;
                result.reason = testCheck.reason;
                result.confidence = testCheck.confidence;
                return result;
            }

            // Default: assume resolved if marked as such (low confidence)
            result.isActuallyResolved = true;
            result.reason = 'No specific verification method available - trusting resolved status';
            result.confidence = 0.3;

        } catch (error) {
            result.reason = `Error during verification: ${error.message}`;
            result.confidence = 0;
        }

        return result;
    }

    /**
     * Check if two tickets are similar (potential duplicates)
     */
    areTicketsSimilar(ticket1, ticket2) {
        // Same file and line
        if (ticket1.file && ticket2.file && ticket1.line && ticket2.line) {
            return ticket1.file === ticket2.file && ticket1.line === ticket2.line;
        }

        // Same file and similar description
        if (ticket1.file && ticket2.file && ticket1.file === ticket2.file) {
            const desc1 = ticket1.description.toLowerCase();
            const desc2 = ticket2.description.toLowerCase();
            
            // Check for common keywords
            const keywords = ['undefined metadata', 'p5.js instance', 're-running tests', 'optional chaining'];
            for (const keyword of keywords) {
                if (desc1.includes(keyword) && desc2.includes(keyword)) {
                    return true;
                }
            }
        }

        // Same category and very similar titles
        if (ticket1.category === ticket2.category) {
            const title1 = ticket1.title.toLowerCase().replace(/pr #\d+/g, '').trim();
            const title2 = ticket2.title.toLowerCase().replace(/pr #\d+/g, '').trim();
            
            if (title1 === title2) {
                return true;
            }
        }

        return false;
    }

    /**
     * Helper methods for specific issue checks
     */
    async checkFileExists(filePath) {
        try {
            const fullPath = path.join(this.projectRoot, filePath);
            await fs.access(fullPath);
            return true;
        } catch {
            return false;
        }
    }

    async checkLineIssue(filePath, lineNumber, description) {
        try {
            const fullPath = path.join(this.projectRoot, filePath);
            const content = await fs.readFile(fullPath, 'utf8');
            const lines = content.split('\n');
            
            if (lineNumber > lines.length) {
                return {
                    resolved: true,
                    reason: 'Line number exceeds file length - likely resolved',
                    confidence: 0.8
                };
            }

            const targetLine = lines[lineNumber - 1];
            
            // Check for specific patterns mentioned in the description
            if (description.includes('optional chaining') && targetLine.includes('?.')) {
                return {
                    resolved: true,
                    reason: 'Optional chaining already implemented',
                    confidence: 0.9
                };
            }

            if (description.includes('undefined metadata') && targetLine.includes('metadata?.')) {
                return {
                    resolved: true,
                    reason: 'Metadata safety check already implemented',
                    confidence: 0.9
                };
            }

            return {
                resolved: false,
                reason: 'Line exists but specific fix not detected',
                confidence: 0.6
            };

        } catch (error) {
            return {
                resolved: false,
                reason: `Error checking file: ${error.message}`,
                confidence: 0
            };
        }
    }

    async checkMetadataIssues() {
        try {
            // Check if metadata access is properly guarded
            const integrationFile = path.join(this.projectRoot, 'js', 'coderabbit-testing-integration.js');
            const content = await fs.readFile(integrationFile, 'utf8');
            
            if (content.includes('t.metadata?.category')) {
                return {
                    resolved: true,
                    reason: 'Optional chaining for metadata access is implemented',
                    confidence: 0.9
                };
            }

            return {
                resolved: false,
                reason: 'Metadata access may still be unsafe',
                confidence: 0.7
            };

        } catch (error) {
            return {
                resolved: false,
                reason: `Error checking metadata issues: ${error.message}`,
                confidence: 0
            };
        }
    }

    async checkP5InstanceMode() {
        try {
            // Check if p5.js files are using proper instance mode
            const jsDir = path.join(this.projectRoot, 'js');
            const files = await fs.readdir(jsDir);
            const jsFiles = files.filter(f => f.endsWith('.js'));
            
            let hasIssues = false;
            for (const file of jsFiles) {
                const content = await fs.readFile(path.join(jsDir, file), 'utf8');
                
                // Look for problematic patterns
                if (content.includes('sin(') && !content.includes('this.p.sin(') && !content.includes('p.sin(')) {
                    hasIssues = true;
                    break;
                }
            }

            return {
                resolved: !hasIssues,
                reason: hasIssues ? 'P5.js instance mode issues still detected' : 'P5.js instance mode appears correct',
                confidence: 0.7
            };

        } catch (error) {
            return {
                resolved: false,
                reason: `Error checking p5.js instance mode: ${error.message}`,
                confidence: 0
            };
        }
    }

    async checkTestRerunIssues() {
        try {
            // Check if GitHub workflow has been fixed
            const workflowFile = path.join(this.projectRoot, '.github', 'workflows', 'coderabbit-review.yml');
            
            try {
                const content = await fs.readFile(workflowFile, 'utf8');
                
                if (content.includes('steps.tests.outcome')) {
                    return {
                        resolved: true,
                        reason: 'GitHub workflow uses step outcome instead of re-running tests',
                        confidence: 0.9
                    };
                }

                return {
                    resolved: false,
                    reason: 'GitHub workflow may still re-run tests unnecessarily',
                    confidence: 0.8
                };

            } catch {
                return {
                    resolved: true,
                    reason: 'GitHub workflow file not found - issue resolved by removal',
                    confidence: 0.9
                };
            }

        } catch (error) {
            return {
                resolved: false,
                reason: `Error checking test rerun issues: ${error.message}`,
                confidence: 0
            };
        }
    }

    /**
     * Load tickets from JSON file
     */
    async loadTickets() {
        try {
            const content = await fs.readFile(this.ticketsPath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            console.error('🚨 Error loading tickets:', error);
            throw error;
        }
    }

    /**
     * Generate a comprehensive resolution report
     */
    async generateResolutionReport() {
        console.log('📋 Generating comprehensive resolution report...');
        
        const verificationResults = await this.verifyResolvedTickets();
        const duplicateResults = await this.findDuplicateTickets();
        
        const report = {
            timestamp: new Date().toISOString(),
            verification: verificationResults,
            duplicates: duplicateResults,
            recommendations: []
        };

        // Add recommendations
        if (verificationResults.questionable > 0) {
            report.recommendations.push(`🔍 Review ${verificationResults.questionable} questionable resolved tickets`);
        }

        if (duplicateResults.totalDuplicates > 0) {
            report.recommendations.push(`🔄 Consolidate ${duplicateResults.totalDuplicates} duplicate tickets`);
        }

        if (verificationResults.verified > 0) {
            report.recommendations.push(`✅ ${verificationResults.verified} tickets properly resolved`);
        }

        console.log('\n📊 Resolution Report Summary:');
        console.log(`✅ Verified resolved: ${verificationResults.verified}`);
        console.log(`⚠️ Questionable: ${verificationResults.questionable}`);
        console.log(`🔄 Duplicate groups: ${duplicateResults.totalGroups}`);
        console.log(`📝 Total duplicates: ${duplicateResults.totalDuplicates}`);

        return report;
    }
}

module.exports = TicketResolutionChecker;

// CLI usage
if (require.main === module) {
    const checker = new TicketResolutionChecker();
    checker.generateResolutionReport()
        .then(report => {
            console.log('\n📋 Full Report:');
            console.log(JSON.stringify(report, null, 2));
        })
        .catch(console.error);
} 
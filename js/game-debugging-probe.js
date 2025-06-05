/**
 * Game Debugging Probe
 * 
 * Provides debugging insights for game stability and performance
 */

class GameDebuggingProbe {
    constructor() {
        this.name = 'Game Debugging Probe';
        this.version = '1.0.0';
        this.results = {
            status: 'unknown',
            timestamp: new Date().toISOString(),
            gameHealth: {},
            criticalIssues: [],
            performanceRisks: [],
            debuggingInsights: [],
            recommendations: []
        };
    }

    /**
     * Execute debugging probe
     */
    async execute() {
        console.log('🐛 Starting Game Debugging Probe...');
        
        try {
                    // Game debugging analysis
            
            // Analyze game files for bugs
            console.log('🔍 Analyzing game files for bugs and performance issues...');
            const debuggingResults = await gameDebugger.analyzeGameForBugs();
            
            // Extract key insights
            this.extractKeyInsights(debuggingResults);
            
            // Assess game health
            this.assessGameHealth(debuggingResults);
            
            // Generate debugging recommendations
            this.generateDebuggingRecommendations(debuggingResults);
            
            // Determine overall status
            this.calculateOverallStatus();
            
            console.log(`✅ Game Debugging Probe completed: ${this.results.status}`);
            return this.results;
            
        } catch (error) {
            console.error('❌ Game Debugging Probe failed:', error);
            this.results.status = 'failed';
            this.results.criticalIssues.push(`Probe execution error: ${error.message}`);
            return this.results;
        }
    }

    /**
     * Extract key debugging insights from game analysis
     */
    extractKeyInsights(debuggingResults) {
        console.log('🎯 Extracting key debugging insights...');
        
        // Critical issues that could crash the game
        debuggingResults.results.forEach(result => {
            if (result.debuggingInsights?.criticalBugs) {
                result.debuggingInsights.criticalBugs.forEach(bug => {
                    this.results.criticalIssues.push({
                        file: result.file,
                        type: 'critical-bug',
                        message: bug.message,
                        gameplayImpact: bug.gameplayImpact,
                        priority: bug.fixPriority,
                        context: bug.debuggingContext
                    });
                });
            }
            
            // Performance risks affecting frame rate
            if (result.debuggingInsights?.performanceIssues) {
                result.debuggingInsights.performanceIssues.forEach(issue => {
                    this.results.performanceRisks.push({
                        file: result.file,
                        type: 'performance-risk',
                        message: issue.message,
                        frameRateRisk: issue.frameRateRisk,
                        impact: issue.performanceImpact
                    });
                });
            }
            
            // Memory leaks
            if (result.debuggingInsights?.memoryLeaks) {
                result.debuggingInsights.memoryLeaks.forEach(leak => {
                    this.results.criticalIssues.push({
                        file: result.file,
                        type: 'memory-leak',
                        message: leak.description,
                        line: leak.line,
                        risk: leak.risk,
                        code: leak.code
                    });
                });
            }
        });
        
        // Cross-file systemic issues
        if (debuggingResults.insights.systemicIssues) {
            debuggingResults.insights.systemicIssues.forEach(issue => {
                this.results.debuggingInsights.push({
                    type: 'systemic-issue',
                    pattern: issue.type,
                    message: issue.message,
                    affectedFiles: issue.affectedFiles,
                    severity: 'high'
                });
            });
        }
        
        // Priority fixes
        if (debuggingResults.insights.priorityFixes) {
            debuggingResults.insights.priorityFixes.forEach(fix => {
                this.results.criticalIssues.push({
                    file: fix.file,
                    type: 'priority-fix',
                    message: fix.bug.message,
                    urgency: fix.urgency,
                    gameplayImpact: fix.gameplayImpact
                });
            });
        }
    }

    /**
     * Assess overall game health based on findings
     */
    assessGameHealth(debuggingResults) {
        console.log('🏥 Assessing game health...');
        
        const totalFiles = debuggingResults.results.length;
        const filesWithIssues = debuggingResults.results.filter(r => 
            r.analysis && r.analysis.issues.length > 0).length;
        
        const totalIssues = debuggingResults.results.reduce((sum, result) => 
            sum + (result.analysis?.issues.length || 0), 0);
        
        const criticalBugCount = this.results.criticalIssues.filter(i => 
            i.type === 'critical-bug' || i.type === 'priority-fix').length;
        
        const performanceRiskCount = this.results.performanceRisks.length;
        
        const memoryLeakCount = this.results.criticalIssues.filter(i => 
            i.type === 'memory-leak').length;
        
        this.results.gameHealth = {
            overallScore: this.calculateHealthScore(totalIssues, criticalBugCount, performanceRiskCount),
            filesAnalyzed: totalFiles,
            filesWithIssues: filesWithIssues,
            healthPercentage: Math.round(((totalFiles - filesWithIssues) / totalFiles) * 100),
            issueBreakdown: {
                totalIssues,
                criticalBugs: criticalBugCount,
                performanceRisks: performanceRiskCount,
                memoryLeaks: memoryLeakCount,
                systemicIssues: this.results.debuggingInsights.length
            },
            riskAssessment: {
                crashRisk: criticalBugCount > 0 ? 'high' : 'low',
                performanceRisk: performanceRiskCount > 3 ? 'high' : performanceRiskCount > 1 ? 'medium' : 'low',
                stabilityRisk: memoryLeakCount > 0 ? 'high' : 'low'
            }
        };
    }

    /**
     * Calculate overall game health score
     */
    calculateHealthScore(totalIssues, criticalBugs, performanceRisks) {
        let score = 100;
        
        // Deduct for critical bugs (major impact)
        score -= criticalBugs * 20;
        
        // Deduct for performance risks
        score -= performanceRisks * 10;
        
        // Deduct for total issues
        score -= Math.min(totalIssues * 2, 30);
        
        return Math.max(0, score);
    }

    /**
     * Generate actionable debugging recommendations
     */
    generateDebuggingRecommendations(debuggingResults) {
        console.log('💡 Generating debugging recommendations...');
        
        // Critical bug fixes
        if (this.results.criticalIssues.length > 0) {
            this.results.recommendations.push({
                priority: 'critical',
                category: 'bug-fixes',
                title: 'Fix Critical Bugs Immediately',
                description: `${this.results.criticalIssues.length} critical issues found that could crash the game`,
                actions: [
                    'Review all critical bugs in the debugging report',
                    'Fix null pointer exceptions and undefined references',
                    'Add error handling for risky operations',
                    'Test game stability after each fix'
                ]
            });
        }
        
        // Performance optimization
        if (this.results.performanceRisks.length > 2) {
            this.results.recommendations.push({
                priority: 'high',
                category: 'performance',
                title: 'Optimize Game Performance',
                description: `${this.results.performanceRisks.length} performance issues could affect frame rate`,
                actions: [
                    'Profile GameLoop.js for expensive operations',
                    'Optimize collision detection algorithms',
                    'Remove console.log statements from production code',
                    'Use object pooling for frequently created objects'
                ]
            });
        }
        
        // Memory leak prevention
        const memoryLeaks = this.results.criticalIssues.filter(i => i.type === 'memory-leak');
        if (memoryLeaks.length > 0) {
            this.results.recommendations.push({
                priority: 'high',
                category: 'memory',
                title: 'Fix Memory Leaks',
                description: `${memoryLeaks.length} potential memory leaks detected`,
                actions: [
                    'Add cleanup for event listeners',
                    'Clear timers and intervals properly',
                    'Avoid object creation in game loop',
                    'Monitor memory usage during extended gameplay'
                ]
            });
        }
        
        // Systemic issues
        if (this.results.debuggingInsights.length > 0) {
            this.results.recommendations.push({
                priority: 'medium',
                category: 'architecture',
                title: 'Address Systemic Issues',
                description: `${this.results.debuggingInsights.length} patterns found across multiple files`,
                actions: [
                    'Standardize error handling patterns',
                    'Implement consistent logging with emoji prefixes',
                    'Use deltaTimeMs for all time-based calculations',
                    'Follow p5.js instance mode consistently'
                ]
            });
        }
        
        // Game-specific recommendations
        this.addGameSpecificRecommendations(debuggingResults);
    }

    /**
     * Add game-specific debugging recommendations
     */
    addGameSpecificRecommendations(debuggingResults) {
        // Check for common Vibe game issues
        const gameLoopIssues = debuggingResults.results.find(r => r.file.includes('GameLoop'));
        const playerIssues = debuggingResults.results.find(r => r.file.includes('player'));
        const enemyIssues = debuggingResults.results.filter(r => r.file.includes('Enemy'));
        
        // GameLoop specific
        if (gameLoopIssues?.analysis?.performance?.score < 80) {
            this.results.recommendations.push({
                priority: 'high',
                category: 'gameplay',
                title: 'Optimize Core Game Loop',
                description: 'GameLoop performance score is low, affecting overall game smoothness',
                actions: [
                    'Profile update() and draw() functions',
                    'Minimize object creation in game loop',
                    'Optimize entity update order',
                    'Consider frame rate limiting'
                ]
            });
        }
        
        // Player control issues
        if (playerIssues?.debuggingInsights?.gameplayRisks?.length > 0) {
            this.results.recommendations.push({
                priority: 'high',
                category: 'gameplay',
                title: 'Fix Player Control Issues',
                description: 'Issues detected in player code could affect game controls',
                actions: [
                    'Test player movement responsiveness',
                    'Verify input handling works at different frame rates',
                    'Check for input lag or missed inputs',
                    'Ensure player state is properly managed'
                ]
            });
        }
        
        // Enemy AI issues
        if (enemyIssues.some(e => e.debuggingInsights?.gameplayRisks?.length > 0)) {
            this.results.recommendations.push({
                priority: 'medium',
                category: 'gameplay',
                title: 'Improve Enemy AI Reliability',
                description: 'Issues in enemy code could cause erratic AI behavior',
                actions: [
                    'Test enemy pathfinding and targeting',
                    'Verify enemy spawning works correctly',
                    'Check for enemy state synchronization issues',
                    'Ensure enemy cleanup on death/despawn'
                ]
            });
        }
    }

    /**
     * Calculate overall probe status
     */
    calculateOverallStatus() {
        const criticalCount = this.results.criticalIssues.length;
        const performanceCount = this.results.performanceRisks.length;
        const healthScore = this.results.gameHealth.overallScore;
        
        if (criticalCount > 0 || healthScore < 50) {
            this.results.status = 'critical';
        } else if (performanceCount > 2 || healthScore < 80) {
            this.results.status = 'warning';
        } else {
            this.results.status = 'healthy';
        }
    }

    /**
     * Generate probe report
     */
    generateReport() {
        return {
            probe: this.name,
            version: this.version,
            timestamp: this.results.timestamp,
            status: this.results.status,
            gameHealth: this.results.gameHealth,
            summary: {
                criticalIssues: this.results.criticalIssues.length,
                performanceRisks: this.results.performanceRisks.length,
                systemicIssues: this.results.debuggingInsights.length,
                recommendations: this.results.recommendations.length
            },
            findings: {
                criticalIssues: this.results.criticalIssues,
                performanceRisks: this.results.performanceRisks,
                debuggingInsights: this.results.debuggingInsights
            },
            recommendations: this.results.recommendations
        };
    }
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameDebuggingProbe;
}

// Browser global
if (typeof window !== 'undefined') {
    window.GameDebuggingProbe = GameDebuggingProbe;
}

// Auto-execute if run directly
if (typeof require !== 'undefined' && require.main === module) {
    const probe = new GameDebuggingProbe();
    probe.execute().then(results => {
        console.log('🐛 Game Debugging Probe Results:');
        console.log(`🏥 Game Health Score: ${results.gameHealth.overallScore}/100`);
        console.log(`🚨 Critical Issues: ${results.criticalIssues.length}`);
        console.log(`⚡ Performance Risks: ${results.performanceRisks.length}`);
        console.log(`💡 Recommendations: ${results.recommendations.length}`);
        
        if (results.status === 'critical') {
            console.log('🚨 CRITICAL: Game has serious issues that need immediate attention!');
        } else if (results.status === 'warning') {
            console.log('⚠️ WARNING: Game has issues that should be addressed soon');
        } else {
            console.log('✅ HEALTHY: Game code is in good condition');
        }
    });
}
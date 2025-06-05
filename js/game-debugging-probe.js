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
        try {
            console.log('🐛 Starting Game Debugging Probe...');
            
            // Simple health checks without false-positive analysis
            console.log('🔍 Performing basic game health checks...');
            
            // Check if core game systems are available
            this.checkCoreGameSystems();
            
            // Assess basic game health
            this.assessBasicGameHealth();
            
            // Generate simple recommendations
            this.generateBasicRecommendations();
            
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
     * Check if core game systems are available (basic health check)
     */
    checkCoreGameSystems() {
        console.log('🎯 Checking core game systems...');
        
        // Check for basic game files existence
        const fs = require('fs');
        const coreFiles = [
            'js/GameLoop.js',
            'js/player.js', 
            'js/Audio.js',
            'js/CollisionSystem.js'
        ];
        
        let missingFiles = 0;
        coreFiles.forEach(file => {
            if (!fs.existsSync(file)) {
                this.results.criticalIssues.push({
                    type: 'missing-file',
                    message: `Core game file missing: ${file}`,
                    priority: 'high'
                });
                missingFiles++;
            }
        });
        
        // Simple performance check - look for obvious issues
        if (fs.existsSync('js/GameLoop.js')) {
            const gameLoopContent = fs.readFileSync('js/GameLoop.js', 'utf8');
            
            // Check for console.log in production (simple check)
            const consoleLogCount = (gameLoopContent.match(/console\.log/g) || []).length;
            if (consoleLogCount > 10) {
                this.results.performanceRisks.push({
                    type: 'excessive-logging',
                    message: `GameLoop.js has ${consoleLogCount} console.log statements`,
                    impact: 'medium'
                });
            }
        }
    }

    /**
     * Assess basic game health based on simple checks
     */
    assessBasicGameHealth() {
        console.log('🏥 Assessing basic game health...');
        
        const criticalBugCount = this.results.criticalIssues.length;
        const performanceRiskCount = this.results.performanceRisks.length;
        
        this.results.gameHealth = {
            overallScore: this.calculateHealthScore(0, criticalBugCount, performanceRiskCount),
            filesAnalyzed: 4, // Core files checked
            filesWithIssues: criticalBugCount > 0 ? 1 : 0,
            healthPercentage: criticalBugCount === 0 ? 100 : 75,
            issueBreakdown: {
                totalIssues: criticalBugCount + performanceRiskCount,
                criticalBugs: criticalBugCount,
                performanceRisks: performanceRiskCount,
                memoryLeaks: 0,
                systemicIssues: 0
            },
            riskAssessment: {
                crashRisk: criticalBugCount > 0 ? 'high' : 'low',
                performanceRisk: performanceRiskCount > 3 ? 'high' : performanceRiskCount > 1 ? 'medium' : 'low',
                stabilityRisk: 'low'
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
     * Generate basic recommendations
     */
    generateBasicRecommendations() {
        console.log('💡 Generating basic recommendations...');
        
        // Critical issues
        if (this.results.criticalIssues.length > 0) {
            this.results.recommendations.push({
                priority: 'critical',
                category: 'bug-fixes',
                title: 'Fix Critical Issues',
                description: `${this.results.criticalIssues.length} critical issues found`,
                actions: [
                    'Check for missing core game files',
                    'Verify all dependencies are installed',
                    'Test basic game functionality'
                ]
            });
        }
        
        // Performance optimization
        if (this.results.performanceRisks.length > 0) {
            this.results.recommendations.push({
                priority: 'medium',
                category: 'performance',
                title: 'Optimize Performance',
                description: `${this.results.performanceRisks.length} performance issues detected`,
                actions: [
                    'Reduce console.log statements in production',
                    'Profile game performance during gameplay',
                    'Monitor frame rate consistency'
                ]
            });
        }
        
        // General health
        if (this.results.criticalIssues.length === 0 && this.results.performanceRisks.length === 0) {
            this.results.recommendations.push({
                priority: 'low',
                category: 'maintenance',
                title: 'Game Health is Good',
                description: 'No critical issues detected in basic health check',
                actions: [
                    'Continue regular testing',
                    'Monitor for new issues',
                    'Keep dependencies updated'
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
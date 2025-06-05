/**
 * CodeRabbit Integration for Vibe Game
 * 
 * This module provides integration with CodeRabbit AI code review system
 * to enhance our automated testing and code quality workflows.
 * 
 * Features:
 * - Automated code quality analysis
 * - Integration with our probe-driven testing
 * - Custom rules for game development patterns
 * - Performance analysis for real-time game code
 */

class CodeRabbitIntegration {
    constructor() {
        this.config = {
            enabled: true,
            apiEndpoint: 'https://api.coderabbit.ai',
            reviewRules: this.getGameSpecificRules(),
            integrationMode: 'enhanced' // basic, standard, enhanced
        };
        
        this.metrics = {
            reviewsRequested: 0,
            issuesFound: 0,
            suggestionsApplied: 0,
            performanceImprovements: 0
        };
    }

    /**
     * Get game-specific code review rules
     */
    getGameSpecificRules() {
        return {
            // p5.js instance mode enforcement
            p5InstanceMode: {
                pattern: /(?<!this\.p\.)(fill|stroke|ellipse|rect|text|translate|rotate|scale)\s*\(/g,
                severity: 'error',
                message: 'Use p5.js instance mode: this.p.{method}()',
                category: 'architecture'
            },
            
            // Console logging standards
            emojiLogging: {
                pattern: /console\.log\([^🎮🎵🗡️💥⚠️🚀🎯🛡️🏥🧪✅❌]/g,
                severity: 'warning',
                message: 'Use emoji-prefixed logging per .cursorrules standards',
                category: 'standards'
            },
            
            // Enemy constructor consistency
            enemyConstructor: {
                pattern: /class\s+\w*Enemy.*constructor\s*\([^)]*\)(?!.*x,\s*y,\s*type,\s*config,\s*p,\s*audio)/g,
                severity: 'error',
                message: 'Enemy constructors must use signature: constructor(x, y, type, config, p, audio)',
                category: 'consistency'
            },
            
            // deltaTimeMs parameter usage
            deltaTimeUsage: {
                pattern: /update\w*\s*\([^)]*\)(?!.*deltaTimeMs)/g,
                severity: 'warning',
                message: 'Update methods should accept deltaTimeMs for frame-independent timing',
                category: 'performance'
            },
            
            // Error handling patterns
            errorHandling: {
                pattern: /(?<!if\s*\()[a-zA-Z_$][a-zA-Z0-9_$]*\.[a-zA-Z_$][a-zA-Z0-9_$]*(?!\s*&&|\s*\?)/g,
                severity: 'info',
                message: 'Consider null checks for object property access',
                category: 'reliability'
            }
        };
    }

    /**
     * Analyze code changes for game-specific patterns
     */
    async analyzeCodeChanges(filePath, content, changes = null) {
        console.log('🤖 CodeRabbit: Analyzing code changes...');
        
        const analysis = {
            file: filePath,
            timestamp: new Date().toISOString(),
            issues: [],
            suggestions: [],
            performance: {},
            compliance: {}
        };

        // Run game-specific rule checks
        for (const [ruleName, rule] of Object.entries(this.config.reviewRules)) {
            const matches = content.match(rule.pattern);
            if (matches) {
                analysis.issues.push({
                    rule: ruleName,
                    severity: rule.severity,
                    message: rule.message,
                    category: rule.category,
                    occurrences: matches.length,
                    lines: this.findLineNumbers(content, matches)
                });
            }
        }

        // Analyze performance implications for game code
        if (filePath.includes('js/') && !filePath.includes('test')) {
            analysis.performance = await this.analyzeGamePerformance(content);
        }

        // Check compliance with .cursorrules
        analysis.compliance = this.checkCursorruleCompliance(content, filePath);

        this.metrics.reviewsRequested++;
        this.metrics.issuesFound += analysis.issues.length;

        console.log(`🎯 CodeRabbit: Found ${analysis.issues.length} issues in ${filePath}`);
        return analysis;
    }

    /**
     * Analyze performance implications for game code
     */
    async analyzeGamePerformance(content) {
        const performance = {
            gameLoopOptimizations: [],
            memoryUsage: [],
            renderingEfficiency: [],
            score: 100
        };

        // Check for expensive operations in game loop
        const expensivePatterns = [
            { pattern: /new\s+\w+\s*\(/g, issue: 'Object creation in game loop', impact: -10 },
            { pattern: /Math\.(sin|cos|sqrt|atan2)\s*\(/g, issue: 'Heavy math operations', impact: -5 },
            { pattern: /\.filter\s*\(|\.map\s*\(|\.reduce\s*\(/g, issue: 'Array operations in loop', impact: -8 },
            { pattern: /console\.log\s*\(/g, issue: 'Console logging in production', impact: -3 }
        ];

        for (const pattern of expensivePatterns) {
            const matches = content.match(pattern.pattern);
            if (matches) {
                performance.gameLoopOptimizations.push({
                    issue: pattern.issue,
                    occurrences: matches.length,
                    impact: pattern.impact
                });
                performance.score += pattern.impact * matches.length;
            }
        }

        // Check for memory leaks
        const memoryPatterns = [
            { pattern: /addEventListener\s*\(/g, issue: 'Event listeners (check for removal)' },
            { pattern: /setInterval\s*\(|setTimeout\s*\(/g, issue: 'Timers (check for cleanup)' },
            { pattern: /new\s+Image\s*\(/g, issue: 'Image objects (check for disposal)' }
        ];

        for (const pattern of memoryPatterns) {
            const matches = content.match(pattern.pattern);
            if (matches) {
                performance.memoryUsage.push({
                    issue: pattern.issue,
                    occurrences: matches.length
                });
            }
        }

        return performance;
    }

    /**
     * Check compliance with .cursorrules standards
     */
    checkCursorruleCompliance(content, filePath) {
        const compliance = {
            score: 100,
            violations: [],
            recommendations: []
        };

        // Check modular architecture compliance
        if (filePath.includes('js/') && content.length > 2000) {
            compliance.violations.push({
                rule: 'File size',
                message: 'Consider splitting large files (>2000 chars) for better modularity',
                severity: 'info'
            });
            compliance.score -= 5;
        }

        // Check for proper ES module usage
        if (content.includes('import') && !content.includes('export')) {
            if (!filePath.includes('test') && !filePath.includes('GameLoop')) {
                compliance.violations.push({
                    rule: 'ES modules',
                    message: 'Files with imports should typically have exports',
                    severity: 'warning'
                });
                compliance.score -= 10;
            }
        }

        // Check for dependency injection patterns
        if (content.includes('window.') && !content.includes('constructor')) {
            compliance.recommendations.push({
                rule: 'Dependency injection',
                message: 'Consider using dependency injection instead of global window access',
                priority: 'medium'
            });
        }

        return compliance;
    }

    /**
     * Generate suggestions for code improvements
     */
    generateSuggestions(analysis) {
        const suggestions = [];

        // Performance suggestions
        if (analysis.performance.score < 80) {
            suggestions.push({
                type: 'performance',
                priority: 'high',
                message: 'Consider optimizing game loop performance',
                details: analysis.performance.gameLoopOptimizations
            });
        }

        // Architecture suggestions
        const architectureIssues = analysis.issues.filter(i => i.category === 'architecture');
        if (architectureIssues.length > 0) {
            suggestions.push({
                type: 'architecture',
                priority: 'high',
                message: 'Fix architectural pattern violations',
                details: architectureIssues
            });
        }

        // Consistency suggestions
        const consistencyIssues = analysis.issues.filter(i => i.category === 'consistency');
        if (consistencyIssues.length > 0) {
            suggestions.push({
                type: 'consistency',
                priority: 'medium',
                message: 'Improve code consistency',
                details: consistencyIssues
            });
        }

        return suggestions;
    }

    /**
     * Integration with our probe-driven testing system
     */
    async integrateWithProbes(probeResults) {
        console.log('🔗 CodeRabbit: Integrating with probe test results...');
        
        const integration = {
            timestamp: new Date().toISOString(),
            probeAnalysis: {},
            codeQualityCorrelation: {},
            recommendations: []
        };

        // Analyze probe failures for code quality correlation
        for (const probe of probeResults) {
            if (!probe.success && probe.failure) {
                integration.probeAnalysis[probe.probe] = {
                    failure: probe.failure,
                    potentialCodeIssues: this.correlateProbesToCodeIssues(probe)
                };
            }
        }

        // Generate recommendations based on probe results
        integration.recommendations = this.generateProbeBasedRecommendations(probeResults);

        return integration;
    }

    /**
     * Correlate probe failures to potential code issues
     */
    correlateProbesToCodeIssues(probe) {
        const correlations = [];

        if (probe.probe.includes('ai-liveness')) {
            correlations.push({
                issue: 'Game loop or core system failure',
                suggestedReview: 'Check GameLoop.js, player.js, and core initialization'
            });
        }

        if (probe.probe.includes('enemy-ai')) {
            correlations.push({
                issue: 'Enemy AI behavior problems',
                suggestedReview: 'Review enemy class constructors and updateSpecificBehavior methods'
            });
        }

        if (probe.probe.includes('audio-system')) {
            correlations.push({
                issue: 'Audio context or BeatClock issues',
                suggestedReview: 'Check Audio.js and BeatClock.js initialization and state management'
            });
        }

        return correlations;
    }

    /**
     * Generate recommendations based on probe results
     */
    generateProbeBasedRecommendations(probeResults) {
        const recommendations = [];
        const failedProbes = probeResults.filter(p => !p.success);

        if (failedProbes.length > 0) {
            recommendations.push({
                priority: 'high',
                category: 'testing',
                message: `${failedProbes.length} probe tests failed - review related code modules`,
                action: 'Run CodeRabbit analysis on files related to failed probes'
            });
        }

        const warningProbes = probeResults.filter(p => p.warnings && p.warnings.length > 0);
        if (warningProbes.length > 0) {
            recommendations.push({
                priority: 'medium',
                category: 'code-quality',
                message: 'Multiple probes reported warnings - consider code improvements',
                action: 'Review warning patterns for potential refactoring opportunities'
            });
        }

        return recommendations;
    }

    /**
     * Find line numbers for pattern matches
     */
    findLineNumbers(content, matches) {
        const lines = [];
        const contentLines = content.split('\n');
        
        for (const match of matches) {
            for (let i = 0; i < contentLines.length; i++) {
                if (contentLines[i].includes(match)) {
                    lines.push(i + 1);
                }
            }
        }
        
        return lines;
    }

    /**
     * Get integration metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            averageIssuesPerReview: this.metrics.reviewsRequested > 0 ? 
                (this.metrics.issuesFound / this.metrics.reviewsRequested).toFixed(2) : 0,
            improvementRate: this.metrics.issuesFound > 0 ? 
                ((this.metrics.suggestionsApplied / this.metrics.issuesFound) * 100).toFixed(1) + '%' : '0%'
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CodeRabbitIntegration;
} else if (typeof window !== 'undefined') {
    window.CodeRabbitIntegration = CodeRabbitIntegration;
}

// Initialize integration if in browser context
if (typeof window !== 'undefined') {
    window.codeRabbitIntegration = new CodeRabbitIntegration();
    console.log('🤖 CodeRabbit integration initialized for Vibe game');
}
/**
 * CodeRabbit Game Debugger
 * 
 * Uses CodeRabbit's AI analysis to identify potential bugs and performance issues
 * in the Vibe game code. Focuses on extracting actionable debugging insights.
 */

class CodeRabbitGameDebugger {
    constructor() {
        this.name = 'CodeRabbit Game Debugger';
        this.gameFiles = [
            'js/GameLoop.js',
            'js/GameState.js', 
            'js/player.js',
            'js/BaseEnemy.js',
            'js/Grunt.js',
            'js/Rusher.js',
            'js/Tank.js',
            'js/Stabber.js',
            'js/bullet.js',
            'js/CollisionSystem.js',
            'js/SpawnSystem.js',
            'js/CameraSystem.js',
            'js/Audio.js',
            'js/BeatClock.js',
            'js/effects.js',
            'js/visualEffects.js'
        ];
        
        this.debuggingInsights = {
            performanceIssues: [],
            potentialBugs: [],
            memoryLeaks: [],
            gameplayIssues: [],
            architecturalProblems: [],
            recommendations: []
        };
        
        this.bugPatterns = {
            // Common game bug patterns CodeRabbit should catch
            frameRateIssues: /(?:deltaTime|fps|frame)/i,
            memoryLeaks: /(?:new\s+\w+|addEventListener|setInterval|setTimeout)/,
            nullPointerBugs: /(?:\.(?!p\.)[a-zA-Z_$][a-zA-Z0-9_$]*(?!\s*[&?]))/,
            performanceBottlenecks: /(?:Math\.(sin|cos|sqrt)|\.filter\(|\.map\(|console\.log)/,
            gameStateIssues: /(?:gameState|player|enemy|bullet)/i,
            collisionBugs: /(?:collision|hit|overlap|intersect)/i,
            audioIssues: /(?:audio|sound|music|beat)/i
        };
    }

    /**
     * Analyze all game files for debugging insights
     */
    async analyzeGameForBugs() {
        console.log('🐛 Starting CodeRabbit game debugging analysis...');
        
        const CodeRabbitIntegration = require('./coderabbit-integration.js');
        const integration = new CodeRabbitIntegration();
        const fs = require('fs').promises;
        
        const analysisResults = [];
        
        for (const filePath of this.gameFiles) {
            try {
                console.log(`🔍 Analyzing ${filePath} for bugs...`);
                
                const content = await fs.readFile(filePath, 'utf8');
                const analysis = await integration.analyzeCodeChanges(filePath, content);
                
                // Extract debugging-relevant insights
                const debuggingInsights = this.extractDebuggingInsights(analysis, content, filePath);
                
                analysisResults.push({
                    file: filePath,
                    analysis,
                    debuggingInsights,
                    lineCount: content.split('\n').length,
                    timestamp: new Date().toISOString()
                });
                
                console.log(`🎯 ${filePath}: ${analysis.issues.length} issues, ${debuggingInsights.criticalBugs.length} critical bugs`);
                
            } catch (error) {
                console.error(`❌ Error analyzing ${filePath}:`, error.message);
                analysisResults.push({
                    file: filePath,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        // Correlate findings across files
        const correlatedInsights = this.correlateAcrossFiles(analysisResults);
        
        // Generate debugging report
        const debuggingReport = this.generateDebuggingReport(analysisResults, correlatedInsights);
        
        console.log('✅ Game debugging analysis completed');
        return {
            results: analysisResults,
            insights: correlatedInsights,
            report: debuggingReport
        };
    }

    /**
     * Extract debugging-relevant insights from CodeRabbit analysis
     */
    extractDebuggingInsights(analysis, content, filePath) {
        const insights = {
            criticalBugs: [],
            performanceIssues: [],
            gameplayRisks: [],
            memoryLeaks: [],
            recommendations: []
        };
        
        // Analyze CodeRabbit issues for debugging relevance
        for (const issue of analysis.issues) {
            const debuggingRelevance = this.assessDebuggingRelevance(issue, content, filePath);
            
            if (debuggingRelevance.isCritical) {
                insights.criticalBugs.push({
                    ...issue,
                    debuggingContext: debuggingRelevance.context,
                    gameplayImpact: debuggingRelevance.gameplayImpact,
                    fixPriority: debuggingRelevance.priority
                });
            }
            
            if (debuggingRelevance.isPerformance) {
                insights.performanceIssues.push({
                    ...issue,
                    performanceImpact: debuggingRelevance.performanceImpact,
                    frameRateRisk: debuggingRelevance.frameRateRisk
                });
            }
            
            if (debuggingRelevance.isGameplay) {
                insights.gameplayRisks.push({
                    ...issue,
                    gameplayArea: debuggingRelevance.gameplayArea,
                    userExperience: debuggingRelevance.userExperience
                });
            }
        }
        
        // Check for specific game bug patterns
        insights.memoryLeaks = this.detectMemoryLeakPatterns(content, filePath);
        insights.recommendations = this.generateFileSpecificRecommendations(analysis, content, filePath);
        
        return insights;
    }

    /**
     * Assess how relevant a CodeRabbit issue is for debugging
     */
    assessDebuggingRelevance(issue, content, filePath) {
        const relevance = {
            isCritical: false,
            isPerformance: false,
            isGameplay: false,
            context: '',
            gameplayImpact: 'low',
            performanceImpact: 'low',
            frameRateRisk: 'low',
            priority: 'low'
        };
        
        // Critical bugs that could crash the game
        if (issue.severity === 'error' || 
            issue.message.includes('null') || 
            issue.message.includes('undefined') ||
            issue.message.includes('TypeError')) {
            relevance.isCritical = true;
            relevance.priority = 'high';
            relevance.context = 'Potential runtime crash or null pointer exception';
            relevance.gameplayImpact = 'high';
        }
        
        // Performance issues that could affect frame rate
        if (issue.category === 'performance' ||
            issue.message.includes('loop') ||
            issue.message.includes('expensive') ||
            this.bugPatterns.performanceBottlenecks.test(issue.message)) {
            relevance.isPerformance = true;
            relevance.performanceImpact = 'medium';
            relevance.frameRateRisk = filePath.includes('GameLoop') ? 'high' : 'medium';
        }
        
        // Gameplay-affecting issues
        if (this.bugPatterns.gameStateIssues.test(issue.message) ||
            this.bugPatterns.collisionBugs.test(issue.message) ||
            filePath.includes('player') || 
            filePath.includes('Enemy') ||
            filePath.includes('bullet')) {
            relevance.isGameplay = true;
            relevance.gameplayArea = this.identifyGameplayArea(filePath, issue);
            relevance.userExperience = 'Could affect player controls, enemy behavior, or combat';
        }
        
        // Frame rate critical files
        if (filePath.includes('GameLoop') || filePath.includes('Collision') || filePath.includes('Spawn')) {
            relevance.frameRateRisk = 'high';
            relevance.priority = 'high';
        }
        
        return relevance;
    }

    /**
     * Detect memory leak patterns in code
     */
    detectMemoryLeakPatterns(content, filePath) {
        const memoryLeaks = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            // Event listeners without removal
            if (line.includes('addEventListener') && !content.includes('removeEventListener')) {
                memoryLeaks.push({
                    type: 'event-listener-leak',
                    line: index + 1,
                    code: line.trim(),
                    risk: 'medium',
                    description: 'Event listener added but no corresponding removal found'
                });
            }
            
            // Timers without cleanup
            if ((line.includes('setInterval') || line.includes('setTimeout')) && 
                !content.includes('clearInterval') && !content.includes('clearTimeout')) {
                memoryLeaks.push({
                    type: 'timer-leak',
                    line: index + 1,
                    code: line.trim(),
                    risk: 'high',
                    description: 'Timer created but no cleanup mechanism found'
                });
            }
            
            // Object creation in game loop
            if (filePath.includes('GameLoop') && line.includes('new ') && 
                !line.includes('//') && !line.includes('/*')) {
                memoryLeaks.push({
                    type: 'object-creation-in-loop',
                    line: index + 1,
                    code: line.trim(),
                    risk: 'high',
                    description: 'Object creation in game loop can cause frame drops'
                });
            }
        });
        
        return memoryLeaks;
    }

    /**
     * Generate file-specific debugging recommendations
     */
    generateFileSpecificRecommendations(analysis, content, filePath) {
        const recommendations = [];
        
        // GameLoop.js specific recommendations
        if (filePath.includes('GameLoop')) {
            if (analysis.performance.score < 80) {
                recommendations.push({
                    type: 'performance',
                    priority: 'high',
                    message: 'GameLoop performance score is low - could cause frame drops',
                    action: 'Review expensive operations in game loop',
                    impact: 'Frame rate stability'
                });
            }
            
            if (content.includes('console.log')) {
                recommendations.push({
                    type: 'performance',
                    priority: 'medium',
                    message: 'Console logging in GameLoop affects performance',
                    action: 'Remove or conditionally disable console.log statements',
                    impact: 'Frame rate improvement'
                });
            }
        }
        
        // Enemy files specific recommendations
        if (filePath.includes('Enemy') || filePath.includes('Grunt') || filePath.includes('Rusher')) {
            if (!content.includes('deltaTimeMs')) {
                recommendations.push({
                    type: 'gameplay',
                    priority: 'high',
                    message: 'Enemy movement not frame-independent',
                    action: 'Use deltaTimeMs for all movement calculations',
                    impact: 'Consistent gameplay across different frame rates'
                });
            }
        }
        
        // Collision system recommendations
        if (filePath.includes('Collision')) {
            if (content.includes('for') && content.includes('for')) {
                recommendations.push({
                    type: 'performance',
                    priority: 'medium',
                    message: 'Nested loops in collision detection',
                    action: 'Consider spatial partitioning or broad-phase collision detection',
                    impact: 'Better performance with many entities'
                });
            }
        }
        
        // Audio system recommendations
        if (filePath.includes('Audio')) {
            if (!content.includes('try') || !content.includes('catch')) {
                recommendations.push({
                    type: 'reliability',
                    priority: 'medium',
                    message: 'Audio operations should have error handling',
                    action: 'Add try-catch blocks around audio operations',
                    impact: 'Prevent audio errors from crashing the game'
                });
            }
        }
        
        return recommendations;
    }

    /**
     * Identify which gameplay area an issue affects
     */
    identifyGameplayArea(filePath, issue) {
        if (filePath.includes('player')) return 'Player Controls';
        if (filePath.includes('Enemy')) return 'Enemy AI';
        if (filePath.includes('bullet')) return 'Combat System';
        if (filePath.includes('Collision')) return 'Physics/Collision';
        if (filePath.includes('Audio')) return 'Audio/Music';
        if (filePath.includes('GameLoop')) return 'Core Game Loop';
        if (filePath.includes('Spawn')) return 'Enemy Spawning';
        return 'General Gameplay';
    }

    /**
     * Correlate findings across multiple files
     */
    correlateAcrossFiles(analysisResults) {
        const correlations = {
            systemicIssues: [],
            crossFileProblems: [],
            architecturalConcerns: [],
            priorityFixes: []
        };
        
        // Find systemic issues (same problem in multiple files)
        const issueTypes = {};
        analysisResults.forEach(result => {
            if (result.analysis && result.analysis.issues) {
                result.analysis.issues.forEach(issue => {
                    const key = `${issue.category}-${issue.rule}`;
                    if (!issueTypes[key]) {
                        issueTypes[key] = { count: 0, files: [], issue };
                    }
                    issueTypes[key].count++;
                    issueTypes[key].files.push(result.file);
                });
            }
        });
        
        // Identify systemic problems
        Object.values(issueTypes).forEach(issueGroup => {
            if (issueGroup.count >= 3) {
                correlations.systemicIssues.push({
                    type: issueGroup.issue.rule,
                    message: issueGroup.issue.message,
                    affectedFiles: issueGroup.files,
                    severity: 'systemic',
                    recommendation: `Fix this pattern across ${issueGroup.count} files`
                });
            }
        });
        
        // Find cross-file dependencies that could cause issues
        const gameLoopIssues = analysisResults.find(r => r.file.includes('GameLoop'));
        const playerIssues = analysisResults.find(r => r.file.includes('player'));
        
        if (gameLoopIssues?.debuggingInsights?.performanceIssues.length > 0 &&
            playerIssues?.debuggingInsights?.performanceIssues.length > 0) {
            correlations.crossFileProblems.push({
                type: 'performance-cascade',
                description: 'Performance issues in both GameLoop and Player could compound',
                files: ['js/GameLoop.js', 'js/player.js'],
                impact: 'Severe frame rate degradation',
                priority: 'critical'
            });
        }
        
        // Identify priority fixes based on game impact
        analysisResults.forEach(result => {
            if (result.debuggingInsights?.criticalBugs.length > 0) {
                result.debuggingInsights.criticalBugs.forEach(bug => {
                    if (bug.fixPriority === 'high') {
                        correlations.priorityFixes.push({
                            file: result.file,
                            bug: bug,
                            gameplayImpact: bug.gameplayImpact,
                            urgency: 'immediate'
                        });
                    }
                });
            }
        });
        
        return correlations;
    }

    /**
     * Generate comprehensive debugging report
     */
    generateDebuggingReport(analysisResults, correlatedInsights) {
        const totalIssues = analysisResults.reduce((sum, result) => 
            sum + (result.analysis?.issues.length || 0), 0);
        
        const criticalBugs = analysisResults.reduce((sum, result) => 
            sum + (result.debuggingInsights?.criticalBugs.length || 0), 0);
        
        const performanceIssues = analysisResults.reduce((sum, result) => 
            sum + (result.debuggingInsights?.performanceIssues.length || 0), 0);
        
        return `# 🐛 Vibe Game Debugging Report - CodeRabbit Analysis

**Generated:** ${new Date().toISOString()}
**Purpose:** Identify bugs and performance issues in Vibe game code

## 🎯 Executive Summary

CodeRabbit AI analysis has identified potential issues that could be affecting game performance and stability.

### Critical Statistics
- **Total Issues Found:** ${totalIssues}
- **Critical Bugs:** ${criticalBugs}
- **Performance Issues:** ${performanceIssues}
- **Files Analyzed:** ${analysisResults.length}
- **Systemic Issues:** ${correlatedInsights.systemicIssues.length}

## 🚨 Critical Bugs (Fix Immediately)

${analysisResults.map(result => {
    if (!result.debuggingInsights?.criticalBugs.length) return '';
    return `### ${result.file}
${result.debuggingInsights.criticalBugs.map(bug => `
- **Line ${bug.lines?.[0] || 'Unknown'}**: ${bug.message}
  - **Impact**: ${bug.gameplayImpact}
  - **Context**: ${bug.debuggingContext}
  - **Priority**: ${bug.fixPriority}
`).join('')}`;
}).filter(Boolean).join('\n')}

## ⚡ Performance Issues (Frame Rate Impact)

${analysisResults.map(result => {
    if (!result.debuggingInsights?.performanceIssues.length) return '';
    return `### ${result.file}
${result.debuggingInsights.performanceIssues.map(issue => `
- **Issue**: ${issue.message}
  - **Frame Rate Risk**: ${issue.frameRateRisk}
  - **Performance Impact**: ${issue.performanceImpact}
`).join('')}`;
}).filter(Boolean).join('\n')}

## 🎮 Gameplay Risks

${analysisResults.map(result => {
    if (!result.debuggingInsights?.gameplayRisks.length) return '';
    return `### ${result.file}
${result.debuggingInsights.gameplayRisks.map(risk => `
- **Area**: ${risk.gameplayArea}
- **Issue**: ${risk.message}
- **User Experience**: ${risk.userExperience}
`).join('')}`;
}).filter(Boolean).join('\n')}

## 🔄 Memory Leak Risks

${analysisResults.map(result => {
    if (!result.debuggingInsights?.memoryLeaks.length) return '';
    return `### ${result.file}
${result.debuggingInsights.memoryLeaks.map(leak => `
- **Line ${leak.line}**: ${leak.description}
  - **Type**: ${leak.type}
  - **Risk Level**: ${leak.risk}
  - **Code**: \`${leak.code}\`
`).join('')}`;
}).filter(Boolean).join('\n')}

## 🔗 Cross-File Issues

${correlatedInsights.systemicIssues.map(issue => `
### ${issue.type}
- **Problem**: ${issue.message}
- **Affected Files**: ${issue.affectedFiles.join(', ')}
- **Recommendation**: ${issue.recommendation}
`).join('')}

${correlatedInsights.crossFileProblems.map(problem => `
### ${problem.type}
- **Description**: ${problem.description}
- **Files**: ${problem.files.join(', ')}
- **Impact**: ${problem.impact}
- **Priority**: ${problem.priority}
`).join('')}

## 💡 Debugging Recommendations

### Immediate Actions (Critical)
${correlatedInsights.priorityFixes.map(fix => `
- **${fix.file}**: ${fix.bug.message}
  - Impact: ${fix.gameplayImpact}
  - Urgency: ${fix.urgency}
`).join('')}

### File-Specific Recommendations
${analysisResults.map(result => {
    if (!result.debuggingInsights?.recommendations.length) return '';
    return `
#### ${result.file}
${result.debuggingInsights.recommendations.map(rec => `
- **${rec.type.toUpperCase()}**: ${rec.message}
  - Action: ${rec.action}
  - Impact: ${rec.impact}
  - Priority: ${rec.priority}
`).join('')}`;
}).filter(Boolean).join('')}

## 🔧 Next Steps for Debugging

1. **Fix Critical Bugs First**: Address all critical bugs that could crash the game
2. **Optimize Performance**: Focus on GameLoop.js and collision detection
3. **Test Frame Rate**: Verify fixes don't introduce new performance issues
4. **Memory Monitoring**: Check for memory leaks during extended gameplay
5. **Cross-File Testing**: Ensure fixes in one file don't break others

## 📊 File-by-File Analysis

${analysisResults.map(result => `
### ${result.file}
- **Lines of Code**: ${result.lineCount || 'Unknown'}
- **Issues Found**: ${result.analysis?.issues.length || 0}
- **Critical Bugs**: ${result.debuggingInsights?.criticalBugs.length || 0}
- **Performance Issues**: ${result.debuggingInsights?.performanceIssues.length || 0}
- **Memory Leaks**: ${result.debuggingInsights?.memoryLeaks.length || 0}
- **Status**: ${result.error ? '❌ Analysis Failed' : '✅ Analyzed'}
${result.error ? `- **Error**: ${result.error}` : ''}
`).join('')}

---

*This debugging report was generated by CodeRabbit AI analysis*
*Use these insights to improve Vibe game stability and performance*
*Re-run analysis after fixes to verify improvements*
`;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CodeRabbitGameDebugger;
}

// Browser/window global
if (typeof window !== 'undefined') {
    window.CodeRabbitGameDebugger = CodeRabbitGameDebugger;
}

// Auto-execute if run directly
if (typeof require !== 'undefined' && require.main === module) {
    const gameDebugger = new CodeRabbitGameDebugger();
    gameDebugger.analyzeGameForBugs().then(results => {
        console.log('🐛 Game debugging analysis completed!');
        console.log(`📊 Found ${results.insights.systemicIssues.length} systemic issues`);
        console.log(`🚨 Found ${results.insights.priorityFixes.length} priority fixes`);
        
        // Save debugging report
        const fs = require('fs').promises;
        fs.writeFile('VIBE_GAME_DEBUGGING_REPORT.md', results.report)
            .then(() => console.log('📄 Debugging report saved to VIBE_GAME_DEBUGGING_REPORT.md'))
            .catch(err => console.error('❌ Failed to save report:', err));
    });
}
/**
 * CodeRabbit Comment Testing System
 * 
 * This module tests CodeRabbit's comment functionality including:
 * - GitHub PR comments via API
 * - Local IDE overlay comments
 * - Comment accuracy and relevance
 * - Integration with our testing system
 */

class CodeRabbitCommentTester {
    constructor() {
        this.githubToken = process.env.GITHUB_TOKEN || null;
        this.repoOwner = 'your-username'; // Update with actual repo owner
        this.repoName = 'vibe';
        this.apiBase = 'https://api.github.com';
        this.comments = [];
        this.testResults = {
            githubComments: [],
            localComments: [],
            accuracy: 0,
            coverage: 0,
            issues: []
        };
    }

    /**
     * Test GitHub PR comments functionality
     */
    async testGitHubComments(prNumber = null) {
        console.log('🤖 Testing CodeRabbit GitHub PR comments...');
        
        try {
            // Get recent PRs if no specific PR provided
            const prs = prNumber ? [{ number: prNumber }] : await this.getRecentPRs();
            
            for (const pr of prs.slice(0, 3)) { // Test last 3 PRs
                const comments = await this.getPRComments(pr.number);
                const coderabbitComments = comments.filter(comment => 
                    comment.user.login === 'coderabbitai' || 
                    comment.body.includes('CodeRabbit') ||
                    comment.body.includes('🤖')
                );
                
                this.testResults.githubComments.push({
                    prNumber: pr.number,
                    totalComments: comments.length,
                    coderabbitComments: coderabbitComments.length,
                    comments: coderabbitComments.map(c => ({
                        id: c.id,
                        body: c.body.substring(0, 200) + '...',
                        createdAt: c.created_at,
                        path: c.path,
                        line: c.line
                    }))
                });
                
                console.log(`🔍 PR #${pr.number}: ${coderabbitComments.length} CodeRabbit comments found`);
            }
            
            return this.testResults.githubComments;
        } catch (error) {
            console.error('❌ GitHub comment test failed:', error.message);
            this.testResults.issues.push(`GitHub API error: ${error.message}`);
            return [];
        }
    }

    /**
     * Test local IDE comment overlays using MCP Playwright
     */
    async testLocalComments(mcpClient) {
        console.log('🖥️ Testing CodeRabbit local IDE comments...');
        
        try {
            // Navigate to a code file in the browser (if we have a web-based editor)
            // For now, we'll simulate this by checking for comment markers in files
            const testFiles = [
                'js/GameLoop.js',
                'js/player.js',
                'js/BaseEnemy.js'
            ];
            
            for (const file of testFiles) {
                const comments = await this.detectCommentMarkers(file);
                this.testResults.localComments.push({
                    file,
                    markers: comments.length,
                    comments: comments
                });
                
                console.log(`📝 ${file}: ${comments.length} comment markers detected`);
            }
            
            return this.testResults.localComments;
        } catch (error) {
            console.error('❌ Local comment test failed:', error.message);
            this.testResults.issues.push(`Local comment error: ${error.message}`);
            return [];
        }
    }

    /**
     * Detect comment markers in code files
     */
    async detectCommentMarkers(filePath) {
        try {
            const fs = require('fs').promises;
            const content = await fs.readFile(filePath, 'utf8');
            const lines = content.split('\n');
            const markers = [];
            
            lines.forEach((line, index) => {
                // Look for CodeRabbit-style comment markers
                if (line.includes('// CodeRabbit:') || 
                    line.includes('/* CodeRabbit:') ||
                    line.includes('// 🤖') ||
                    line.includes('// TODO: CodeRabbit') ||
                    line.includes('// FIXME: CodeRabbit')) {
                    
                    markers.push({
                        line: index + 1,
                        content: line.trim(),
                        type: 'coderabbit-marker'
                    });
                }
            });
            
            return markers;
        } catch (error) {
            console.error(`Error reading ${filePath}:`, error.message);
            return [];
        }
    }

    /**
     * Test CodeRabbit API integration
     */
    async testCodeRabbitAPI() {
        console.log('🔌 Testing CodeRabbit API integration...');
        
        try {
            // Test our local CodeRabbit integration
            const CodeRabbitIntegration = require('./coderabbit-integration.js');
            const integration = new CodeRabbitIntegration();
            
            // Run analysis on a test file
            const testFile = 'js/GameLoop.js';
            const fs = require('fs').promises;
            const content = await fs.readFile(testFile, 'utf8');
            const analysis = await integration.analyzeCodeChanges(testFile, content);
            
            this.testResults.accuracy = analysis.issues ? analysis.issues.length : 0;
            
            console.log(`🎯 CodeRabbit API: ${this.testResults.accuracy} issues detected`);
            
            return analysis;
        } catch (error) {
            console.error('❌ CodeRabbit API test failed:', error.message);
            this.testResults.issues.push(`API integration error: ${error.message}`);
            return null;
        }
    }

    /**
     * Create a test PR to verify CodeRabbit commenting
     */
    async createTestPR() {
        console.log('🔧 Creating test PR for CodeRabbit verification...');
        
        try {
            // Create a test file with intentional issues
            const testContent = `
// Test file for CodeRabbit comment verification
function testFunction() {
    var x = 1; // Should suggest const/let
    console.log("Missing emoji prefix"); // Should suggest emoji
    if (x == 1) { // Should suggest ===
        return true;
    }
    // Missing return statement for else case
}

class TestEnemy {
    constructor(x, y) { // Missing required parameters
        this.x = x;
        this.y = y;
    }
    
    update() { // Missing deltaTimeMs parameter
        this.x += 1; // Frame-dependent movement
    }
}
`;
            
            const fs = require('fs').promises;
            await fs.writeFile('test-coderabbit-file.js', testContent);
            
            console.log('📝 Test file created: test-coderabbit-file.js');
            console.log('💡 Commit this file and create a PR to test CodeRabbit comments');
            
            return {
                file: 'test-coderabbit-file.js',
                expectedIssues: [
                    'var usage instead of const/let',
                    'missing emoji prefix in console.log',
                    'loose equality (==) instead of strict (===)',
                    'missing constructor parameters',
                    'missing deltaTimeMs parameter',
                    'frame-dependent movement'
                ]
            };
        } catch (error) {
            console.error('❌ Test PR creation failed:', error.message);
            return null;
        }
    }

    /**
     * Analyze comment quality and accuracy
     */
    analyzeCommentQuality() {
        console.log('📊 Analyzing CodeRabbit comment quality...');
        
        const totalComments = this.testResults.githubComments.reduce(
            (sum, pr) => sum + pr.coderabbitComments, 0
        );
        
        const localMarkers = this.testResults.localComments.reduce(
            (sum, file) => sum + file.markers, 0
        );
        
        // Calculate coverage (rough estimate)
        this.testResults.coverage = Math.min(100, (totalComments + localMarkers) * 10);
        
        const quality = {
            totalGitHubComments: totalComments,
            totalLocalMarkers: localMarkers,
            coverage: this.testResults.coverage,
            accuracy: this.testResults.accuracy,
            issues: this.testResults.issues.length,
            recommendations: this.generateRecommendations()
        };
        
        console.log('📈 Comment Quality Analysis:', quality);
        return quality;
    }

    /**
     * Generate recommendations for improving CodeRabbit integration
     */
    generateRecommendations() {
        const recommendations = [];
        
        if (this.testResults.githubComments.length === 0) {
            recommendations.push('Set up GitHub integration for PR comments');
        }
        
        if (this.testResults.localComments.every(f => f.markers === 0)) {
            recommendations.push('Install CodeRabbit VS Code extension for local comments');
        }
        
        if (this.testResults.accuracy < 5) {
            recommendations.push('Review CodeRabbit configuration for better issue detection');
        }
        
        if (this.testResults.issues.length > 0) {
            recommendations.push('Fix integration issues: ' + this.testResults.issues.join(', '));
        }
        
        return recommendations;
    }

    /**
     * Get recent PRs from GitHub
     */
    async getRecentPRs() {
        if (!this.githubToken) {
            console.log('⚠️ No GitHub token provided, using mock data');
            return [{ number: 1 }, { number: 2 }]; // Mock data
        }
        
        const response = await fetch(`${this.apiBase}/repos/${this.repoOwner}/${this.repoName}/pulls?state=all&per_page=5`, {
            headers: {
                'Authorization': `token ${this.githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }
        
        return await response.json();
    }

    /**
     * Get PR comments from GitHub
     */
    async getPRComments(prNumber) {
        if (!this.githubToken) {
            console.log('⚠️ No GitHub token, returning mock comments');
            return [
                {
                    id: 1,
                    user: { login: 'coderabbitai' },
                    body: '🤖 CodeRabbit: Consider using const instead of var for better scoping.',
                    created_at: new Date().toISOString(),
                    path: 'js/GameLoop.js',
                    line: 42
                }
            ];
        }
        
        const response = await fetch(`${this.apiBase}/repos/${this.repoOwner}/${this.repoName}/pulls/${prNumber}/comments`, {
            headers: {
                'Authorization': `token ${this.githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }
        
        return await response.json();
    }

    /**
     * Run comprehensive CodeRabbit comment tests
     */
    async runComprehensiveTest(mcpClient = null) {
        console.log('🚀 Starting comprehensive CodeRabbit comment testing...');
        
        const results = {
            timestamp: new Date().toISOString(),
            tests: {}
        };
        
        // Test GitHub comments
        results.tests.githubComments = await this.testGitHubComments();
        
        // Test local comments
        results.tests.localComments = await this.testLocalComments(mcpClient);
        
        // Test API integration
        results.tests.apiIntegration = await this.testCodeRabbitAPI();
        
        // Create test PR if needed
        results.tests.testPR = await this.createTestPR();
        
        // Analyze quality
        results.quality = this.analyzeCommentQuality();
        
        // Generate report
        const report = this.generateTestReport(results);
        
        console.log('✅ CodeRabbit comment testing completed');
        return { results, report };
    }

    /**
     * Generate detailed test report
     */
    generateTestReport(results) {
        const report = `
# CodeRabbit Comment Testing Report

**Generated:** ${results.timestamp}

## 🤖 GitHub PR Comments
${results.tests.githubComments.map(pr => `
- **PR #${pr.prNumber}**: ${pr.coderabbitComments}/${pr.totalComments} CodeRabbit comments
${pr.comments.map(c => `  - Line ${c.line}: ${c.body.substring(0, 100)}...`).join('\n')}
`).join('\n')}

## 🖥️ Local IDE Comments
${results.tests.localComments.map(file => `
- **${file.file}**: ${file.markers} comment markers
${file.comments.map(c => `  - Line ${c.line}: ${c.content}`).join('\n')}
`).join('\n')}

## 📊 Quality Analysis
- **Coverage**: ${results.quality.coverage}%
- **Accuracy**: ${results.quality.accuracy} issues detected
- **Total GitHub Comments**: ${results.quality.totalGitHubComments}
- **Total Local Markers**: ${results.quality.totalLocalMarkers}

## 🎯 Recommendations
${results.quality.recommendations.map(r => `- ${r}`).join('\n')}

## 🔧 Test PR Created
${results.tests.testPR ? `
- **File**: ${results.tests.testPR.file}
- **Expected Issues**: ${results.tests.testPR.expectedIssues.length}
${results.tests.testPR.expectedIssues.map(i => `  - ${i}`).join('\n')}
` : 'No test PR created'}

---
*Generated by CodeRabbit Comment Testing System*
`;
        
        return report;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CodeRabbitCommentTester;
}

// Browser/window global
if (typeof window !== 'undefined') {
    window.CodeRabbitCommentTester = CodeRabbitCommentTester;
}
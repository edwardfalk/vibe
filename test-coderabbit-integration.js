/**
 * CodeRabbit Integration Test Runner
 * 
 * This script tests CodeRabbit's comment functionality and integration
 * with our existing testing system
 */

const CodeRabbitCommentTester = require('./js/coderabbit-comment-tester.js');
const CodeRabbitCommentProbe = require('./js/coderabbit-comment-probe.js');

async function runCodeRabbitTests() {
    console.log('🤖 Starting CodeRabbit Integration Tests...');
    console.log('=' .repeat(60));
    
    try {
        // Initialize test components
        const tester = new CodeRabbitCommentTester();
        const probe = new CodeRabbitCommentProbe();
        
        console.log('📋 Test Plan:');
        console.log('1. Extension Installation Check');
        console.log('2. Local Comment Markers Scan');
        console.log('3. GitHub Integration Test');
        console.log('4. Comment Quality Analysis');
        console.log('5. Real-time Commenting Test');
        console.log('6. Comprehensive Report Generation');
        console.log('');
        
        // Run probe tests
        console.log('🔍 Running CodeRabbit Comment Probe...');
        const probeResults = await probe.execute();
        
        console.log('📊 Probe Results Summary:');
        console.log(`Status: ${probeResults.status}`);
        console.log(`Tests: ${probeResults.summary?.totalTests || 0} total, ${probeResults.summary?.passedTests || 0} passed`);
        console.log(`Issues: ${probeResults.issues.length}`);
        console.log(`Recommendations: ${probeResults.recommendations.length}`);
        console.log('');
        
        // Run comprehensive tester
        console.log('🧪 Running Comprehensive CodeRabbit Tests...');
        const testerResults = await tester.runComprehensiveTest();
        
        console.log('📈 Tester Results Summary:');
        console.log(`GitHub Comments: ${testerResults.results.tests.githubComments?.length || 0} PRs tested`);
        console.log(`Local Comments: ${testerResults.results.tests.localComments?.length || 0} files scanned`);
        console.log(`Quality Coverage: ${testerResults.results.quality?.coverage || 0}%`);
        console.log(`Quality Accuracy: ${testerResults.results.quality?.accuracy || 0} issues detected`);
        console.log('');
        
        // Generate combined report
        const combinedReport = generateCombinedReport(probeResults, testerResults);
        
        // Save report to file
        const fs = require('fs').promises;
        const reportPath = 'CODERABBIT_INTEGRATION_TEST_REPORT.md';
        await fs.writeFile(reportPath, combinedReport);
        
        console.log('✅ CodeRabbit Integration Tests Completed!');
        console.log(`📄 Report saved to: ${reportPath}`);
        console.log('');
        
        // Display key findings
        displayKeyFindings(probeResults, testerResults);
        
        return {
            probe: probeResults,
            tester: testerResults,
            report: combinedReport,
            reportPath
        };
        
    } catch (error) {
        console.error('❌ CodeRabbit Integration Tests Failed:', error);
        throw error;
    }
}

function generateCombinedReport(probeResults, testerResults) {
    const timestamp = new Date().toISOString();
    
    return `# CodeRabbit Integration Test Report

**Generated:** ${timestamp}
**Test Suite:** CodeRabbit Comment Functionality & Integration

## 🎯 Executive Summary

This report analyzes CodeRabbit's integration with the Vibe game project, testing both GitHub PR comments and local IDE overlay functionality.

### Overall Status
- **Probe Status:** ${probeResults.status}
- **Extension Installed:** ${probeResults.tests.extensionInstallation?.installed ? '✅ Yes' : '❌ No'}
- **GitHub Integration:** ${probeResults.tests.githubIntegration?.hasWorkflow ? '✅ Configured' : '⚠️ Needs Setup'}
- **Comment Quality:** ${testerResults.results.quality?.accuracy || 0} issues detected

## 🔍 Detailed Test Results

### 1. Extension Installation
${probeResults.tests.extensionInstallation ? `
- **Status:** ${probeResults.tests.extensionInstallation.status}
- **Installed:** ${probeResults.tests.extensionInstallation.installed}
- **Details:** ${probeResults.tests.extensionInstallation.details}
` : 'Test not completed'}

### 2. Local Comment Markers
${probeResults.tests.localCommentMarkers ? `
- **Status:** ${probeResults.tests.localCommentMarkers.status}
- **Total Markers:** ${probeResults.tests.localCommentMarkers.totalMarkers}
- **Files Scanned:** ${probeResults.tests.localCommentMarkers.files?.length || 0}

#### File Details:
${probeResults.tests.localCommentMarkers.files?.map(f => `
- **${f.file}**: ${f.markers} markers
${f.details?.map(d => `  - Line ${d.line}: ${d.content}`).join('\n') || ''}
`).join('\n') || 'No file details available'}
` : 'Test not completed'}

### 3. GitHub Integration
${probeResults.tests.githubIntegration ? `
- **Status:** ${probeResults.tests.githubIntegration.status}
- **GitHub Token:** ${probeResults.tests.githubIntegration.hasToken ? '✅ Available' : '❌ Missing'}
- **Workflow Configured:** ${probeResults.tests.githubIntegration.hasWorkflow ? '✅ Yes' : '❌ No'}
- **Mock Comments:** ${probeResults.tests.githubIntegration.mockComments} found
` : 'Test not completed'}

### 4. Comment Quality Analysis
${probeResults.tests.commentQuality ? `
- **Status:** ${probeResults.tests.commentQuality.status}
- **Detected Issues:** ${probeResults.tests.commentQuality.detectedIssues}
- **Expected Issues:** ${probeResults.tests.commentQuality.expectedIssues}
- **Accuracy:** ${probeResults.tests.commentQuality.accuracy}%

#### Issues Found:
${probeResults.tests.commentQuality.issues?.map(i => `
- Line ${i.line}: ${i.message} (${i.type})
`).join('\n') || 'No issues listed'}
` : 'Test not completed'}

### 5. Real-time Commenting
${probeResults.tests.realTimeCommenting ? `
- **Status:** ${probeResults.tests.realTimeCommenting.status}
- **Editor Open:** ${probeResults.tests.realTimeCommenting.editorOpen ? '✅' : '❌'}
- **Comments Visible:** ${probeResults.tests.realTimeCommenting.commentsVisible ? '✅' : '❌'}
- **Response Time:** ${probeResults.tests.realTimeCommenting.responseTime}ms
- **Accuracy:** ${probeResults.tests.realTimeCommenting.accuracy}%
` : 'Test not completed'}

## 📊 Comprehensive Test Results

### GitHub PR Comments
${testerResults.results.tests.githubComments?.map(pr => `
- **PR #${pr.prNumber}**: ${pr.coderabbitComments}/${pr.totalComments} CodeRabbit comments
${pr.comments?.map(c => `  - Line ${c.line}: ${c.body}`).join('\n') || ''}
`).join('\n') || 'No GitHub PR data available'}

### Local IDE Comments
${testerResults.results.tests.localComments?.map(file => `
- **${file.file}**: ${file.markers} comment markers
${file.comments?.map(c => `  - Line ${c.line}: ${c.content}`).join('\n') || ''}
`).join('\n') || 'No local comment data available'}

### Quality Metrics
${testerResults.results.quality ? `
- **Total GitHub Comments:** ${testerResults.results.quality.totalGitHubComments}
- **Total Local Markers:** ${testerResults.results.quality.totalLocalMarkers}
- **Coverage:** ${testerResults.results.quality.coverage}%
- **Accuracy:** ${testerResults.results.quality.accuracy} issues detected
- **Issues Found:** ${testerResults.results.quality.issues}
` : 'Quality metrics not available'}

## 🎯 Issues Identified

### Probe Issues
${probeResults.issues?.map(issue => `- ${issue}`).join('\n') || 'No probe issues'}

### Tester Issues
${Array.isArray(testerResults.results.quality?.issues) ? `
${testerResults.results.quality.issues.map(issue => `- ${issue}`).join('\n')}
` : `${testerResults.results.quality?.issues || 'No tester issues'}`}

## 💡 Recommendations

### Probe Recommendations
${probeResults.recommendations?.map(rec => `- ${rec}`).join('\n') || 'No probe recommendations'}

### Tester Recommendations
${testerResults.results.quality?.recommendations ? `
${testerResults.results.quality.recommendations.map(rec => `- ${rec}`).join('\n')}
` : 'No tester recommendations'}

## 🔧 Next Steps

1. **If Extension Not Installed:**
   \`\`\`bash
   code --install-extension CodeRabbit.coderabbit-vscode
   \`\`\`

2. **If GitHub Token Missing:**
   \`\`\`bash
   export GITHUB_TOKEN=your_token_here
   \`\`\`

3. **Test CodeRabbit Comments:**
   - Commit the test file created by this script
   - Create a PR to trigger CodeRabbit review
   - Check for inline comments in VS Code/Cursor

4. **Monitor Comment Quality:**
   - Run this test suite regularly
   - Review CodeRabbit suggestions
   - Update .coderabbit.yaml configuration as needed

## 📈 Integration with Existing Testing

This CodeRabbit testing integrates with our existing probe-driven testing system:

- **MCP Playwright Integration:** Real-time comment testing
- **Ticketing System:** Bug reports for CodeRabbit issues
- **Automated Testing:** Regular CodeRabbit functionality checks
- **Quality Metrics:** CodeRabbit accuracy tracking

---

*Generated by CodeRabbit Integration Test Suite*
*Part of the Vibe Game Automated Testing System*
`;
}

function displayKeyFindings(probeResults, testerResults) {
    console.log('🔍 Key Findings:');
    console.log('=' .repeat(40));
    
    // Extension status
    const extensionInstalled = probeResults.tests.extensionInstallation?.installed;
    console.log(`📦 Extension: ${extensionInstalled ? '✅ Installed' : '❌ Not Installed'}`);
    
    // GitHub integration
    const githubConfigured = probeResults.tests.githubIntegration?.hasWorkflow;
    console.log(`🐙 GitHub: ${githubConfigured ? '✅ Configured' : '⚠️ Needs Setup'}`);
    
    // Comment markers
    const totalMarkers = probeResults.tests.localCommentMarkers?.totalMarkers || 0;
    console.log(`📝 Local Markers: ${totalMarkers} found`);
    
    // Quality metrics
    const accuracy = testerResults.results.quality?.accuracy || 0;
    const coverage = testerResults.results.quality?.coverage || 0;
    console.log(`🎯 Quality: ${accuracy} issues detected, ${coverage}% coverage`);
    
    // Issues and recommendations
    const totalIssues = (probeResults.issues?.length || 0) + (testerResults.results.quality?.issues || 0);
    const totalRecs = (probeResults.recommendations?.length || 0) + (testerResults.results.quality?.recommendations?.length || 0);
    console.log(`⚠️ Issues: ${totalIssues} identified`);
    console.log(`💡 Recommendations: ${totalRecs} provided`);
    
    console.log('');
    
    if (!extensionInstalled) {
        console.log('🚨 CRITICAL: CodeRabbit extension not installed!');
        console.log('   Run: code --install-extension CodeRabbit.coderabbit-vscode');
        console.log('');
    }
    
    if (totalMarkers === 0) {
        console.log('💡 TIP: Add CodeRabbit comment markers to test local functionality');
        console.log('   Example: // 🤖 CodeRabbit: This is a test comment');
        console.log('');
    }
}

// Run tests if executed directly
if (require.main === module) {
    runCodeRabbitTests()
        .then(results => {
            console.log('🎉 All tests completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Tests failed:', error);
            process.exit(1);
        });
}

module.exports = {
    runCodeRabbitTests,
    generateCombinedReport,
    displayKeyFindings
};
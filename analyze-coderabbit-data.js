/**
 * Analyze CodeRabbit Review Data
 * Simple script to display key insights from the comprehensive review data
 */

import fs from 'fs/promises';

async function analyzeCodeRabbitData() {
  try {
    console.log('🔍 Analyzing comprehensive CodeRabbit review data...\n');

    // Read the summary data
    const summaryData = JSON.parse(
      await fs.readFile('coderabbit-reviews/latest-summary.json', 'utf8')
    );

    // Read high-priority data
    const highPriorityData = JSON.parse(
      await fs.readFile('coderabbit-reviews/latest-high-priority.json', 'utf8')
    );

    console.log('📊 COMPREHENSIVE ANALYSIS RESULTS');
    console.log('='.repeat(50));
    
    console.log(`📋 Total PRs analyzed: ${summaryData.totalPRs}`);
    console.log(`🤖 Total CodeRabbit reviews: ${summaryData.totalReviews}`);
    console.log(`💬 Total line comments: ${summaryData.totalComments}`);
    console.log(`💡 Total suggestions: ${summaryData.totalSuggestions}`);
    console.log(`🚨 High-priority suggestions: ${highPriorityData.totalHighPriority}`);

    console.log('\n🎯 Priority Distribution:');
    Object.entries(summaryData.priorities).forEach(([priority, count]) => {
      const percentage = ((count / summaryData.totalSuggestions) * 100).toFixed(1);
      const emoji = priority === 'high' ? '🚨' : priority === 'medium' ? '⚠️' : '💡';
      console.log(`   ${emoji} ${priority}: ${count} (${percentage}%)`);
    });

    console.log('\n📊 Category Breakdown:');
    Object.entries(summaryData.categories)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        const percentage = ((count / summaryData.totalSuggestions) * 100).toFixed(1);
        console.log(`   ${category}: ${count} (${percentage}%)`);
      });

    console.log('\n🚨 High-Priority Categories:');
    const highPriorityByCategory = {};
    highPriorityData.suggestions.forEach(s => {
      highPriorityByCategory[s.category] = (highPriorityByCategory[s.category] || 0) + 1;
    });
    
    Object.entries(highPriorityByCategory)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`   ${category}: ${count} issues`);
      });

    console.log('\n🔝 Top PRs by Suggestion Count:');
    summaryData.prBreakdown.slice(0, 5).forEach((pr, index) => {
      console.log(`   ${index + 1}. PR #${pr.prNumber}: ${pr.suggestions} suggestions`);
      console.log(`      "${pr.title.substring(0, 60)}${pr.title.length > 60 ? '...' : ''}"`);
    });

    console.log('\n🎯 Sample High-Priority Security Issues:');
    const securityIssues = highPriorityData.suggestions
      .filter(s => s.category === 'security')
      .slice(0, 3);
    
    securityIssues.forEach((issue, index) => {
      console.log(`   ${index + 1}. [PR #${issue.pr.number}] ${issue.text.substring(0, 80)}...`);
      if (issue.context.file) {
        console.log(`      File: ${issue.context.file}`);
      }
    });

    console.log('\n🐛 Sample High-Priority Bug Issues:');
    const bugIssues = highPriorityData.suggestions
      .filter(s => s.category === 'bug')
      .slice(0, 3);
    
    bugIssues.forEach((issue, index) => {
      console.log(`   ${index + 1}. [PR #${issue.pr.number}] ${issue.text.substring(0, 80)}...`);
      if (issue.context.file) {
        console.log(`      File: ${issue.context.file}`);
      }
    });

    console.log('\n📁 Generated Files:');
    console.log('   📄 latest-complete.json - Complete review data (65MB)');
    console.log('   📊 latest-summary.json - Analysis summary');
    console.log('   🚨 latest-high-priority.json - High-priority issues');

    console.log('\n💡 Next Steps:');
    console.log('   1. Use coderabbit-auto-tickets.js to create tickets');
    console.log('   2. Focus on security and bug fixes first');
    console.log('   3. Review complete data for detailed implementation');
    console.log('   4. Track progress with ticket system');

  } catch (error) {
    console.error('❌ Error analyzing data:', error.message);
  }
}

// Run if called directly
if (import.meta.url.endsWith(process.argv[1]) || 
    import.meta.url.includes('analyze-coderabbit-data.js')) {
  analyzeCodeRabbitData();
}

export { analyzeCodeRabbitData }; 
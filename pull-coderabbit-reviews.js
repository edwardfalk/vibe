/**
 * Simple CodeRabbit Review Puller
 * Fetches CodeRabbit reviews from GitHub and displays them
 */

async function fetchCodeRabbitReviews() {
    console.log('🤖 Fetching CodeRabbit reviews...\n');
    
    const owner = 'edwardfalk';
    const repo = 'vibe';
    const githubToken = process.env.GITHUB_TOKEN;
    
    try {
        // Fetch recent pull requests
        const prUrl = `https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=10&sort=updated&direction=desc`;
        
        const headers = githubToken ? {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
        } : {
            'Accept': 'application/vnd.github.v3+json'
        };

        console.log('🔍 Fetching pull requests...');
        const prResponse = await fetch(prUrl, { headers });
        
        if (!prResponse.ok) {
            throw new Error(`GitHub API error: ${prResponse.status} ${prResponse.statusText}`);
        }

        const prs = await prResponse.json();
        console.log(`📋 Found ${prs.length} pull requests\n`);

        let totalReviews = 0;
        let newSuggestions = 0;

        // Check each PR for CodeRabbit reviews
        for (const pr of prs) {
            console.log(`🔍 Checking PR #${pr.number}: ${pr.title}`);
            
            // Fetch reviews for this PR
            const reviewsUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/reviews`;
            const reviewsResponse = await fetch(reviewsUrl, { headers });
            
            if (reviewsResponse.ok) {
                const reviews = await reviewsResponse.json();
                const coderabbitReviews = reviews.filter(review => 
                    review.user && review.user.login === 'coderabbitai[bot]'
                );
                
                if (coderabbitReviews.length > 0) {
                    console.log(`   🤖 Found ${coderabbitReviews.length} CodeRabbit reviews`);
                    totalReviews += coderabbitReviews.length;
                    
                    // Analyze each review for suggestions
                    for (const review of coderabbitReviews) {
                        const suggestions = analyzeReviewContent(review.body || '');
                        if (suggestions.length > 0) {
                            console.log(`   💡 ${suggestions.length} suggestions found`);
                            newSuggestions += suggestions.length;
                            
                            // Display high-priority suggestions
                            const highPriority = suggestions.filter(s => s.priority === 'high');
                            if (highPriority.length > 0) {
                                console.log(`   🚨 ${highPriority.length} high-priority suggestions:`);
                                highPriority.forEach(s => {
                                    console.log(`      - ${s.category}: ${s.text.substring(0, 80)}...`);
                                });
                            }
                        }
                    }
                } else {
                    console.log('   📭 No CodeRabbit reviews found');
                }
            }
            
            console.log(''); // Empty line for readability
        }

        // Summary
        console.log('📊 Summary:');
        console.log(`   Total CodeRabbit reviews: ${totalReviews}`);
        console.log(`   Total suggestions: ${newSuggestions}`);
        
        if (newSuggestions > 0) {
            console.log('\n💡 Next steps:');
            console.log('   1. Review the suggestions above');
            console.log('   2. Create tickets for high-priority issues');
            console.log('   3. Implement the suggested fixes');
        }

    } catch (error) {
        console.error('❌ Error fetching CodeRabbit reviews:', error.message);
        
        if (error.message.includes('rate limit')) {
            console.log('\n💡 Tip: Set GITHUB_TOKEN environment variable to increase rate limits');
        }
    }
}

/**
 * Analyze review content for suggestions
 */
function analyzeReviewContent(content) {
    if (!content) return [];
    
    const suggestions = [];
    
    // Look for common CodeRabbit patterns
    const patterns = [
        { regex: /\*\*([^*]+)\*\*\s*\n\n([^`]+)/g, type: 'general' },
        { regex: /⚠️\s*([^`\n]+)/g, type: 'warning' },
        { regex: /🛠️\s*([^`\n]+)/g, type: 'refactor' },
        { regex: /Consider\s+([^.]+)/gi, type: 'suggestion' },
        { regex: /Avoid\s+([^.]+)/gi, type: 'warning' }
    ];
    
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.regex.exec(content)) !== null) {
            const text = match[1] || match[0];
            const suggestion = {
                text: text.trim(),
                type: pattern.type,
                category: categorizeIssue(text),
                priority: prioritizeIssue(text)
            };
            suggestions.push(suggestion);
        }
    }
    
    return suggestions;
}

/**
 * Categorize an issue based on content
 */
function categorizeIssue(content) {
    const lowercaseContent = content.toLowerCase();
    
    if (lowercaseContent.includes('security') || lowercaseContent.includes('vulnerability')) {
        return 'security';
    }
    if (lowercaseContent.includes('performance') || lowercaseContent.includes('optimization')) {
        return 'performance';
    }
    if (lowercaseContent.includes('bug') || lowercaseContent.includes('error')) {
        return 'bug';
    }
    if (lowercaseContent.includes('style') || lowercaseContent.includes('formatting')) {
        return 'style';
    }
    if (lowercaseContent.includes('test') || lowercaseContent.includes('testing')) {
        return 'testing';
    }
    if (lowercaseContent.includes('documentation') || lowercaseContent.includes('comment')) {
        return 'documentation';
    }
    
    return 'general';
}

/**
 * Prioritize an issue based on content
 */
function prioritizeIssue(content) {
    const lowercaseContent = content.toLowerCase();
    
    if (lowercaseContent.includes('security') || 
        lowercaseContent.includes('vulnerability') ||
        lowercaseContent.includes('critical') ||
        lowercaseContent.includes('error')) {
        return 'high';
    }
    
    if (lowercaseContent.includes('performance') ||
        lowercaseContent.includes('bug') ||
        lowercaseContent.includes('optimization')) {
        return 'medium';
    }
    
    return 'low';
}

// Run the script
if (require.main === module) {
    fetchCodeRabbitReviews();
}

module.exports = { fetchCodeRabbitReviews }; 
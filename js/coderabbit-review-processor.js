/**
 * CodeRabbit Review Processor
 * Fetches and processes CodeRabbit reviews from GitHub API for automated testing workflow
 */

class CodeRabbitReviewProcessor {
    constructor(options = {}) {
        this.githubToken = options.githubToken || process.env.GITHUB_TOKEN;
        this.owner = options.owner || 'edwardfalk'; // GitHub username
        this.repo = options.repo || 'vibe'; // Replace with actual repo name
        this.baseUrl = 'https://api.github.com';
        
        if (!this.githubToken) {
            throw new Error('GitHub token is required. Set GITHUB_TOKEN environment variable.');
        }
    }

    /**
     * Fetch all pull requests for the repository
     */
    async fetchPullRequests(state = 'open') {
        const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/pulls?state=${state}&per_page=100`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.githubToken}`,
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('🚨 Error fetching pull requests:', error);
            throw error;
        }
    }

    /**
     * Fetch all reviews for a specific pull request
     */
    async fetchPullRequestReviews(pullNumber) {
        const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/pulls/${pullNumber}/reviews`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.githubToken}`,
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`🚨 Error fetching reviews for PR #${pullNumber}:`, error);
            throw error;
        }
    }

    /**
     * Fetch review comments for a specific review
     */
    async fetchReviewComments(pullNumber, reviewId) {
        const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/pulls/${pullNumber}/reviews/${reviewId}/comments`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.githubToken}`,
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`🚨 Error fetching comments for review ${reviewId}:`, error);
            throw error;
        }
    }

    /**
     * Filter reviews to find CodeRabbit reviews only
     */
    filterCodeRabbitReviews(reviews) {
        return reviews.filter(review => {
            const isCodeRabbit = review.user && (
                review.user.login === 'coderabbitai[bot]' ||
                review.user.login === 'github-actions[bot]' ||
                (review.body && review.body.includes('@coderabbitai'))
            );
            return isCodeRabbit;
        });
    }

    /**
     * Parse CodeRabbit review content to extract actionable suggestions
     */
    parseCodeRabbitSuggestions(review, comments = []) {
        const suggestions = [];
        
        // Parse main review body
        if (review.body) {
            const bodyLines = review.body.split('\n');
            let currentSuggestion = null;
            
            for (const line of bodyLines) {
                // Look for common CodeRabbit suggestion patterns
                if (line.includes('Consider') || line.includes('Suggestion:') || line.includes('⚠️') || 
                    line.includes('🔧') || line.includes('💡') || line.includes('🚨')) {
                    if (currentSuggestion) {
                        suggestions.push(currentSuggestion);
                    }
                    currentSuggestion = {
                        type: 'general',
                        content: line.trim(),
                        priority: this.determinePriority(line),
                        category: this.categorizeIssue(line)
                    };
                } else if (currentSuggestion && line.trim()) {
                    currentSuggestion.content += ' ' + line.trim();
                }
            }
            
            if (currentSuggestion) {
                suggestions.push(currentSuggestion);
            }
        }

        // Parse line-specific comments
        for (const comment of comments) {
            if (comment.body) {
                suggestions.push({
                    type: 'line-specific',
                    file: comment.path,
                    line: comment.line || comment.position,
                    content: comment.body,
                    priority: this.determinePriority(comment.body),
                    category: this.categorizeIssue(comment.body),
                    diffHunk: comment.diff_hunk
                });
            }
        }

        return suggestions;
    }

    /**
     * Determine priority level of a suggestion
     */
    determinePriority(content) {
        const lowercaseContent = content.toLowerCase();
        
        if (lowercaseContent.includes('critical') || lowercaseContent.includes('security') || 
            lowercaseContent.includes('vulnerability') || lowercaseContent.includes('🚨')) {
            return 'high';
        } else if (lowercaseContent.includes('performance') || lowercaseContent.includes('bug') || 
                   lowercaseContent.includes('error') || lowercaseContent.includes('⚠️')) {
            return 'medium';
        } else if (lowercaseContent.includes('style') || lowercaseContent.includes('formatting') || 
                   lowercaseContent.includes('typo') || lowercaseContent.includes('convention')) {
            return 'low';
        }
        
        return 'medium'; // Default
    }

    /**
     * Categorize the type of issue
     */
    categorizeIssue(content) {
        const lowercaseContent = content.toLowerCase();
        
        if (lowercaseContent.includes('security') || lowercaseContent.includes('vulnerability')) {
            return 'security';
        } else if (lowercaseContent.includes('performance') || lowercaseContent.includes('optimization')) {
            return 'performance';
        } else if (lowercaseContent.includes('bug') || lowercaseContent.includes('error') || 
                   lowercaseContent.includes('exception') || lowercaseContent.includes('crash')) {
            return 'bug';
        } else if (lowercaseContent.includes('style') || lowercaseContent.includes('formatting') || 
                   lowercaseContent.includes('convention') || lowercaseContent.includes('lint')) {
            return 'style';
        } else if (lowercaseContent.includes('test') || lowercaseContent.includes('testing') || 
                   lowercaseContent.includes('coverage')) {
            return 'testing';
        } else if (lowercaseContent.includes('documentation') || lowercaseContent.includes('comment') || 
                   lowercaseContent.includes('readme')) {
            return 'documentation';
        } else if (lowercaseContent.includes('refactor') || lowercaseContent.includes('cleanup') || 
                   lowercaseContent.includes('simplify')) {
            return 'refactoring';
        }
        
        return 'general';
    }

    /**
     * Get latest CodeRabbit reviews and suggestions
     */
    async getLatestCodeRabbitReviews(maxPRs = 5) {
        console.log('🔍 Fetching latest CodeRabbit reviews...');
        
        try {
            // Get recent pull requests
            const pullRequests = await this.fetchPullRequests('all');
            const recentPRs = pullRequests.slice(0, maxPRs);
            
            const allSuggestions = [];
            
            for (const pr of recentPRs) {
                console.log(`📋 Processing PR #${pr.number}: ${pr.title}`);
                
                // Get reviews for this PR
                const reviews = await this.fetchPullRequestReviews(pr.number);
                const codeRabbitReviews = this.filterCodeRabbitReviews(reviews);
                
                for (const review of codeRabbitReviews) {
                    console.log(`🤖 Found CodeRabbit review: ${review.id}`);
                    
                    // Get detailed comments for this review
                    const comments = await this.fetchReviewComments(pr.number, review.id);
                    
                    // Parse suggestions
                    const suggestions = this.parseCodeRabbitSuggestions(review, comments);
                    
                    allSuggestions.push({
                        pullRequest: {
                            number: pr.number,
                            title: pr.title,
                            url: pr.html_url
                        },
                        review: {
                            id: review.id,
                            state: review.state,
                            submittedAt: review.submitted_at,
                            url: review.html_url,
                            body: review.body
                        },
                        suggestions: suggestions,
                        totalSuggestions: suggestions.length,
                        priorityBreakdown: this.getPriorityBreakdown(suggestions),
                        categoryBreakdown: this.getCategoryBreakdown(suggestions)
                    });
                }
            }
            
            return allSuggestions;
        } catch (error) {
            console.error('🚨 Error processing CodeRabbit reviews:', error);
            throw error;
        }
    }

    /**
     * Get priority breakdown of suggestions
     */
    getPriorityBreakdown(suggestions) {
        const breakdown = { high: 0, medium: 0, low: 0 };
        suggestions.forEach(suggestion => {
            breakdown[suggestion.priority]++;
        });
        return breakdown;
    }

    /**
     * Get category breakdown of suggestions
     */
    getCategoryBreakdown(suggestions) {
        const breakdown = {};
        suggestions.forEach(suggestion => {
            breakdown[suggestion.category] = (breakdown[suggestion.category] || 0) + 1;
        });
        return breakdown;
    }

    /**
     * Generate actionable tasks from CodeRabbit suggestions
     */
    generateActionableTasks(reviewData) {
        const tasks = [];
        
        for (const reviewItem of reviewData) {
            const highPrioritySuggestions = reviewItem.suggestions.filter(s => s.priority === 'high');
            const mediumPrioritySuggestions = reviewItem.suggestions.filter(s => s.priority === 'medium');
            
            // Create tasks for high priority items
            for (const suggestion of highPrioritySuggestions) {
                tasks.push({
                    type: 'fix',
                    priority: 'high',
                    title: `Fix ${suggestion.category} issue in PR #${reviewItem.pullRequest.number}`,
                    description: suggestion.content,
                    file: suggestion.file,
                    line: suggestion.line,
                    pullRequest: reviewItem.pullRequest.number,
                    category: suggestion.category,
                    reviewUrl: reviewItem.review.url
                });
            }
            
            // Create tasks for medium priority items (grouped by category)
            const mediumByCategory = {};
            mediumPrioritySuggestions.forEach(suggestion => {
                if (!mediumByCategory[suggestion.category]) {
                    mediumByCategory[suggestion.category] = [];
                }
                mediumByCategory[suggestion.category].push(suggestion);
            });
            
            for (const [category, suggestions] of Object.entries(mediumByCategory)) {
                if (suggestions.length > 0) {
                    tasks.push({
                        type: 'improve',
                        priority: 'medium',
                        title: `Address ${category} issues in PR #${reviewItem.pullRequest.number}`,
                        description: `${suggestions.length} ${category} suggestions to address`,
                        suggestions: suggestions,
                        pullRequest: reviewItem.pullRequest.number,
                        category: category,
                        reviewUrl: reviewItem.review.url
                    });
                }
            }
        }
        
        return tasks;
    }

    /**
     * Generate summary report
     */
    generateSummaryReport(reviewData, tasks) {
        const totalReviews = reviewData.length;
        const totalSuggestions = reviewData.reduce((sum, item) => sum + item.totalSuggestions, 0);
        const totalTasks = tasks.length;
        
        const priorityTotals = reviewData.reduce((totals, item) => {
            totals.high += item.priorityBreakdown.high;
            totals.medium += item.priorityBreakdown.medium;
            totals.low += item.priorityBreakdown.low;
            return totals;
        }, { high: 0, medium: 0, low: 0 });
        
        const categoryTotals = reviewData.reduce((totals, item) => {
            for (const [category, count] of Object.entries(item.categoryBreakdown)) {
                totals[category] = (totals[category] || 0) + count;
            }
            return totals;
        }, {});
        
        return {
            summary: {
                totalReviews,
                totalSuggestions,
                totalTasks,
                priorityBreakdown: priorityTotals,
                categoryBreakdown: categoryTotals
            },
            recommendations: this.generateRecommendations(priorityTotals, categoryTotals),
            nextSteps: this.generateNextSteps(tasks)
        };
    }

    /**
     * Generate recommendations based on review patterns
     */
    generateRecommendations(priorityTotals, categoryTotals) {
        const recommendations = [];
        
        if (priorityTotals.high > 0) {
            recommendations.push(`🚨 Address ${priorityTotals.high} high-priority issues immediately`);
        }
        
        const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
        if (topCategory && topCategory[1] > 2) {
            recommendations.push(`🎯 Focus on ${topCategory[0]} improvements (${topCategory[1]} issues found)`);
        }
        
        if (categoryTotals.security > 0) {
            recommendations.push(`🔒 Review security suggestions carefully (${categoryTotals.security} found)`);
        }
        
        if (categoryTotals.performance > 0) {
            recommendations.push(`⚡ Consider performance optimizations (${categoryTotals.performance} found)`);
        }
        
        if (categoryTotals.bug > 0) {
            recommendations.push(`🐛 Fix potential bugs (${categoryTotals.bug} found)`);
        }
        
        return recommendations;
    }

    /**
     * Generate next steps
     */
    generateNextSteps(tasks) {
        const highPriorityTasks = tasks.filter(t => t.priority === 'high');
        const mediumPriorityTasks = tasks.filter(t => t.priority === 'medium');
        
        const steps = [];
        
        if (highPriorityTasks.length > 0) {
            steps.push(`1. Fix ${highPriorityTasks.length} high-priority issues`);
        }
        
        if (mediumPriorityTasks.length > 0) {
            steps.push(`${steps.length + 1}. Address ${mediumPriorityTasks.length} medium-priority improvements`);
        }
        
        steps.push(`${steps.length + 1}. Run automated tests to verify fixes`);
        steps.push(`${steps.length + 1}. Update documentation if needed`);
        steps.push(`${steps.length + 1}. Create follow-up tickets for remaining issues`);
        
        return steps;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CodeRabbitReviewProcessor;
}

// Example usage function
async function runCodeRabbitAnalysis() {
    try {
        const processor = new CodeRabbitReviewProcessor({
            owner: 'edwardfalk',
            repo: 'vibe'
        });
        
        console.log('🚀 Starting CodeRabbit review analysis...');
        
        // Get latest reviews
        const reviewData = await processor.getLatestCodeRabbitReviews(3);
        
        if (reviewData.length === 0) {
            console.log('📭 No CodeRabbit reviews found in recent pull requests');
            return { reviewData: [], tasks: [] };
        }
        
        // Generate actionable tasks
        const tasks = processor.generateActionableTasks(reviewData);
        
        // Generate summary report
        const report = processor.generateSummaryReport(reviewData, tasks);
        
        console.log('\n📊 CodeRabbit Review Analysis Report');
        console.log('=====================================');
        console.log(`Total Reviews Analyzed: ${report.summary.totalReviews}`);
        console.log(`Total Suggestions: ${report.summary.totalSuggestions}`);
        console.log(`Generated Tasks: ${report.summary.totalTasks}`);
        
        console.log('\n🎯 Priority Breakdown:');
        console.log(`  High: ${report.summary.priorityBreakdown.high}`);
        console.log(`  Medium: ${report.summary.priorityBreakdown.medium}`);
        console.log(`  Low: ${report.summary.priorityBreakdown.low}`);
        
        console.log('\n📂 Category Breakdown:');
        for (const [category, count] of Object.entries(report.summary.categoryBreakdown)) {
            console.log(`  ${category}: ${count}`);
        }
        
        console.log('\n💡 Recommendations:');
        report.recommendations.forEach(rec => console.log(`  ${rec}`));
        
        console.log('\n📋 Next Steps:');
        report.nextSteps.forEach(step => console.log(`  ${step}`));
        
        console.log('\n🔧 Generated Tasks:');
        tasks.forEach((task, index) => {
            console.log(`  ${index + 1}. [${task.priority.toUpperCase()}] ${task.title}`);
            if (task.file) {
                console.log(`     File: ${task.file}${task.line ? `:${task.line}` : ''}`);
            }
            console.log(`     Review: ${task.reviewUrl}`);
        });
        
        return { reviewData, tasks, report };
        
    } catch (error) {
        console.error('🚨 CodeRabbit analysis failed:', error);
        throw error;
    }
}

// Auto-run if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
    runCodeRabbitAnalysis().catch(console.error);
}
/**
 * CodeRabbit Review Processor
 * Fetches and processes CodeRabbit reviews from GitHub API
 */

class CodeRabbitReviewProcessor {
    constructor(options = {}) {
        this.owner = options.owner || 'edwardfalk';
        this.repo = options.repo || 'vibe';
        this.debug = options.debug || false;
        this.githubToken = process.env.GITHUB_TOKEN;
        
        if (!this.githubToken) {
            console.warn('⚠️ GITHUB_TOKEN not set - API requests will be rate limited');
        }
    }

    /**
     * Fetch recent pull requests
     */
    async fetchPullRequests(state = 'all', limit = 10) {
        const url = `https://api.github.com/repos/${this.owner}/${this.repo}/pulls?state=${state}&per_page=${limit}&sort=updated&direction=desc`;
        
        try {
            const response = await fetch(url, {
                headers: this.githubToken ? {
                    'Authorization': `token ${this.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                } : {
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
            }

            const prs = await response.json();
            if (this.debug) {
                console.log(`🔍 Found ${prs.length} pull requests`);
            }
            
            return prs;
        } catch (error) {
            console.error('❌ Error fetching pull requests:', error.message);
            return [];
        }
    }

    /**
     * Fetch reviews for a specific pull request
     */
    async fetchPullRequestReviews(prNumber) {
        const url = `https://api.github.com/repos/${this.owner}/${this.repo}/pulls/${prNumber}/reviews`;
        
        try {
            const response = await fetch(url, {
                headers: this.githubToken ? {
                    'Authorization': `token ${this.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                } : {
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
            }

            const reviews = await response.json();
            
            // Filter for CodeRabbit reviews
            const coderabbitReviews = reviews.filter(review => 
                review.user && review.user.login === 'coderabbitai[bot]'
            );

            if (this.debug) {
                console.log(`🤖 Found ${coderabbitReviews.length} CodeRabbit reviews for PR #${prNumber}`);
            }
            
            return coderabbitReviews;
        } catch (error) {
            console.error(`❌ Error fetching reviews for PR #${prNumber}:`, error.message);
            return [];
        }
    }

    /**
     * Fetch review comments for detailed analysis
     */
    async fetchReviewComments(prNumber) {
        const url = `https://api.github.com/repos/${this.owner}/${this.repo}/pulls/${prNumber}/comments`;
        
        try {
            const response = await fetch(url, {
                headers: this.githubToken ? {
                    'Authorization': `token ${this.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                } : {
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
            }

            const comments = await response.json();
            
            // Filter for CodeRabbit comments
            const coderabbitComments = comments.filter(comment => 
                comment.user && comment.user.login === 'coderabbitai[bot]'
            );

            if (this.debug) {
                console.log(`💬 Found ${coderabbitComments.length} CodeRabbit comments for PR #${prNumber}`);
            }
            
            return coderabbitComments;
        } catch (error) {
            console.error(`❌ Error fetching comments for PR #${prNumber}:`, error.message);
            return [];
        }
    }

    /**
     * Get latest CodeRabbit reviews with detailed analysis
     */
    async getLatestCodeRabbitReviews(limit = 5) {
        console.log('🚀 Fetching latest CodeRabbit reviews...');
        
        const prs = await this.fetchPullRequests('all', limit);
        const allReviews = [];

        for (const pr of prs) {
            const reviews = await this.fetchPullRequestReviews(pr.number);
            const comments = await this.fetchReviewComments(pr.number);
            
            for (const review of reviews) {
                const processedReview = {
                    id: review.id,
                    prNumber: pr.number,
                    prTitle: pr.title,
                    reviewUrl: review.html_url,
                    prUrl: pr.html_url,
                    body: review.body,
                    state: review.state,
                    submittedAt: review.submitted_at,
                    comments: comments.filter(c => c.pull_request_review_id === review.id)
                };
                
                // Analyze the review content
                const analysis = this.analyzeReview(processedReview);
                processedReview.analysis = analysis;
                
                allReviews.push(processedReview);
            }
        }

        console.log(`📋 Processed ${allReviews.length} CodeRabbit reviews`);
        return allReviews;
    }

    /**
     * Analyze a CodeRabbit review to extract suggestions and categorize them
     */
    analyzeReview(review) {
        const suggestions = [];
        
        // Analyze main review body
        if (review.body) {
            const bodySuggestions = this.extractSuggestions(review.body, review);
            suggestions.push(...bodySuggestions);
        }
        
        // Analyze individual comments
        for (const comment of review.comments) {
            const commentSuggestions = this.extractSuggestions(comment.body, review, comment);
            suggestions.push(...commentSuggestions);
        }
        
        return {
            totalSuggestions: suggestions.length,
            suggestions: suggestions,
            categories: this.categorizeSuggestions(suggestions),
            priorities: this.prioritizeSuggestions(suggestions)
        };
    }

    /**
     * Extract suggestions from review text
     */
    extractSuggestions(text, review, comment = null) {
        const suggestions = [];
        
        if (!text) return suggestions;
        
        // Look for CodeRabbit suggestion patterns
        const suggestionPatterns = [
            /\*\*([^*]+)\*\*\s*\n\n([^`]+)/g,  // Bold headers with descriptions
            /```suggestion\n([\s\S]*?)\n```/g,  // Code suggestions
            /⚠️\s*([^`\n]+)/g,  // Warning patterns
            /🛠️\s*([^`\n]+)/g,  // Refactor suggestions
            /Consider\s+([^.]+)/gi,  // Consider suggestions
            /Avoid\s+([^.]+)/gi,  // Avoid suggestions
        ];
        
        for (const pattern of suggestionPatterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const suggestion = {
                    text: match[1] || match[0],
                    fullText: match[0],
                    type: this.detectSuggestionType(match[0]),
                    category: this.categorizeIssue(match[0]),
                    priority: this.prioritizeIssue(match[0]),
                    file: comment?.path || null,
                    line: comment?.line || null,
                    reviewId: review.id,
                    prNumber: review.prNumber
                };
                
                suggestions.push(suggestion);
            }
        }
        
        return suggestions;
    }

    /**
     * Detect the type of suggestion
     */
    detectSuggestionType(text) {
        const lowercaseText = text.toLowerCase();
        
        if (lowercaseText.includes('security') || lowercaseText.includes('vulnerability')) {
            return 'security';
        }
        if (lowercaseText.includes('performance') || lowercaseText.includes('optimization')) {
            return 'performance';
        }
        if (lowercaseText.includes('bug') || lowercaseText.includes('error') || lowercaseText.includes('fix')) {
            return 'bug';
        }
        if (lowercaseText.includes('style') || lowercaseText.includes('formatting')) {
            return 'style';
        }
        if (lowercaseText.includes('test') || lowercaseText.includes('testing')) {
            return 'testing';
        }
        if (lowercaseText.includes('documentation') || lowercaseText.includes('comment')) {
            return 'documentation';
        }
        if (lowercaseText.includes('refactor') || lowercaseText.includes('restructure')) {
            return 'refactoring';
        }
        
        return 'general';
    }

    /**
     * Categorize an issue based on content
     */
    categorizeIssue(content) {
        const lowercaseContent = content.toLowerCase();
        
        // Security issues
        if (lowercaseContent.includes('security') || 
            lowercaseContent.includes('vulnerability') ||
            lowercaseContent.includes('unsafe') ||
            lowercaseContent.includes('injection')) {
            return 'security';
        }
        
        // Performance issues
        if (lowercaseContent.includes('performance') ||
            lowercaseContent.includes('optimization') ||
            lowercaseContent.includes('slow') ||
            lowercaseContent.includes('memory leak') ||
            lowercaseContent.includes('inefficient')) {
            return 'performance';
        }
        
        // Bug issues
        if (lowercaseContent.includes('bug') ||
            lowercaseContent.includes('error') ||
            lowercaseContent.includes('crash') ||
            lowercaseContent.includes('undefined') ||
            lowercaseContent.includes('null')) {
            return 'bug';
        }
        
        // Style issues
        if (lowercaseContent.includes('style') ||
            lowercaseContent.includes('formatting') ||
            lowercaseContent.includes('indentation') ||
            lowercaseContent.includes('spacing')) {
            return 'style';
        }
        
        // Testing issues
        if (lowercaseContent.includes('test') ||
            lowercaseContent.includes('testing') ||
            lowercaseContent.includes('coverage')) {
            return 'testing';
        }
        
        // Documentation issues
        if (lowercaseContent.includes('documentation') ||
            lowercaseContent.includes('comment') ||
            lowercaseContent.includes('readme')) {
            return 'documentation';
        }
        
        return 'general';
    }

    /**
     * Prioritize an issue based on content
     */
    prioritizeIssue(content) {
        const lowercaseContent = content.toLowerCase();
        
        // High priority
        if (lowercaseContent.includes('security') ||
            lowercaseContent.includes('vulnerability') ||
            lowercaseContent.includes('critical') ||
            lowercaseContent.includes('crash') ||
            lowercaseContent.includes('error') ||
            lowercaseContent.includes('undefined') ||
            lowercaseContent.includes('null')) {
            return 'high';
        }
        
        // Medium priority
        if (lowercaseContent.includes('performance') ||
            lowercaseContent.includes('bug') ||
            lowercaseContent.includes('optimization') ||
            lowercaseContent.includes('memory')) {
            return 'medium';
        }
        
        // Low priority (style, documentation, etc.)
        return 'low';
    }

    /**
     * Categorize all suggestions
     */
    categorizeSuggestions(suggestions) {
        const categories = {};
        
        for (const suggestion of suggestions) {
            const category = suggestion.category;
            if (!categories[category]) {
                categories[category] = 0;
            }
            categories[category]++;
        }
        
        return categories;
    }

    /**
     * Prioritize all suggestions
     */
    prioritizeSuggestions(suggestions) {
        const priorities = { high: 0, medium: 0, low: 0 };
        
        for (const suggestion of suggestions) {
            priorities[suggestion.priority]++;
        }
        
        return priorities;
    }

    /**
     * Generate a summary report
     */
    generateReport(reviews) {
        const totalReviews = reviews.length;
        const totalSuggestions = reviews.reduce((sum, r) => sum + r.analysis.totalSuggestions, 0);
        
        const allCategories = {};
        const allPriorities = { high: 0, medium: 0, low: 0 };
        
        for (const review of reviews) {
            // Aggregate categories
            for (const [category, count] of Object.entries(review.analysis.categories)) {
                allCategories[category] = (allCategories[category] || 0) + count;
            }
            
            // Aggregate priorities
            for (const [priority, count] of Object.entries(review.analysis.priorities)) {
                allPriorities[priority] += count;
            }
        }
        
        return {
            summary: {
                totalReviews,
                totalSuggestions,
                categories: allCategories,
                priorities: allPriorities
            },
            reviews
        };
    }
}

export default CodeRabbitReviewProcessor;
/**
 * Simple CodeRabbit Review Checker
 * Checks for new CodeRabbit reviews and displays summary
 */

async function checkCodeRabbitReviews() {
    console.log('🤖 Checking for new CodeRabbit reviews...\n');
    
    const owner = 'edwardfalk';
    const repo = 'vibe';
    const githubToken = process.env.GITHUB_TOKEN;
    
    // Show current ticket status first
    console.log('📊 Current CodeRabbit Tickets:');
    try {
        const fs = require('fs');
        const path = require('path');
        const ticketsPath = path.join(process.cwd(), 'tests', 'bug-reports', 'coderabbit-tickets.json');
        
        if (fs.existsSync(ticketsPath)) {
            const data = JSON.parse(fs.readFileSync(ticketsPath, 'utf8'));
            const tickets = Object.values(data.tickets || {});
            
            console.log(`   Total tickets: ${tickets.length}`);
            console.log(`   Last updated: ${new Date(data.lastUpdated).toLocaleString()}`);
            
            // Count by status
            const statusCounts = {};
            tickets.forEach(t => {
                statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
            });
            
            console.log('   Status breakdown:');
            Object.entries(statusCounts).forEach(([status, count]) => {
                const emoji = status === 'resolved' ? '✅' : status === 'open' ? '🔓' : '🔄';
                console.log(`     ${emoji} ${status}: ${count}`);
            });
            
            console.log('');
        } else {
            console.log('   No tickets file found\n');
        }
    } catch (error) {
        console.log('   Error reading tickets:', error.message, '\n');
    }
    
    // Check for new reviews
    try {
        const headers = githubToken ? {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
        } : {
            'Accept': 'application/vnd.github.v3+json'
        };

        console.log('🔍 Fetching recent pull requests...');
        const prUrl = `https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=5&sort=updated&direction=desc`;
        const prResponse = await fetch(prUrl, { headers });
        
        if (!prResponse.ok) {
            throw new Error(`GitHub API error: ${prResponse.status} ${prResponse.statusText}`);
        }

        const prs = await prResponse.json();
        console.log(`📋 Found ${prs.length} recent pull requests\n`);

        let totalReviews = 0;
        let newReviews = 0;

        for (const pr of prs) {
            console.log(`🔍 PR #${pr.number}: ${pr.title}`);
            console.log(`   State: ${pr.state} | Updated: ${new Date(pr.updated_at).toLocaleDateString()}`);
            
            // Fetch reviews for this PR
            const reviewsUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/reviews`;
            const reviewsResponse = await fetch(reviewsUrl, { headers });
            
            if (reviewsResponse.ok) {
                const reviews = await reviewsResponse.json();
                const coderabbitReviews = reviews.filter(review => 
                    review.user && review.user.login === 'coderabbitai[bot]'
                );
                
                if (coderabbitReviews.length > 0) {
                    console.log(`   🤖 ${coderabbitReviews.length} CodeRabbit reviews found`);
                    totalReviews += coderabbitReviews.length;
                    
                    // Check if these are newer than our last update
                    coderabbitReviews.forEach(review => {
                        const reviewDate = new Date(review.submitted_at);
                        console.log(`     - Review ${review.id}: ${reviewDate.toLocaleDateString()}`);
                        console.log(`       URL: ${review.html_url}`);
                        
                        // Simple check for new content
                        if (review.body && review.body.length > 100) {
                            console.log(`       📝 ${Math.floor(review.body.length / 100)} suggestions (estimated)`);
                        }
                    });
                } else {
                    console.log('   📭 No CodeRabbit reviews');
                }
            } else {
                console.log(`   ❌ Error fetching reviews: ${reviewsResponse.status}`);
            }
            
            console.log('');
        }

        // Summary
        console.log('📊 Summary:');
        console.log(`   Total CodeRabbit reviews found: ${totalReviews}`);
        
        if (totalReviews > 0) {
            console.log('\n💡 Next steps:');
            console.log('   1. Review the CodeRabbit suggestions in the PRs above');
            console.log('   2. Create tickets for any new high-priority issues');
            console.log('   3. Check if existing resolved tickets need follow-up');
        } else {
            console.log('\n✅ No new CodeRabbit reviews found');
        }

    } catch (error) {
        console.error('❌ Error checking CodeRabbit reviews:', error.message);
        
        if (error.message.includes('rate limit')) {
            console.log('\n💡 Tip: Set GITHUB_TOKEN environment variable to increase rate limits');
        }
    }
}

// Run the script
checkCodeRabbitReviews(); 
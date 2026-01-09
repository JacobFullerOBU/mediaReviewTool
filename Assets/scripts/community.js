
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const [reviewersRes, reviewsRes] = await Promise.all([
            fetch('./Assets/Data/reviewers.json'),
            fetch('./Assets/Data/reviews.json')
        ]);

        if (!reviewersRes.ok || !reviewsRes.ok) {
            throw new Error('Failed to fetch data.');
        }

        const reviewers = await reviewersRes.json();
        const reviews = await reviewsRes.json();
        
        const reviewersWithReviews = reviewers.filter(reviewer => 
            reviews.some(review => review.reviewerId === reviewer.id)
        );

        const communityContainer = document.getElementById('community-container');
        if (communityContainer) {
            reviewersWithReviews.forEach(reviewer => {
                const reviewerCard = document.createElement('div');
                reviewerCard.className = 'reviewer-card';
                reviewerCard.innerHTML = `
                    <img src="${reviewer.avatar}" alt="${reviewer.username}" class="avatar">
                    <div class="reviewer-info">
                        <h3 class="reviewer-name">
                            <a href="reviewer-profile.html?id=${reviewer.id}">${reviewer.username}</a>
                        </h3>
                        <p class="reviewer-bio">${reviewer.bio}</p>
                    </div>
                `;
                communityContainer.appendChild(reviewerCard);
            });
        }
    } catch (error) {
        console.error('Error loading community data:', error);
        const communityContainer = document.getElementById('community-container');
        if (communityContainer) {
            communityContainer.innerHTML = '<p>Could not load community members at this time.</p>';
        }
    }
});

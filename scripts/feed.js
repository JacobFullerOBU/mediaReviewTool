// scripts/feed.js

async function fetchAllData() {
    try {
        const [reviewsRes, reviewersRes, moviesRes] = await Promise.all([
            fetch('Reviews/reviews.json'),
            fetch('Community/reviewers.json'),
            fetch('Movies/movieList.json')
        ]);

        if (!reviewsRes.ok || !reviewersRes.ok || !moviesRes.ok) {
            throw new Error('Failed to fetch all required data.');
        }

        const reviews = await reviewsRes.json();
        const reviewers = await reviewersRes.json();
        const movies = await moviesRes.json();
        
        // In a real app, you'd fetch other media types too.
        const allMedia = [...movies]; 

        return { reviews, reviewers, allMedia };
    } catch (error) {
        console.error("Could not fetch data for feed:", error);
        return { reviews: [], reviewers: [], allMedia: [] };
    }
}

function createFeedItem(review, reviewer, mediaItem) {
    const item = document.createElement('div');
    item.className = 'bg-slate-800 rounded-lg p-6 border border-slate-700 flex gap-6';

    const mediaPoster = mediaItem ? mediaItem.poster : 'https://via.placeholder.com/100x150.png?text=No+Image';
    const mediaTitle = mediaItem ? mediaItem.title : review.mediaTitle;

    item.innerHTML = `
        <div class="w-24 flex-shrink-0">
            <img src="${mediaPoster}" alt="${mediaTitle}" class="w-full h-auto rounded-md">
        </div>
        <div class="flex-grow">
            <div class="flex items-center gap-3 mb-2">
                <img src="${reviewer.avatar}" alt="${reviewer.username}" class="w-8 h-8 rounded-full">
                <span class="font-semibold text-white">${reviewer.username}</span>
                <span class="text-xs text-slate-400">reviewed</span>
                <span class="font-semibold text-indigo-400">${mediaTitle}</span>
            </div>
            <div class="flex items-center gap-1 mb-3">
                ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}
                <span class="text-xs text-slate-400 ml-2">(${review.rating}/5)</span>
            </div>
            <p class="text-slate-300">${review.reviewText}</p>
            <p class="text-xs text-slate-500 mt-4">${new Date(review.timestamp).toLocaleString()}</p>
        </div>
    `;
    return item;
}

async function displayFeed() {
    const feedContainer = document.getElementById('feed-container');
    if (!feedContainer) return;

    const currentUser = window.getCurrentUser ? window.getCurrentUser() : { following: [] };
    if (currentUser.following.length === 0) {
        feedContainer.innerHTML = `<div class="text-center text-slate-400 p-8 bg-slate-800 rounded-lg">You are not following any reviewers yet. Go to the <a href="#" id="feed-to-community" class="text-indigo-400 hover:underline">Community</a> page to find people to follow!</div>`;
        document.getElementById('feed-to-community')?.addEventListener('click', (e) => {
            e.preventDefault();
            if(window.showPage) window.showPage('community-page');
        });
        return;
    }

    const { reviews, reviewers, allMedia } = await fetchAllData();

    const followedReviews = reviews
        .filter(review => currentUser.following.includes(review.reviewerId))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    feedContainer.innerHTML = '';
    followedReviews.forEach(review => {
        const reviewer = reviewers.find(r => r.id === review.reviewerId);
        const mediaItem = allMedia.find(m => m.title.trim() === review.mediaTitle.trim());
        if (reviewer) feedContainer.appendChild(createFeedItem(review, reviewer, mediaItem));
    });
    lucide.createIcons();
}

window.displayFeed = displayFeed;

// --- NEW FUNCTION for Explore Feed ---
async function displayExploreFeed() {
    const exploreFeedContainer = document.getElementById('explore-feed-container');
    if (!exploreFeedContainer) return;

    exploreFeedContainer.innerHTML = '<div class="text-center text-slate-400 p-8">Loading latest reviews...</div>';

    const { reviews, reviewers, allMedia } = await fetchAllData();

    if (reviews.length === 0) {
        exploreFeedContainer.innerHTML = `<div class="text-center text-slate-400 p-8 bg-slate-800 rounded-lg">No reviews have been posted yet. Be the first!</div>`;
        return;
    }

    const allRecentReviews = reviews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    exploreFeedContainer.innerHTML = '';
    allRecentReviews.forEach(review => {
        const reviewer = reviewers.find(r => r.id === review.reviewerId);
        const mediaItem = allMedia.find(m => m.title.trim() === review.mediaTitle.trim());
        if (reviewer) {
            exploreFeedContainer.appendChild(createFeedItem(review, reviewer, mediaItem));
        }
    });
    lucide.createIcons();
}

window.displayExploreFeed = displayExploreFeed;
window.fetchAllData = fetchAllData;
window.createFeedItem = createFeedItem;
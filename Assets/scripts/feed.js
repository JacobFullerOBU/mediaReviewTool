// scripts/feed.js

import { ref, get } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { db } from "./firebase.js";

// Import media arrays from separate files
import { tv } from "../TV Shows/tv.js";
import { music } from "../Music/music.js";
import { games } from "../Video Games/games.js";
import { books } from "../Books/books.js";

async function fetchMovies() {
    try {
        const response = await fetch("../Movies/movieList.json");
        return await response.json();
    } catch (e) {
        console.error("Failed to fetch movies:", e);
        return [];
    }
}

async function getAllMediaMap() {
    try {
        const movies = await fetchMovies();
        const allMedia = [
            ...movies.filter(item => item.title),
            ...tv.filter(item => item.title),
            ...music.filter(item => item.title),
            ...games.filter(item => item.title),
            ...books.filter(item => item.title)
        ];

        const mediaMap = {};
        allMedia.forEach(item => {
            if (item.title) {
                const normTitle = item.title.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
                mediaMap[normTitle] = item;
            }
        });
        return mediaMap;
    } catch (error) {
        console.error("Error fetching all media:", error);
        return {};
    }
}

async function fetchAllData() {
    try {
        const [reviewsRes, reviewersRes, movies] = await Promise.all([
            fetch('../Data/reviews.json'),
            fetch('../Data/reviewers.json'),
            fetchMovies()
        ]);

        if (!reviewsRes.ok || !reviewersRes.ok) {
            throw new Error('Failed to fetch reviews or reviewers.');
        }

        const reviews = await reviewsRes.json();
        const reviewers = await reviewersRes.json();
        
        const allMedia = [
            ...movies.filter(item => item.title),
            ...tv.filter(item => item.title),
            ...music.filter(item => item.title),
            ...games.filter(item => item.title),
            ...books.filter(item => item.title)
        ];

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
    const mediaTitle = mediaItem ? mediaItem.title : (review.mediaId ? review.mediaId.replace(/_/g, ' ') : "Unknown Media");
    const rating = Math.round((review.rating || 0) / 2); // Scale 1-10 to 0-5
    const originalRating = review.rating || 'N/A';

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
                ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}
                <span class="text-xs text-slate-400 ml-2">(${originalRating}/10)</span>
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

    try {
        // Fetch reviews from Firebase
        const reviewsRef = ref(db, 'reviews');
        const snapshot = await get(reviewsRef);
        let allReviews = [];
        if (snapshot.exists()) {
            const reviewsByMedia = snapshot.val();
            for (const mediaId in reviewsByMedia) {
                const reviewsForMedia = reviewsByMedia[mediaId];
                for (const reviewId in reviewsForMedia) {
                    allReviews.push({
                        ...reviewsForMedia[reviewId],
                        id: reviewId,
                        mediaId: mediaId 
                    });
                }
            }
        }

        if (allReviews.length === 0) {
            exploreFeedContainer.innerHTML = `<div class="text-center text-slate-400 p-8 bg-slate-800 rounded-lg">No reviews have been posted yet. Be the first!</div>`;
            return;
        }

        const mediaMap = await getAllMediaMap();

        const allRecentReviews = allReviews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        exploreFeedContainer.innerHTML = '';
        allRecentReviews.forEach(review => {
            const mediaItem = mediaMap[review.mediaId];

            // Create a placeholder reviewer
            const reviewer = {
                username: review.userId ? `User ${review.userId.substring(0, 6)}...` : 'Anonymous',
                avatar: `https://i.pravatar.cc/150?u=${review.userId || 'anonymous'}`
            };

            if(review.rating && review.reviewText) { // Ensure review has content
                exploreFeedContainer.appendChild(createFeedItem(review, reviewer, mediaItem));
            }
        });
        
        if (exploreFeedContainer.innerHTML === '') {
            exploreFeedContainer.innerHTML = `<div class="text-center text-slate-400 p-8 bg-slate-800 rounded-lg">No valid reviews found to display.</div>`;
        }

        lucide.createIcons();
    } catch (error) {
        console.error("Error fetching or displaying explore feed:", error);
        exploreFeedContainer.innerHTML = `<div class="text-center text-red-500 p-8 bg-slate-800 rounded-lg">Could not load reviews. Error: ${error.message}</div>`;
    }
}

window.displayExploreFeed = displayExploreFeed;
window.fetchAllData = fetchAllData;
window.createFeedItem = createFeedItem;
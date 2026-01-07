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
        const response = await fetch("Assets/Movies/movieList.json");
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
                const normTitle = item.title.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
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
            fetch('Assets/Data/reviews.json'),
            fetch('Assets/Data/reviewers.json'),
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


function createExploreCard(review, reviewer, mediaItem) {
    const mediaPoster = (mediaItem && (mediaItem.poster || mediaItem.image)) || 'https://via.placeholder.com/300x450.png?text=No+Image';
    const mediaTitle = mediaItem ? mediaItem.title : (review.mediaId ? review.mediaId.replace(/_/g, ' ') : "Unknown Media");
    const rating = review.rating || 0;
    const mediaId = review.mediaId || '';

    return `
        <div class="explore-card bg-slate-800 rounded-xl overflow-hidden border border-slate-700 transition-all hover:shadow-xl hover:shadow-indigo-500/10 flex flex-col">
            <div class="relative h-48 overflow-hidden">
                <img class="w-full h-full object-cover" src="${mediaPoster}" alt="${mediaTitle}">
                <div class="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md flex items-center gap-1 text-yellow-400 text-xs">
                    <i data-lucide="star" class="w-3 h-3 fill-current"></i> ${rating}/10
                </div>
            </div>
            <div class="p-4 flex-1 flex flex-col">
                <h3 class="text-lg font-bold text-white mb-2 line-clamp-1">${mediaTitle}</h3>
                <div class="flex items-center gap-2 mb-3">
                    <img src="${reviewer.avatar}" alt="${reviewer.username}" class="w-6 h-6 rounded-full">
                    <span class="text-sm font-semibold text-slate-300">${reviewer.username}</span>
                </div>
                <p class="text-slate-400 text-sm mb-4 flex-1 line-clamp-3">"${review.reviewText}"</p>
                <div class="pt-3 border-t border-slate-700 text-center">
                    <a href="#" class="read-more-link text-indigo-400 hover:underline text-sm font-semibold" data-media-id="${mediaId}">Read More</a>
                </div>
            </div>
        </div>
    `;
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

    let cardsHTML = '';
    followedReviews.forEach(review => {
        const reviewer = reviewers.find(r => r.id === review.reviewerId);
        const mediaItem = allMedia.find(m => m.title.trim() === review.mediaTitle.trim());
        if (reviewer) {
            cardsHTML += createExploreCard(review, reviewer, mediaItem);
        }
    });
    
    if (cardsHTML === '') {
        feedContainer.innerHTML = `<div class="text-center text-slate-400 p-8 bg-slate-800 rounded-lg">No reviews from followed users.</div>`;
    } else {
        feedContainer.innerHTML = cardsHTML;
    }
    
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

        exploreFeedContainer.className = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6';
        let cardsHTML = '';
        allRecentReviews.forEach(review => {
            const mediaItem = mediaMap[review.mediaId];

            // Create a placeholder reviewer
            const reviewer = {
                username: review.userId ? `User ${review.userId.substring(0, 6)}...` : 'Anonymous',
                avatar: `https://i.pravatar.cc/150?u=${review.userId || 'anonymous'}`
            };

            if(review.rating && review.reviewText) { // Ensure review has content
                cardsHTML += createExploreCard(review, reviewer, mediaItem);
            }
        });
        
        if (cardsHTML === '') {
            exploreFeedContainer.innerHTML = `<div class="text-center text-slate-400 p-8 bg-slate-800 rounded-lg">No valid reviews found to display.</div>`;
        } else {
            exploreFeedContainer.innerHTML = cardsHTML;
        }

        lucide.createIcons();

        // Add event listeners for "Read More" links
        const readMoreLinks = exploreFeedContainer.querySelectorAll('.read-more-link');
        readMoreLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const mediaId = e.target.dataset.mediaId;
                if (mediaId) {
                    const mediaItem = mediaMap[mediaId];
                    if (mediaItem && window.showItemDetails) {
                        window.showItemDetails(mediaItem);
                    } else {
                        console.error('Could not find media item or showItemDetails function for mediaId:', mediaId);
                    }
                }
            });
        });

    } catch (error) {
        console.error("Error fetching or displaying explore feed:", error);
        exploreFeedContainer.innerHTML = `<div class="text-center text-red-500 p-8 bg-slate-800 rounded-lg">Could not load reviews. Error: ${error.message}</div>`;
    }
}

window.displayExploreFeed = displayExploreFeed;
window.fetchAllData = fetchAllData;
window.createFeedItem = createExploreCard;
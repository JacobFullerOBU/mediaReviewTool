import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { app } from "./firebase.js";
import { fetchMovies } from './main.js';
import { tv } from "../TV Shows/tv.js";
import { music } from "../Music/music.js";
import { games } from "../Video Games/games.js";
import { books } from "../Books/books.js";

const db = getDatabase(app);
let allReviews = [];
let allMedia = [];
let allReviewers = {};

document.addEventListener("DOMContentLoaded", async () => {
    await fetchData();

    const sortSelect = document.getElementById('sort-reviews');
    const searchInput = document.getElementById('search-reviews');

    sortSelect.addEventListener('change', () => {
        filterSortAndRenderReviews();
    });

    searchInput.addEventListener('input', () => {
        filterSortAndRenderReviews();
    });
});

async function fetchData() {
    const container = document.getElementById("reviews-container");
    container.innerHTML = `<div class="flex justify-center items-center py-12"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div></div>`;

    try {
        const [reviewersSnapshot, reviewsSnapshot, movies] = await Promise.all([
            get(ref(db, "reviewers")),
            get(ref(db, "reviews")),
            fetchMovies()
        ]);

        if (reviewersSnapshot.exists()) {
            allReviewers = reviewersSnapshot.val();
        }

        allMedia = [...movies, ...tv, ...music, ...games, ...books].filter(item => item && item.title);
        
        const mediaMap = {};
        allMedia.forEach(media => {
            if (media.id != null) {
                mediaMap[media.id] = media;
            }
            if (media.title) {
                const mId = media.title.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                mediaMap[mId] = media;
            }
        });

        if (reviewsSnapshot.exists()) {
            const reviewsData = reviewsSnapshot.val();
            for (const [mediaId, reviews] of Object.entries(reviewsData)) {
                for (const [reviewId, review] of Object.entries(reviews)) {
                    const reviewer = allReviewers[review.userId];
                    const mediaItem = mediaMap[mediaId];
                    
                    if (reviewer && mediaItem) {
                        allReviews.push({
                            ...review,
                            id: reviewId,
                            mediaId: mediaId,
                            mediaTitle: mediaItem.title,
                            mediaPoster: mediaItem.poster || mediaItem.image,
                            reviewerName: reviewer.name,
                            reviewerAvatar: reviewer.avatar
                        });
                    }
                }
            }
        }
        filterSortAndRenderReviews();

    } catch (error) {
        console.error("Error fetching data:", error);
        container.innerHTML = `<div class="text-center py-12"><p class="text-red-400">Failed to load reviews. Please try again later.</p></div>`;
    }
}

function filterSortAndRenderReviews() {
    const sortBy = document.getElementById('sort-reviews').value;
    const searchTerm = document.getElementById('search-reviews').value.toLowerCase();

    let filteredReviews = [...allReviews];

    if (searchTerm) {
        filteredReviews = filteredReviews.filter(review => {
            const titleMatch = review.mediaTitle.toLowerCase().includes(searchTerm);
            const bodyMatch = review.reviewText.toLowerCase().includes(searchTerm);
            return titleMatch || bodyMatch;
        });
    }

    switch (sortBy) {
        case 'newest':
            filteredReviews.sort((a, b) => b.timestamp - a.timestamp);
            break;
        case 'oldest':
            filteredReviews.sort((a, b) => a.timestamp - b.timestamp);
            break;
        case 'rating-desc':
            filteredReviews.sort((a, b) => b.rating - a.rating);
            break;
        case 'rating-asc':
            filteredReviews.sort((a, b) => a.rating - b.rating);
            break;
    }
    renderReviews(filteredReviews);
}

function renderReviews(reviews) {
    const container = document.getElementById("reviews-container");
    container.innerHTML = "";

    if (reviews.length === 0) {
        container.innerHTML = `<div class="text-center py-12"><p class="text-slate-400 text-lg">No reviews found.</p></div>`;
        return;
    }

    reviews.forEach(review => {
        container.appendChild(createReviewCard(review));
    });

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function createReviewCard(review) {
    const item = document.createElement('div');
    item.className = 'bg-slate-800 rounded-lg p-6 border border-slate-700 flex gap-6';

    const mediaPoster = review.mediaPoster || 'https://via.placeholder.com/100x150.png?text=No+Image';

    item.innerHTML = `
        <div class="w-24 flex-shrink-0">
            <img src="${mediaPoster}" alt="${review.mediaTitle}" class="w-full h-auto rounded-md">
        </div>
        <div class="flex-grow">
            <div class="flex items-center gap-3 mb-2">
                <img src="${review.reviewerAvatar}" alt="${review.reviewerName}" class="w-8 h-8 rounded-full">
                <span class="font-semibold text-white">${review.reviewerName}</span>
                <span class="text-xs text-slate-400">reviewed</span>
                <span class="font-semibold text-indigo-400">${review.mediaTitle}</span>
            </div>
            <div class="flex items-center gap-1 mb-3 text-yellow-400">
                <i data-lucide="star" class="w-4 h-4 fill-current"></i>
                <span class="font-bold">${review.rating}</span>
                <span class="text-xs text-slate-400 ml-1">/ 10</span>
            </div>
            <div class="review-body text-slate-300">${review.reviewText}</div>
            <p class="text-xs text-slate-500 mt-4">${new Date(review.timestamp).toLocaleString()}</p>
        </div>
    `;
    return item;
}

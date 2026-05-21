import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { app } from "./firebase.js";
import { fetchMovies, fetchTV, fetchBooks } from './main.js';
import { music } from "./music.js";
import { games } from "./games.js";

const db = getDatabase(app);
let allReviews = [];
let allMedia = [];
let allReviewers = {};

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function sanitizeReviewHtml(html) {
    if (!html) return '';
    const allowed = new Set(['p', 'br', 'b', 'i', 'u', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'span']);
    const div = document.createElement('div');
    div.innerHTML = html;
    (function clean(node) {
        Array.from(node.childNodes).forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE) {
                const tag = child.tagName.toLowerCase();
                if (!allowed.has(tag)) {
                    child.replaceWith(...child.childNodes);
                } else {
                    Array.from(child.attributes).forEach(attr => {
                        if (attr.name.startsWith('on') || (attr.name === 'href' && /^javascript:/i.test(attr.value))) {
                            child.removeAttribute(attr.name);
                        }
                    });
                    clean(child);
                }
            }
        });
    })(div);
    return div.innerHTML;
}

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
        const [reviewersSnapshot, reviewsSnapshot, movies, tvData, booksData] = await Promise.all([
            get(ref(db, "reviewers")),
            get(ref(db, "reviews")),
            fetchMovies(),
            fetchTV(),
            fetchBooks()
        ]);

        if (reviewersSnapshot.exists()) {
            allReviewers = reviewersSnapshot.val();
        }

        allMedia = [...movies, ...tvData, ...music, ...games, ...booksData].filter(item => item && item.title);

        const CAT_NORM = { movie: 'movies', book: 'books', game: 'games' };
        const mediaMap = {};
        allMedia.forEach(media => {
            const titleSlug = media.title.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            const rawCat = Array.isArray(media.category) ? media.category[0] : (media.category || '');
            const normCat = CAT_NORM[rawCat.trim().toLowerCase()] || rawCat.trim().toLowerCase();
            const catSlug = normCat.replace(/[^a-zA-Z0-9]/g, '_');

            // Category-prefixed key matches migrated Firebase paths (e.g. 'movies_the_housemaid')
            if (catSlug) mediaMap[`${catSlug}_${titleSlug}`] = media;

            // Explicit media.id if present
            if (media.id != null) mediaMap[media.id] = media;

            // Title-only fallback: first category wins so movies take priority over books
            if (!mediaMap[titleSlug]) mediaMap[titleSlug] = media;
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
            filteredReviews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            break;
        case 'oldest':
            filteredReviews.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
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

function generateStarRating(rating) {
    let stars = '<div class="inline-flex flex-row justify-center gap-0.5">'; 
    const numRating = Math.floor(rating);

    for (let i = 0; i < numRating; i++) {
        stars += '<i data-lucide="star" class="w-4 h-4 fill-yellow-400 text-yellow-400 flex-shrink-0"></i>';
    }

    for (let i = numRating; i < 10; i++) {
        stars += '<i data-lucide="star" class="w-4 h-4 text-slate-600 flex-shrink-0"></i>';
    }

    stars += '</div>';
    return stars;
}

function createReviewCard(review) {
    const item = document.createElement('div');
    item.className = 'bg-slate-800 rounded-lg p-4 sm:p-6 border border-slate-700 hover:border-slate-600 transition-colors';

    const mediaPoster = review.mediaPoster || 'https://via.placeholder.com/100x150.png?text=No+Image';
    const detailsLink = `movie.html?id=${encodeURIComponent(review.mediaId)}`;
    const safeReviewerName = escapeHtml(review.reviewerName);
    const safeMediaTitle = escapeHtml(review.mediaTitle);
    const safeRating = escapeHtml(String(review.rating));

    // Show more / less logic — sanitize HTML from Quill editor
    const maxLength = 200;
    const fullHtml = sanitizeReviewHtml(review.reviewText);
    const plainText = fullHtml.replace(/<[^>]*>/g, '');
    const isLongReview = plainText.length > maxLength;
    const truncatedHtml = isLongReview ? sanitizeReviewHtml(review.reviewText?.substring(0, maxLength)) + '...' : fullHtml;
    const reviewId = `review-${escapeHtml(review.id || Math.random().toString(36).substr(2, 9))}`;

    item.innerHTML = `
        <div class="flex flex-col sm:flex-row gap-4">
            <div class="w-full sm:w-20 flex-shrink-0">
                <a href="${detailsLink}">
                    <img src="${escapeHtml(mediaPoster)}" alt="${safeMediaTitle}" class="w-full h-auto rounded-md max-h-32 object-cover mx-auto sm:mx-0 hover:opacity-80 transition-opacity cursor-pointer">
                </a>
            </div>
            <div class="flex-grow min-w-0">
                <div class="flex items-center gap-2 mb-2">
                    <img src="${escapeHtml(review.reviewerAvatar)}" alt="${safeReviewerName}" class="w-6 h-6 rounded-full flex-shrink-0">
                    <span class="font-semibold text-white text-sm">${safeReviewerName}</span>
                </div>
                <div class="text-xs text-slate-400 mb-2">
                    reviewed
                    <a href="${detailsLink}" class="inline-block">
                        <span class="font-semibold text-indigo-400 text-sm hover:text-indigo-300 transition-colors cursor-pointer">
                            ${safeMediaTitle}
                        </span>
                    </a>
                </div>
                <div class="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
                    ${generateStarRating(review.rating)}
                    <span class="text-xs text-slate-400 ml-2 whitespace-nowrap">${safeRating}/10</span>
                </div>
                <div class="review-body text-slate-300 text-sm leading-relaxed mb-3" id="${reviewId}">
                    ${truncatedHtml}
                    ${isLongReview ? '<span class="toggle-review-btn text-indigo-400 cursor-pointer hover:text-indigo-300 text-sm font-medium ml-1" data-action="more">Show more</span>' : ''}
                </div>
                <div class="flex justify-between items-center">
                    <p class="text-xs text-slate-500">${new Date(review.timestamp).toLocaleString()}</p>
                </div>
            </div>
        </div>
    `;

    if (isLongReview) {
        const reviewBody = item.querySelector(`#${reviewId}`);
        const toggleReview = (showFull) => {
            if (showFull) {
                reviewBody.innerHTML = fullHtml + ' <span class="toggle-review-btn text-indigo-400 cursor-pointer hover:text-indigo-300 text-sm font-medium ml-1" data-action="less">Show less</span>';
            } else {
                reviewBody.innerHTML = truncatedHtml + ' <span class="toggle-review-btn text-indigo-400 cursor-pointer hover:text-indigo-300 text-sm font-medium ml-1" data-action="more">Show more</span>';
            }
        };

        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('toggle-review-btn')) {
                const action = e.target.getAttribute('data-action');
                toggleReview(action === 'more');
            }
        });
    }

    return item;
}
console.log('[cards.js] Script loaded, window.showItemDetails will be set after showItemDetails definition.');

// Firebase Firestore for dynamic ratings
import { ref, push, get, child, onValue } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { auth, db } from "./firebase.js";
// Import media arrays from separate files
import { tv } from "../TV Shows/tv.js";
import { music } from "../Music/music.js";
import { games } from "../Video Games/games.js";
import { books } from "../Books/books.js";
window.books = books;

// Get number of reviews for a media item (Realtime Database)
async function getReviewCount(mediaId) {
    const reviewsRef = ref(db, `reviews/${mediaId}`);
    const snapshot = await get(reviewsRef);
    if (snapshot.exists()) {
        return Object.keys(snapshot.val()).length;
    }
    return 0;
}

// Get average rating for a media item (Realtime Database)
async function getAverageRating(mediaId) {
    const reviewsRef = ref(db, `reviews/${mediaId}`);
    const snapshot = await get(reviewsRef);
    let total = 0;
    let count = 0;
    if (snapshot.exists()) {
        const reviews = snapshot.val();
        Object.values(reviews).forEach(data => {
            if (typeof data.rating === "number") {
                total += data.rating;
                count++;
            }
        });
    }
    return count > 0 ? (total / count).toFixed(1) : "N/A";
}
// Cards functionality for displaying popular content

// Fetch movies from JSON file
async function fetchMovies() {
    // Use correct relative path depending on current location
    let path = "Movies/movieList.json";
    if (window.location.pathname.includes("/profile/")) {
        path = "../Movies/movieList.json";
    }
    const response = await fetch(path);
    return await response.json();
}

let currentFilter = 'all';
let allItems = [];
window.allItems = allItems;

console.log('[cards.js] Script loaded');
document.addEventListener('DOMContentLoaded', async function() {
    console.log('[cards.js] DOMContentLoaded');
    await initCards();
    // Debug: log all click events to help trace event propagation
    document.addEventListener('click', function(e) {
        console.log('[DEBUG] Click event:', e.target);
    });

    // Add search functionality
    const searchInput = document.getElementById('mediaSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const query = this.value.trim().toLowerCase();
            searchMedia(query);
        });
    }
});
// Search media by title or description
function searchMedia(query) {
    let filteredItems = allItems;
    if (query) {
        filteredItems = allItems.filter(item =>
            item.title.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query) ||
            (item.director && item.director.toLowerCase().includes(query)) ||
            (item.actors && item.actors.toLowerCase().includes(query))
        );
    }
    loadCardsWithItems(filteredItems);
}

// Helper to load cards with a specific set of items
async function loadCardsWithItems(items) {
    const container = document.getElementById('cardsContainer');
    if (!container) return;
    showLoadingState(container);
    setTimeout(async () => {
        await renderCards(container, items);
    }, 300);
}

async function initCards() {
    // Fetch movies from JSON
    const movies = (await fetchMovies()).filter(m => typeof m.title === 'string' && m.title);
    // Filter out empty items from other media arrays
    const validTV = Array.isArray(tv) ? tv.filter(item => typeof item.title === 'string' && item.title) : [];
    const validMusic = Array.isArray(music) ? music.filter(item => typeof item.title === 'string' && item.title) : [];
    const validGames = Array.isArray(games) ? games.filter(item => typeof item.title === 'string' && item.title) : [];
    const validBooks = Array.isArray(books) ? books.filter(item => typeof item.title === 'string' && item.title) : [];
    allItems = [...movies, ...validTV, ...validMusic, ...validGames, ...validBooks];
    window.allItems = allItems;
    console.log('[DEBUG] Loaded media items:', allItems.length, allItems);

    // Initialize tab functionality
    initTabFunctionality();

    // Load initial content
    loadCards('all');
}

function initTabFunctionality() {
    const tabBtns = document.querySelectorAll('.tab-btn');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const category = this.dataset.category;

            // Update active tab
            tabBtns.forEach(tab => tab.classList.remove('active'));
            this.classList.add('active');

            // Filter cards
            filterCards(category);
        });
    });
}

function filterCards(category) {
    currentFilter = category;
    let items = allItems;
    if (category && category !== 'all') {
        items = allItems.filter(item => {
            // Accept both string and array category
            if (typeof item.category === 'string') {
                return item.category.toLowerCase() === category.toLowerCase();
            } else if (Array.isArray(item.category)) {
                return item.category.map(c => c.toLowerCase()).includes(category.toLowerCase());
            }
            // Fallback: Movies if no category
            return category === 'movies' && !item.category;
        });
    }
    // Sort items by selected option
    const sortOption = document.getElementById('sortSelect')?.value || 'year-desc';
    items = sortItems(items, sortOption);
    loadCardsWithItems(items);
}

// Export function for use by other modules
window.filterCards = filterCards;

// Modal logic moved to a dedicated async function
async function showItemDetails(item) {
    // Use the same key logic as review submission
    let mediaId = item.id || (item.title ? item.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : '');
    let avgRating = await getAverageRating(mediaId);
    let reviewCount = await getReviewCount(mediaId);
    let reviewsHtml = '';

    try {
        const reviewsRef = ref(db, `reviews/${mediaId}`);
        const snapshot = await get(reviewsRef);
        if (snapshot.exists()) {
            const reviews = Object.values(snapshot.val()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            reviewsHtml = `<h3 class="text-xl font-bold text-white mt-8 mb-4">All Reviews</h3><div class="space-y-4">`;
            reviewsHtml += reviews.map(r => `
                <div class="review-block bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2 text-yellow-400 font-bold">
                            <i data-lucide="star" class="w-4 h-4 fill-current"></i> ${r.rating}
                        </div>
                        <span class="text-slate-500 text-xs">${r.timestamp ? new Date(r.timestamp).toLocaleString() : ''}</span>
                    </div>
                    <p class="text-slate-300">${r.reviewText}</p>
                </div>
            `).join('');
            reviewsHtml += `</div>`;
        } else {
            reviewsHtml = `<div class="mt-8 text-slate-500">No reviews yet.</div>`;
        }
    } catch (err) {
        reviewsHtml = `<div class="mt-8 text-red-500">Error loading reviews.</div>`;
    }

    let modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm';
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
            document.body.style.overflow = 'auto';
        }
    });

    modal.innerHTML = `
        <div class="bg-slate-800 rounded-2xl p-8 w-full max-w-2xl border border-slate-700 shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar">
            <button class="close-btn absolute top-4 right-4 text-slate-400 hover:text-white">
                <i data-lucide="x" class="w-6 h-6"></i>
            </button>
            <div class="flex flex-col md:flex-row gap-8 items-start">
                <img src="${item.poster || item.image || ''}" alt="${item.title}" class="w-48 h-auto rounded-lg shadow-lg object-cover flex-shrink-0 mx-auto md:mx-0">
                <div class="flex-1 text-slate-300">
                    <h2 class="text-3xl font-bold text-white mb-2">${item.title || ''}</h2>
                    <div class="flex items-center gap-4 text-sm text-slate-400 mb-4">
                        <span>${item.year ? `<strong>Year:</strong> ${item.year}` : ''}</span>
                        ${item.genre ? `<span><strong>Genre:</strong> ${item.genre}</span>` : ''}
                    </div>
                    <div class="text-sm text-slate-400 mb-4">
                        ${item.director ? `<strong>Director:</strong> ${item.director}` : ''}
                    </div>
                    <div class="text-sm text-slate-400 mb-4">
                        ${item.actors ? `<strong>Cast:</strong> ${item.actors}` : ''}
                    </div>
                    <p class="text-slate-400 mb-6">${item.description || ''}</p>
                    <div class="flex items-center gap-6 bg-slate-900/50 p-3 rounded-lg mb-6">
                        <div>
                            <strong>Avg. Rating:</strong> 
                            <span id="modalRating" class="font-bold text-yellow-400 ml-1">★ ${avgRating}</span>
                        </div>
                        <div>
                            <strong>Reviews:</strong> 
                            <span id="modalReviewCount" class="font-bold text-white ml-1">${reviewCount}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-4">
                        <button class="btn-primary bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors" id="writeReviewBtn">Write a Review</button>
                        <button class="btn-secondary border border-slate-600 hover:bg-slate-700 text-slate-300 font-bold py-2 px-4 rounded-lg transition-colors" id="addToFavoritesBtn">Add to Favorites</button>
                    </div>
                </div>
            </div>
            
            <div id="reviewFormContainer" class="hidden mt-6 pt-6 border-t border-slate-700">
                <form id="reviewForm" class="space-y-4">
                    <div>
                        <label for="reviewRating" class="block text-sm font-medium text-slate-300 mb-2">Rating (1-10):</label>
                        <input type="number" id="reviewRating" min="1" max="10" required class="w-24 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none">
                    </div>
                    <div>
                        <label for="reviewText" class="block text-sm font-medium text-slate-300 mb-2">Your Review:</label>
                        <textarea id="reviewText" rows="4" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"></textarea>
                    </div>
                    <button type="submit" class="btn-primary bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">Submit</button>
                </form>
                <div id="reviewError" class="text-red-500 mt-4"></div>
            </div>

            <div id="reviewsSection">${reviewsHtml}</div>
        </div>
    `;
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    lucide.createIcons();

    // --- Add Event Listeners to Modal Elements ---

    modal.querySelector('.close-btn').addEventListener('click', () => {
        modal.remove();
        document.body.style.overflow = 'auto';
    });

    modal.querySelector('#writeReviewBtn').addEventListener('click', () => {
        modal.querySelector('#reviewFormContainer').classList.toggle('hidden');
    });

    // Favorites Logic
    const addToFavoritesBtn = modal.querySelector('#addToFavoritesBtn');
    const mediaKey = item.id || item.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    let isFavorite = false;
    if (auth.currentUser) {
        const userId = auth.currentUser.uid;
        const favRef = ref(db, `favorites/${userId}/${mediaKey}`);
        get(favRef).then(snapshot => {
            if (snapshot.exists()) {
                isFavorite = true;
                addToFavoritesBtn.textContent = 'Remove from Favorites';
                addToFavoritesBtn.classList.add('bg-red-600', 'hover:bg-red-700', 'border-red-600');
            }
        });
    }
    
    addToFavoritesBtn.addEventListener('click', async () => {
        if (!auth.currentUser) {
            alert('You must be logged in to add favorites.');
            return;
        }
        const userId = auth.currentUser.uid;
        const favRef = ref(db, `favorites/${userId}/${mediaKey}`);
        if (!isFavorite) {
            await push(favRef, { mediaId: mediaKey, addedAt: new Date().toISOString() });
            addToFavoritesBtn.textContent = 'Remove from Favorites';
            isFavorite = true;
            addToFavoritesBtn.classList.add('bg-red-600', 'hover:bg-red-700', 'border-red-600');
        } else {
            get(favRef).then(snapshot => {
                if (snapshot.exists()) {
                    const updates = {};
                    Object.keys(snapshot.val()).forEach(key => { updates[`${key}`] = null; });
                     import('https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js').then(({ update }) => {
                        update(favRef, updates);
                     });
                }
            });
            addToFavoritesBtn.textContent = 'Add to Favorites';
            isFavorite = false;
            addToFavoritesBtn.classList.remove('bg-red-600', 'hover:bg-red-700', 'border-red-600');
        }
    });

    // Review Submission Logic
    modal.querySelector('#reviewForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const reviewText = modal.querySelector('#reviewText').value.trim();
        const reviewRating = parseInt(modal.querySelector('#reviewRating').value);
        const reviewError = modal.querySelector('#reviewError');
        reviewError.textContent = '';

        if (!reviewText || isNaN(reviewRating) || reviewRating < 1 || reviewRating > 10) {
            reviewError.textContent = 'Please enter a review and a rating between 1 and 10.';
            return;
        }

        const user = auth.currentUser;
        if (!user) {
            reviewError.textContent = 'You must be logged in to submit a review.';
            return;
        }

        try {
            const reviewsRef = ref(db, `reviews/${mediaId}`);
            await push(reviewsRef, {
                userId: user.uid,
                mediaId: mediaId,
                reviewText,
                rating: reviewRating,
                timestamp: new Date().toISOString()
            });

            // Refresh reviews, rating, and count
            const newAvgRating = await getAverageRating(mediaId);
            const newReviewCount = await getReviewCount(mediaId);
            const reviewsSnapshot = await get(reviewsRef);
            let newReviewsHtml = '';
            if (reviewsSnapshot.exists()) {
                const reviews = Object.values(reviewsSnapshot.val()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                 newReviewsHtml = `<h3 class="text-xl font-bold text-white mt-8 mb-4">All Reviews</h3><div class="space-y-4">`;
                 newReviewsHtml += reviews.map(r => `
                    <div class="review-block bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center gap-2 text-yellow-400 font-bold">
                                <i data-lucide="star" class="w-4 h-4 fill-current"></i> ${r.rating}
                            </div>
                            <span class="text-slate-500 text-xs">${r.timestamp ? new Date(r.timestamp).toLocaleString() : ''}</span>
                        </div>
                        <p class="text-slate-300">${r.reviewText}</p>
                    </div>
                `).join('');
                newReviewsHtml += `</div>`;
            }
            modal.querySelector('#reviewsSection').innerHTML = newReviewsHtml;
            modal.querySelector('#modalRating').textContent = `★ ${newAvgRating}`;
            modal.querySelector('#modalReviewCount').textContent = newReviewCount;
            lucide.createIcons();
            
            modal.querySelector('#reviewForm').reset();
            modal.querySelector('#reviewFormContainer').classList.add('hidden');

        } catch (err) {
            reviewError.textContent = 'Error submitting review: ' + (err.message || err);
        }
    });
}
window.showItemDetails = showItemDetails;

// Attach card listeners outside of showItemDetails
function addCardListeners() {
    const container = document.getElementById('cardsContainer');
    if (!container) return;
    container.onclick = function(e) {
        // Find the closest .media-card ancestor
        const card = e.target.closest('.media-card');
        if (!card || !container.contains(card)) return;
        // Get item id from card dataset
        const itemId = card.dataset.id;
        // Find item by id or title
        let item = allItems.find(item => {
            if (item.id && item.id == itemId) return true;
            // fallback: match normalized title
            if (!item.id && item.title) {
                const normTitle = item.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                return normTitle === itemId;
            }
            return false;
        });
        if (item) {
            showItemDetails(item);
        }
    };
    // Optionally, set pointer cursor for accessibility
    const cards = container.querySelectorAll('.media-card');
    cards.forEach(card => {
        const imageElem = card.querySelector('.card-image');
        const titleElem = card.querySelector('.card-title');
        if (imageElem) imageElem.style.cursor = 'pointer';
        if (titleElem) titleElem.style.cursor = 'pointer';
    });
}

// Export function for use by other modules
window.filterCards = filterCards;
// Load cards by category
function loadCards(category) {
    const container = document.getElementById('cardsContainer');
    if (!container) return;
    showLoadingState(container);
    let items = allItems;
    if (category && category !== 'all') {
        items = allItems.filter(item => {
            // Accept both string and array category
            if (typeof item.category === 'string') {
                return item.category.toLowerCase() === category.toLowerCase();
            } else if (Array.isArray(item.category)) {
                return item.category.map(c => c.toLowerCase()).includes(category.toLowerCase());
            }
            // Fallback: Movies if no category
            return category === 'movies' && !item.category;
        });
    }
    setTimeout(async () => {
        await renderCards(container, items);
        addCardListeners();
    }, 300);
}

// Render cards in the container
async function renderCards(container, items) {
    container.innerHTML = '';
    if (!items || items.length === 0) {
        container.innerHTML = '<div style="padding:32px;text-align:center;color:#888;">No media items found.</div>';
        return;
    }

    // Collapse logic: show only first 10 by default
    let visibleCount = 9;
    let expanded = false;
    function renderVisibleCards() {
        // Add themed background to container
        container.style.background = 'transparent'; // Let the body background show through
        container.style.padding = '0';
        container.style.borderRadius = '0';
        container.style.boxShadow = 'none';
        
        let cardHTML = '';
        const toShow = items.slice(0, visibleCount);
        toShow.forEach(item => {
            const starRating = item.rating || item.avgRating ? `<div class="star-rating text-yellow-400 text-xs flex items-center gap-1"><i data-lucide="star" class="w-3 h-3 fill-current"></i> ${item.rating || item.avgRating}</div>` : '';
            const reviewSnippet = item.reviewSnippet || (item.description ? item.description.split('.').slice(0,1).join('.') : '');
            
            cardHTML += `
                <div class="media-card group bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-indigo-500/50 transition-all hover:shadow-xl hover:shadow-indigo-500/10 flex flex-col cursor-pointer" data-id="${item.id || (item.title ? item.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : '')}">
                    <div class="relative h-48 overflow-hidden">
                        <img class="card-image w-full h-full object-cover transform group-hover:scale-110 transition-duration-500 transition-transform" src="${item.poster || item.image || ''}" alt="${item.title || ''}">
                        <div class="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md flex items-center gap-1">
                            ${starRating}
                        </div>
                    </div>
                    <div class="p-5 flex-1 flex flex-col">
                        <div class="flex justify-between items-start mb-2">
                            <h3 class="card-title text-lg font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-1">${item.title || ''}</h3>
                            <span class="text-xs text-slate-500 font-mono mt-1">${item.year || ''}</span>
                        </div>
                         <p class="text-slate-400 text-sm mb-4 flex-1 line-clamp-2">
                            ${reviewSnippet}
                        </p>
                        <div class="pt-4 border-t border-slate-700 text-slate-500 text-xs">
                             <span class="font-medium text-slate-400">${item.genre || ''}</span>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = cardHTML;
        lucide.createIcons();
        
        // Add Show More/Show Less button if needed
        if (items.length > visibleCount) {
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary col-span-full'; // Span full width of the grid
            btn.style.display = 'block';
            btn.style.margin = '24px auto 0 auto';
            btn.textContent = `Show More (${Math.min(9, items.length - visibleCount)} more)`;
            btn.addEventListener('click', () => {
                visibleCount += 9;
                renderVisibleCards();
                addCardListeners();
            });
            container.appendChild(btn);
        } else if (items.length > 9) {
            // Show Less button if expanded
            const btn = document.createElement('button');
            btn.className = 'btn btn-secondary col-span-full';
            btn.style.display = 'block';
            btn.style.margin = '24px auto 0 auto';
            btn.textContent = 'Show Less';
            btn.addEventListener('click', () => {
                visibleCount = 9;
                renderVisibleCards();
                addCardListeners();
            });
            container.appendChild(btn);
        }
    }
    renderVisibleCards();
}

// Show loading state
function showLoadingState(container) {
    container.innerHTML = '<div style="padding:32px;text-align:center;color:#888;">Loading...</div>';
}

// Sorting functionality
function sortItems(items, sortOption) {
    if (!items || !Array.isArray(items)) return items;
    let sorted = [...items];
    switch (sortOption) {
        case 'year-desc':
            sorted.sort((a, b) => (parseInt(b.year) || 0) - (parseInt(a.year) || 0));
            break;
        case 'year-asc':
            sorted.sort((a, b) => (parseInt(a.year) || 0) - (parseInt(b.year) || 0));
            break;
        case 'title-asc':
            sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
            break;
        case 'title-desc':
            sorted.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
            break;
        case 'rating-desc':
            sorted.sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));
            break;
        case 'rating-asc':
            sorted.sort((a, b) => (parseFloat(a.rating) || 0) - (parseFloat(b.rating) || 0));
            break;
        default:
            break;
    }
    return sorted;
}

// Listen for sort apply button
if (document.getElementById('applySortBtn')) {
    document.getElementById('applySortBtn').addEventListener('click', function() {
        filterCards(currentFilter);
    });
}
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
    loadCards(category);
}

// Export function for use by other modules
window.filterCards = filterCards;

// Modal logic moved to a dedicated async function
async function showItemDetails(item) {
    // Use the same key logic as review submission
    let mediaId = item.id;
    if (!mediaId && item.title) {
        mediaId = item.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    }
    let avgRating = await getAverageRating(mediaId);
    let reviewCount = await getReviewCount(mediaId);
    let reviewsHtml = '';
    try {
        const reviewsRef = ref(db, `reviews/${mediaId}`);
        const snapshot = await get(reviewsRef);
        if (snapshot.exists()) {
            const reviews = Object.values(snapshot.val());
            reviewsHtml = `<div style="margin-top:24px;"><h3>All Reviews</h3>`;
            reviewsHtml += reviews.map(r => `
                <div class="review-block" style="border-bottom:1px solid #eee; margin-bottom:12px; padding-bottom:8px;">
                    <div><strong>Rating:</strong> ★ ${r.rating} <span style="color:#888; font-size:0.9em;">${r.timestamp ? new Date(r.timestamp).toLocaleString() : ''}</span></div>
                    <div style="margin-top:4px;"><strong>Review:</strong> ${r.reviewText}</div>
                </div>
            `).join('');
            reviewsHtml += `</div>`;
        } else {
            reviewsHtml = `<div style="margin-top:24px; color:#888;">No reviews yet.</div>`;
        }
    } catch (err) {
        reviewsHtml = `<div style="margin-top:24px; color:red;">Error loading reviews.</div>`;
    }

    let modal = document.createElement('div');
    modal.className = 'modal show';
    modal.style.zIndex = '9999';
    modal.style.display = 'flex';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(0,0,0,0.7)';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.border = 'none';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:600px;background:#fff;border-radius:12px;box-shadow:0 2px 16px #0004;position:relative;padding:32px;">
            <button class="close" style="position:absolute;top:12px;right:16px;font-size:2em;background:none;border:none;cursor:pointer;">&times;</button>
            <div style="display:flex;gap:24px;align-items:flex-start;">
                <img src="${item.poster || item.image || ''}" alt="${item.title}" style="max-width:160px;max-height:220px;border-radius:8px;box-shadow:0 2px 8px #0002;background:#eee;object-fit:cover;">
                <div style="flex:1;">
                    <h2 style="margin-top:0;">${item.title || ''}</h2>
                    <div style="margin-bottom:8px;color:#666;font-size:1em;">
                        <span>${item.year ? `<strong>Year:</strong> ${item.year}` : ''}</span>
                        ${item.genre ? `<span style='margin-left:12px;'><strong>Genre:</strong> ${item.genre}</span>` : ''}
                        ${item.director ? `<span style='margin-left:12px;'><strong>Director:</strong> ${item.director}</span>` : ''}
                    </div>
                    <div style="margin-bottom:8px;color:#666;font-size:1em;">
                        ${item.actors ? `<strong>Cast:</strong> ${item.actors}` : ''}
                    </div>
                    <p style="margin-bottom:12px;">${item.description || ''}</p>
                    <div style="margin-bottom:8px;"><strong>Category:</strong> ${(item.category ? item.category.charAt(0).toUpperCase() + item.category.slice(1) : 'Movie')}</div>
                    <div style="margin-bottom:8px;"><strong>Rating:</strong> ★ <span id="modalRating">${avgRating}</span></div>
                    <div style="margin-bottom:8px;"><strong>Reviews:</strong> <span id="modalReviewCount">${reviewCount}</span> reviews</div>
                    <button class="btn btn-primary" id="writeReviewBtn" style="margin-top:8px;">Write a Review</button>
                    <button class="btn btn-login" style="margin-left:10px;">Add to Favorites</button>
                </div>
            </div>
            <div id="reviewFormContainer" style="display:none; margin-top:20px;">
                <form id="reviewForm">
                    <label for="reviewText">Your Review:</label><br>
                    <textarea id="reviewText" rows="3" style="width:100%;"></textarea><br>
                    <label for="reviewRating">Rating (1-10):</label>
                    <input type="number" id="reviewRating" min="1" max="10" required style="width:60px;">
                    <button type="submit" class="btn btn-primary" style="margin-left:10px;">Submit</button>
                </form>
                <div id="reviewError" style="color:red; margin-top:8px;"></div>
            </div>
            <div style="margin-top:24px;">${reviewsHtml}</div>
        </div>
    `;
    document.body.appendChild(modal);
    console.log('[DEBUG] Modal appended to body:', modal);
    // Add close functionality only once
    const closeBtn = modal.querySelector('.close');
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    document.body.style.overflow = 'hidden';

    // Enable scrolling again after details closed
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.removedNodes.forEach((node) => {
                    if (node === modal) {
                        document.body.style.overflow = 'auto';
                        window._modalOpen = false;
                        observer.disconnect();
                    }
                });
            }
        });
    });
    observer.observe(document.body, { childList: true });

    // Review button logic
    const writeReviewBtn = modal.querySelector('#writeReviewBtn');
    const reviewFormContainer = modal.querySelector('#reviewFormContainer');
    writeReviewBtn.addEventListener('click', () => {
        reviewFormContainer.style.display = 'block';
    });

    // Add to Favorites logic
    const addToFavoritesBtn = modal.querySelector('.btn-login');
    // Use item.id if available, otherwise use a slugified title as the key
    const mediaKey = item.id || item.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    let isFavorite = false;
    if (auth.currentUser) {
        const userId = auth.currentUser.uid;
        const favRef = ref(db, `favorites/${userId}/${mediaKey}`);
        // Check if already favorited
        get(favRef).then(snapshot => {
            if (snapshot.exists()) {
                isFavorite = true;
                addToFavoritesBtn.textContent = 'Remove from Favorites';
            } else {
                isFavorite = false;
                addToFavoritesBtn.textContent = 'Add to Favorites';
            }
        });
    }
    addToFavoritesBtn.addEventListener('click', async () => {
        if (!auth.currentUser) {
            alert('You must be logged in to add favorites.');
            return;
        }
        try {
            const userId = auth.currentUser.uid;
            const favRef = ref(db, `favorites/${userId}/${mediaKey}`);
            if (!isFavorite) {
                // Add to favorites
                await push(favRef, {
                    mediaId: mediaKey,
                    addedAt: new Date().toISOString()
                });
                addToFavoritesBtn.textContent = 'Remove from Favorites';
                isFavorite = true;
            } else {
                // Remove from favorites
                // Remove all entries for this mediaKey (should only be one, but just in case)
                get(favRef).then(snapshot => {
                    if (snapshot.exists()) {
                        const updates = {};
                        Object.keys(snapshot.val()).forEach(key => {
                            updates[`${key}`] = null;
                        });
                        // Remove from db
                        import('https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js').then(({ update }) => {
                            update(favRef, updates);
                        });
                    }
                });
                addToFavoritesBtn.textContent = 'Add to Favorites';
                isFavorite = false;
            }
        } catch (err) {
            alert('Error updating favorites: ' + (err.message || err));
        }
    });

    // Handle review submission (Realtime Database)
    const reviewForm = modal.querySelector('#reviewForm');
    reviewForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const reviewText = modal.querySelector('#reviewText').value.trim();
        const reviewRating = parseInt(modal.querySelector('#reviewRating').value);
        const reviewError = modal.querySelector('#reviewError');
        reviewError.textContent = '';

        // Fallback: Use slugified title as mediaId if item.id is missing
        let mediaId = item.id;
        if (!mediaId && item.title) {
            mediaId = item.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        }
        if (!mediaId) {
            reviewError.textContent = 'Error: Cannot submit review. Media ID is missing.';
            return;
        }

        if (!reviewText || isNaN(reviewRating) || reviewRating < 1 || reviewRating > 10) {
            reviewError.textContent = 'Please enter a review and a rating between 1 and 10.';
            return;
        }

        // Check if user is logged in
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
            reviewError.style.color = 'green';
            reviewError.textContent = 'Review submitted!';

            // Update modal rating and review count
            const newAvgRating = await getAverageRating(item.id);
            const newReviewCount = await getReviewCount(item.id);
            modal.querySelector('#modalRating').textContent = newAvgRating;
            modal.querySelector('#modalReviewCount').textContent = newReviewCount;

            // Refresh reviews list in modal
            const reviewsSnapshot = await get(reviewsRef);
            let reviewsHtml = '';
            if (reviewsSnapshot.exists()) {
                const reviews = Object.values(reviewsSnapshot.val());
                reviewsHtml = `<div style="margin-top:24px;"><h3>All Reviews</h3>`;
                reviewsHtml += reviews.map(r => `
                    <div class="review-block" style="border-bottom:1px solid #eee; margin-bottom:12px; padding-bottom:8px;">
                        <div><strong>Rating:</strong> ★ ${r.rating} <span style="color:#888; font-size:0.9em;">${r.timestamp ? new Date(r.timestamp).toLocaleString() : ''}</span></div>
                        <div style="margin-top:4px;"><strong>Review:</strong> ${r.reviewText}</div>
                    </div>
                `).join('');
                reviewsHtml += `</div>`;
            } else {
                reviewsHtml = `<div style="margin-top:24px; color:#888;">No reviews yet.</div>`;
            }
            // Update reviews section in modal
            modal.querySelector('div[style*="margin-top:24px;"]').outerHTML = reviewsHtml;

            // Optionally, clear form
            reviewForm.reset();
                // Ensure showItemDetails is available globally
                window.showItemDetails = showItemDetails;
            setTimeout(() => {
                reviewError.textContent = '';
                reviewError.style.color = 'red';
                reviewFormContainer.style.display = 'none';
            }, 1200);
        } catch (err) {
            reviewError.textContent = 'Error submitting review: ' + (err.message || err);
        }
    });
}

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
        container.style.background = 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)';
        container.style.padding = '32px 0';
        container.style.borderRadius = '18px';
        container.style.boxShadow = '0 4px 32px #0001';
        container.innerHTML = '';
        const toShow = items.slice(0, visibleCount);
        toShow.forEach(item => {
            const card = document.createElement('div');
            card.className = 'media-card';
            card.dataset.id = item.id || (item.title ? item.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : '');
            card.style.background = 'linear-gradient(120deg, #e0c3fc 0%, #8ec5fc 100%)';
            card.style.borderRadius = '16px';
            card.style.boxShadow = '0 2px 16px #8ec5fc55';
            card.style.margin = '18px auto';
            card.style.width = '220px';
            card.style.height = '340px';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.alignItems = 'center';
            card.style.justifyContent = 'flex-start';
            card.style.padding = '18px 12px 16px 12px';
            card.style.transition = 'transform 0.2s, box-shadow 0.2s';
            card.style.border = '2px solid #c3cfe2';
            card.onmouseover = function() {
                card.style.transform = 'scale(1.04)';
                card.style.boxShadow = '0 6px 32px #8ec5fc99';
            };
            card.onmouseout = function() {
                card.style.transform = 'scale(1)';
                card.style.boxShadow = '0 2px 16px #8ec5fc55';
            };
            card.innerHTML = `
                <div style="display:flex;justify-content:center;align-items:center;width:100%;height:180px;">
                    <img class="card-image" src="${item.poster || item.image || ''}" alt="${item.title || ''}" style="width:120px;height:180px;object-fit:cover;border-radius:8px;background:#eee;box-shadow:0 2px 8px #0002;">
                </div>
                <div class="card-title" style="font-weight:bold;margin-top:12px;text-align:center;color:#4b3f72;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.title || ''}</div>
                <div style="color:#5a5a5a;font-size:0.95em;text-align:center;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.year || ''}</div>
                <div style="color:#6a89cc;font-size:0.9em;text-align:center;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.genre || ''}</div>
            `;
            container.appendChild(card);
        });
        // Add Show More/Show Less button if needed
        if (items.length > visibleCount) {
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary';
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
            btn.className = 'btn btn-secondary';
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
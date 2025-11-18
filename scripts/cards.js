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
    const response = await fetch("Movies/movieList.json");
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
    const movies = await fetchMovies();
    // Combine with other media arrays if needed
    allItems = [...movies, ...tv, ...music, ...games, ...books];
    window.allItems = allItems;

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
window.showMovieModal = showItemDetails;

async function loadCards(category) {
    const container = document.getElementById('cardsContainer');
    if (!container) return;

    // Show loading state
    showLoadingState(container);

    // Simulate loading delay
    setTimeout(async () => {
        let itemsToShow = allItems;

        if (category !== 'all') {
            itemsToShow = allItems.filter(item => item.category === category);
        }

        await renderCards(container, itemsToShow);
    }, 500);
}

function showLoadingState(container) {
    container.innerHTML = '<div class="loading">Loading content...</div>';
}

async function renderCards(container, items) {
    try {
        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No content found</h3>
                    <p>Try selecting a different category or check back later.</p>
                </div>
            `;
            console.log('[cards.js] No items to render');
            return;
        }

        container.innerHTML = items.map(item => createCardHTML(item)).join('');
        console.log(`[cards.js] Rendered ${items.length} cards`);
        // Debug: confirm cards exist in DOM
        const renderedCards = container.querySelectorAll('.media-card');
        console.log('[DEBUG] Cards in DOM:', renderedCards.length);

        // Dynamically update ratings, review count, and latest review from Firestore
        for (const item of items) {
            const card = container.querySelector(`.media-card[data-id='${item.id}']`);
            if (card) {
                const ratingElem = card.querySelector('.card-rating');
                if (ratingElem) {
                    ratingElem.textContent = '★ ' + await getAverageRating(item.id);
                }
                const reviewsElem = card.querySelector('.card-reviews');
                if (reviewsElem) {
                    const count = await getReviewCount(item.id);
                    reviewsElem.textContent = `${count} reviews`;
                }
                // Show latest review (Realtime Database)
                const latestReviewElem = card.querySelector('.card-latest-review');
                if (latestReviewElem) {
                    const reviewsRef = ref(db, `reviews/${item.id}`);
                    const snapshot = await get(reviewsRef);
                    let latest = null;
                    if (snapshot.exists()) {
                        const reviews = Object.values(snapshot.val());
                        reviews.forEach(data => {
                            if (!latest || new Date(data.timestamp) > new Date(latest.timestamp)) {
                                latest = data;
                            }
                        });
                    }
                    latestReviewElem.textContent = latest && latest.reviewText ? `"${latest.reviewText}"` : '';
                }
            }
        }

        // Add click listeners to cards
        addCardListeners();
    } catch (err) {
        container.innerHTML = `<div class="error-state"><h3>Error loading cards</h3><p>${err.message}</p></div>`;
        console.error('[cards.js] Error rendering cards:', err);
    }
}

// Helper function to generate card HTML
function createCardHTML(item) {
    return `
        <div class="media-card" data-id="${item.id || ''}" data-category="${item.category || 'movie'}">
            <div class="card-image" style="background-image: url('${item.poster || item.image || ''}')">
                <div class="card-category">${item.category || 'Movie'}</div>
                <div class="card-rating">★ ${item.rating || ''}</div>
            </div>
            <div class="card-content">
                <h3 class="card-title">${item.title || ''}</h3>
                <p class="card-description">${item.description || ''}</p>
                <div class="card-meta">
                    <span class="card-year">${item.year || ''}</span>
                    <span class="card-director">${item.director ? 'Director: ' + item.director : ''}</span>
                </div>
                <div class="card-actors">${item.actors ? 'Cast: ' + item.actors.replace(/\n/g, ', ') : ''}</div>
                <div class="card-genre">${item.genre ? 'Genre: ' + item.genre : ''}</div>
                <div class="card-latest-review" style="margin-top:8px; font-style:italic; color:#555;"></div>
            </div>
        </div>
    `;
}

function addCardListeners() {
    const cards = document.querySelectorAll('.media-card');
    console.log('[DEBUG] Attaching listeners to cards:', cards.length);
    cards.forEach(card => {
        // Use index as fallback for missing id
        const itemId = card.dataset.id || card.querySelector('.card-title')?.textContent || '';
        const item = allItems.find(item => (item.id && item.id == itemId) || (!item.id && item.title === itemId));
        // Attach click listeners directly to child elements
        const imageElem = card.querySelector('.card-image');
        const titleElem = card.querySelector('.card-title');
        if (imageElem) {
            imageElem.addEventListener('click', function(e) {
                e.stopPropagation();
                console.log('[DEBUG] Card-image clicked:', item);
                if (item) showItemDetails(item);
            });
        }
        if (titleElem) {
            titleElem.addEventListener('click', function(e) {
                e.stopPropagation();
                console.log('[DEBUG] Card-title clicked:', item);
                if (item) showItemDetails(item);
            });
        }
                        // Show only first 8 cards, with Show More button if needed
                        const initialCount = 8;
                        let collapsed = true;
                        let itemsToShow = items.slice(0, initialCount);
                        container.innerHTML = itemsToShow.map(item => createCardHTML(item)).join('');
                        if (items.length > initialCount) {
                            const showMoreBtn = document.createElement('button');
                            showMoreBtn.textContent = 'Show More';
                            showMoreBtn.className = 'btn btn-secondary show-more-btn';
                            showMoreBtn.style.display = 'block';
                            showMoreBtn.style.margin = '24px auto';
                            showMoreBtn.onclick = () => {
                                if (collapsed) {
                                    container.innerHTML = items.map(item => createCardHTML(item)).join('');
                                    showMoreBtn.textContent = 'Show Less';
                                    collapsed = false;
                                } else {
                                    container.innerHTML = items.slice(0, initialCount).map(item => createCardHTML(item)).join('');
                                    showMoreBtn.textContent = 'Show More';
                                    collapsed = true;
                                }
                                container.appendChild(showMoreBtn);
                                // Re-apply dynamic rating/review updates after re-render
                                updateCardStats(collapsed ? itemsToShow : items);
                            };
                            container.appendChild(showMoreBtn);
                        }
                        // Initial dynamic rating/review updates
                        updateCardStats(itemsToShow);

                        function updateCardStats(visibleItems) {
                            for (const item of visibleItems) {
                                const card = container.querySelector(\`.media-card[data-id='\${item.id}']\`);
                                if (card) {
                                    const ratingElem = card.querySelector('.card-rating');
                                    if (ratingElem) {
                                        getAverageRating(item.id).then(avg => ratingElem.textContent = '★ ' + avg);
                                    }
                                    const reviewCountElem = card.querySelector('.card-review-count');
                                    if (reviewCountElem) {
                                        getReviewCount(item.id).then(cnt => reviewCountElem.textContent = cnt + ' reviews');
                                    }
                                }
                            }
                        }
    modal = document.createElement('div');
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
    // Fetch all reviews for this media item
    let reviewsHtml = '';
    try {
        const reviewsRef = ref(db, `reviews/${item.id}`);
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

    // nable scrolling again after details closed
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

            // Optionally, clear form
            reviewForm.reset();
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

// Export function for use by other modules
window.filterCards = filterCards;
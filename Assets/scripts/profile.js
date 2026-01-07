console.log('[Profile] profile.js loaded');
import { ref, get } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { auth, db } from "./firebase.js";
import { tv } from "../TV Shows/tv.js";
import { music } from "../Music/music.js";
import { games } from "../Video Games/games.js";
import { books } from "../Books/books.js";
// Ensure showItemDetails is available if cards.js is loaded
if (window.showItemDetails) {
    window.showItemDetails = window.showItemDetails;
}

const profileInfo = document.getElementById('profileInfo');
const userReviews = document.getElementById('userReviews');
const userFavorites = document.getElementById('userFavorites');
const profileTitle = document.getElementById('profileTitle');
const backHomeBtn = document.getElementById('backHomeBtn');

// Fix: Use window.location.replace for Home button to force navigation
if (backHomeBtn) {
    backHomeBtn.onclick = function(e) {
        e.preventDefault();
        window.location.href = '../index.html';
    };
}

function renderProfile(user) {
    profileTitle.textContent = `${user.displayName || user.email || user.uid}'s Profile`;
    profileInfo.innerHTML = `<strong>Email:</strong> ${user.email || user.uid}<br><span id="profileStats"></span>`;
}

// Helper to update the stats area
function updateProfileStats({ reviewCount, favoriteCount }) {
    const stats = document.getElementById('profileStats');
    if (stats) {
        stats.innerHTML = `
            <strong>Reviews Given:</strong> ${reviewCount} <br>
            <strong>Media Favorites:</strong> ${favoriteCount}
        `;
    }
}

function showLoading(target) {
    target.innerHTML = '<li>Loading...</li>';
}

async function renderReviews(user) {
    showLoading(userReviews);
    const reviewsRef = ref(db, 'reviews');
    const snapshot = await get(reviewsRef);
    userReviews.innerHTML = '';
    let reviewCount = 0;
    if (!snapshot.exists()) {
        userReviews.innerHTML = '<li>No reviews yet.</li>';
        updateProfileStats({ reviewCount: 0, favoriteCount: window._favoriteCount || 0 });
        console.log('[Profile] No reviews found in database.');
        return;
    }
    const reviewsData = snapshot.val();
    console.log('[Profile] All reviews data:', reviewsData);
    const userReviewList = [];
    Object.entries(reviewsData).forEach(([mediaKey, reviewObj]) => {
        Object.values(reviewObj).forEach(r => {
            if (
                r.user === user.email ||
                r.user === user.uid ||
                r.user === user.displayName ||
                r.userId === user.uid // Added support for userId field
            ) {
                userReviewList.push({ mediaKey, ...r });
            }
        });
    });
    console.log('[Profile] Current user:', user);
    console.log('[Profile] Matched user reviews:', userReviewList);
    if (userReviewList.length === 0) {
        userReviews.innerHTML = '<li>No reviews yet.</li>';
        updateProfileStats({ reviewCount: 0, favoriteCount: window._favoriteCount || 0 });
        return;
    }
    // Build a media map for quick lookup
    const movies = await fetchMovies();
    const mediaMap = getAllMediaMap(
        movies,
        Array.isArray(tv) ? tv : [],
        Array.isArray(music) ? music : [],
        Array.isArray(games) ? games : [],
        Array.isArray(books) ? books : []
    );
    console.log('[Profile] Media map for "the_empire_strikes_back":', mediaMap['the_empire_strikes_back']);
    userReviewList.forEach(r => {
        const li = document.createElement('li');
        const reviewContent = r.reviewText || r.text || r.review || '';
        // Show title if available
        const mediaItem = mediaMap[r.mediaKey];
            // Always format title: remove underscores, proper case
            let rawTitle = mediaItem ? mediaItem.title : r.mediaKey;
            let title = rawTitle.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            // Create clickable span for title
            const titleSpan = document.createElement('span');
            titleSpan.textContent = title;
            titleSpan.style.color = '#1976d2';
            titleSpan.style.cursor = 'pointer';
            titleSpan.style.textDecoration = 'underline';
            titleSpan.onclick = async function(e) {
                e.stopPropagation();
                console.log('[Profile] Clicked review title:', title);
                console.log('[Profile] mediaItem:', mediaItem);
                console.log('[Profile] window.showItemDetails:', window.showItemDetails);
                if (mediaItem && window.showItemDetails) {
                    window.showItemDetails(mediaItem);
                } else if (window.showItemDetails) {
                    window.showItemDetails({ title, id: r.mediaKey });
                } else {
                    alert('Media details not found for this review.');
                }
            };
            li.appendChild(titleSpan);
            li.appendChild(document.createTextNode(`: ${reviewContent}`));
        userReviews.appendChild(li);
        reviewCount++;
    });
    window._reviewCount = reviewCount;
    updateProfileStats({ reviewCount, favoriteCount: window._favoriteCount || 0 });
}

async function fetchMovies() {
    const response = await fetch("Assets/Movies/movieList.json");
    return await response.json();
}

function getAllMediaMap(movies, tv, music, games, books) {
    const all = [...movies, ...tv, ...music, ...games, ...books];
    const map = {};
    all.forEach(item => {
            if (item.title) {
                const normTitle = item.title.trim().toLowerCase();
                const key = normTitle.replace(/[^a-zA-Z0-9]/g, '_');
            map[key] = item;
        }
    });
    return map;
}

function createCardHTML(item) {
    return `
        <div class="media-card favorite-card" data-id="${item.id || item.title}" style="margin:12px;max-width:260px;display:inline-block;vertical-align:top;position:relative;cursor:pointer;">
            ${window.favoritesEditMode ? `<button class=\"remove-favorite-btn\" title=\"Remove from favorites\" style=\"position:absolute;top:8px;right:8px;background:#e53e3e;color:white;border:none;border-radius:50%;width:28px;height:28px;font-size:18px;z-index:2;cursor:pointer;\">&times;</button>` : ''}
            <div class="card-image" style="background-image: url('${item.poster || item.image || ''}');height:180px;background-size:cover;background-position:center;"></div>
            <div class="card-content">
                <h3 class="card-title">${item.title || ''}</h3>
            </div>
        </div>
    `;
}

async function renderFavorites(user) {
    const container = document.getElementById('userFavorites');
    if (!container) return;
    container.innerHTML = '<div>Loading favorites...</div>';
    const userId = user.uid || user.email || user.displayName;
    const favRef = ref(db, `favorites/${userId}`);
    const snapshot = await get(favRef);
    if (!snapshot.exists()) {
        container.innerHTML = '<div>No favorites yet.</div>';
        window._favoriteCount = 0;
        updateProfileStats({ reviewCount: window._reviewCount || 0, favoriteCount: 0 });
        return;
    }
    const favKeys = Object.keys(snapshot.val() || {});
    const movies = await fetchMovies();
    const mediaMap = getAllMediaMap(movies, tv, music, games, books);
    const favoriteItems = favKeys.map(key => mediaMap[key]).filter(Boolean);
    window._favoriteCount = favoriteItems.length;
    updateProfileStats({ reviewCount: window._reviewCount || 0, favoriteCount: favoriteItems.length });
    if (favoriteItems.length === 0) {
        container.innerHTML = '<div>No favorites found in your media library.</div>';
        return;
    }
    container.innerHTML = favoriteItems.map(createCardHTML).join('');
    setTimeout(() => {
        const cards = Array.from(container.querySelectorAll('.favorite-card'));
        cards.forEach(card => {
            const id = card.getAttribute('data-id');
            const item = favoriteItems.find(fav => (fav.id || fav.title) == id);
            if (!item) return;
            if (window.favoritesEditMode) {
                const removeBtn = card.querySelector('.remove-favorite-btn');
                if (removeBtn) {
                    removeBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        await removeFavorite(userId, id, card);
                    });
                }
                card.style.cursor = 'default';
            } else {
                card.addEventListener('click', function() {
                    if (window.favoritesEditMode) return;
                    if (item) showFavoriteModal(item);
                });
            }
        });
    }, 0);

}

window.favoritesEditMode = false;

async function removeFavorite(userId, id, cardElem) {
    // Remove from Firebase
    const favRef = ref(db, `favorites/${userId}/${id}`);
    await import('https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js').then(({ remove }) => remove(favRef));
    // Remove from UI
    if (cardElem) cardElem.remove();
    // Update stats
    window._favoriteCount = Math.max(0, (window._favoriteCount || 1) - 1);
    updateProfileStats({ reviewCount: window._reviewCount || 0, favoriteCount: window._favoriteCount });
}

// Edit Favorites button logic

}

// Modal logic for favorite details
function showFavoriteModal(item) {
    let modal = document.getElementById('movieDetailModal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'movieDetailModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:600px;">
            <span class="close" id="closeMovieModal">&times;</span>
            <div class="modal-header" style="margin-bottom:12px;">
                <h2 style="margin-bottom:0;">${item.title || ''}</h2>
            </div>
            <div class="modal-body" style="display:flex; gap:18px;">
                <img src="${item.poster || item.image || ''}" alt="${item.title}" style="max-width:180px; border-radius:8px; box-shadow:0 2px 8px #0002;">
                <div style="flex:1;">
                    <p><strong>Year:</strong> ${item.year || ''}</p>
                    <p><strong>Genre:</strong> ${item.genre || ''}</p>
                    <p><strong>Director:</strong> ${item.director || ''}</p>
                    <p><strong>Cast:</strong> ${item.actors || ''}</p>
                    <p><strong>Description:</strong> ${item.description || ''}</p>
                </div>
            </div>
            <hr style="margin:18px 0;">
            <div id="reviewsSection" style="margin-top:12px;">
                <h3 style="margin-bottom:8px;">Reviews</h3>
                <div id="reviewsList" style="margin-bottom:12px;">Loading reviews...</div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'block';
    document.getElementById('closeMovieModal').onclick = function() {
        modal.remove();
    };
    modal.onclick = function(e) {
        if (e.target === modal) modal.remove();
    };
    // Load reviews for this item
    loadFavoriteReviews(item);
}

// Load reviews for favorite modal
async function loadFavoriteReviews(item) {
    const reviewsList = document.getElementById('reviewsList');
    if (!reviewsList) return;
    reviewsList.innerHTML = 'Loading reviews...';
    const reviewsRef = ref(db, 'reviews');
    const snapshot = await get(reviewsRef);
    if (!snapshot.exists()) {
        reviewsList.innerHTML = '<div>No reviews yet.</div>';
        return;
    }
    const reviewsData = snapshot.val();
    let reviewArr = [];
    // Try to match by id or title
    const key = item.id || (item.title ? item.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : '');
    if (reviewsData[key]) {
        reviewArr = Object.values(reviewsData[key]);
    } else {
        // Try to match by title if id not found
        for (const k in reviewsData) {
            if (k === item.title || k === key) {
                reviewArr = Object.values(reviewsData[k]);
                break;
            }
        }
    }
    if (reviewArr.length === 0) {
        reviewsList.innerHTML = '<div>No reviews yet.</div>';
        return;
    }
    reviewsList.innerHTML = reviewArr.map(r => `<div style="margin-bottom:8px;"><strong>${r.user || 'Anonymous'}:</strong> ${r.text || r.review || ''}</div>`).join('');
}

// On load, check auth and render profile
auth.onAuthStateChanged(async (user) => {
    console.log('[Profile] Auth state changed:', user);
    if (!user) {
        window.location.href = '../index.html';
        return;
    }
    renderProfile(user);
    await renderReviews(user);
    await renderFavorites(user);
    // Attach Edit Favorites button handler after DOM and profile are rendered
    const editBtn = document.getElementById('editFavoritesBtn');
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            window.favoritesEditMode = !window.favoritesEditMode;
            editBtn.textContent = window.favoritesEditMode ? 'Done' : 'Edit Favorites';
            renderFavorites(user);
        });
    }
});

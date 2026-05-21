import { getDatabase, ref, get, set, remove } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { app, auth } from './firebase.js';
import { fetchMovies, fetchTV, fetchBooks } from './main.js';
import { music } from "./music.js";
import { games } from "./games.js";

const mediaItemCache = {};

window.openMediaDetails = (mediaId) => {
    const mediaItem = mediaItemCache[mediaId];
    if (mediaItem && window.showItemDetails) {
        window.showItemDetails(mediaItem);
    } else {
        console.error('Media item not found or showItemDetails is not available.');
    }
};

function createFeedItem(review, reviewer, mediaItem, isOwner) {
    const item = document.createElement('div');
    item.className = 'bg-slate-800 rounded-lg p-6 border border-slate-700 flex flex-col sm:flex-row gap-6 relative group';
    item.dataset.category = review.mediaCategory || (mediaItem ? (mediaItem.category || 'unknown') : 'unknown');

    const mediaPoster = mediaItem ? (mediaItem.poster || mediaItem.image) : 'https://via.placeholder.com/100x150.png?text=No+Image';
    const mediaTitle = mediaItem ? mediaItem.title : review.mediaTitle;
    const mediaId = `media-${review.id}`;
    
    if (mediaItem) {
        mediaItemCache[mediaId] = mediaItem;
    }

    const editButton = isOwner ? `
        <button class="edit-review-btn absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100" data-review-id="${review.id}" data-media-id="${review.mediaId}">
            <i data-lucide="edit-2" class="w-4 h-4"></i>
        </button>
    ` : '';

    item.innerHTML = `
        ${editButton}
        <div class="w-24 mx-auto sm:mx-0 flex-shrink-0 cursor-pointer" onclick="openMediaDetails('${mediaId}')">
            <img src="${mediaPoster}" alt="${mediaTitle}" class="w-full h-auto rounded-md">
        </div>
        <div class="flex-grow text-center sm:text-left">
            <div class="flex items-center justify-center sm:justify-start gap-3 mb-2 flex-wrap">
                <img src="${reviewer.avatar}" alt="${reviewer.username}" class="w-8 h-8 rounded-full">
                <span class="font-semibold text-white">${reviewer.username}</span>
                <span class="text-xs text-slate-400">reviewed</span>
                <span class="font-semibold text-indigo-400 cursor-pointer break-all" onclick="openMediaDetails('${mediaId}')">${mediaTitle}</span>
            </div>
            <div class="flex items-center justify-center sm:justify-start gap-1 mb-3 text-yellow-400">
                <i data-lucide="star" class="w-4 h-4 fill-current"></i>
                <span class="font-bold">${review.rating}</span>
                <span class="text-xs text-slate-400 ml-1">/ 10</span>
            </div>
            <div class="review-body break-words">${review.reviewText}</div>
            <p class="text-xs text-slate-500 mt-4">${new Date(review.timestamp).toLocaleString()}</p>
        </div>
    `;

    return item;
}

function createWatchlistItem(item) {
    const listItem = document.createElement('div');
    listItem.className = 'flex items-center gap-4 p-2 rounded-lg hover:bg-slate-700/50 transition-colors cursor-pointer';
    listItem.dataset.category = item.category || 'unknown';

    const poster = item.poster || item.image || 'https://via.placeholder.com/100x150.png?text=No+Image';
    
    listItem.innerHTML = `
        <div class="w-12 flex-shrink-0">
            <img src="${poster}" alt="${item.title}" class="w-full h-auto rounded-md">
        </div>
        <div class="flex-grow">
            <h4 class="text-white font-semibold break-all">${item.title}</h4>
            <p class="text-slate-400 text-sm">${item.year || 'N/A'}</p>
        </div>
    `;

    listItem.onclick = () => {
        if (window.showItemDetails) {
            window.showItemDetails(item);
        } else {
            console.warn('showItemDetails function not found. Ensure cards.js is loaded.');
        }
    };
    
    return listItem;
}

// ── Favorites ────────────────────────────────────────────────────────────────

function renderFavoritesSection(favData, allMedia, mediaMap, isOwner, db, reviewerId) {
    // reviewer-profile.html uses #favoritesSection (renders heading + grid)
    // userprofile.html uses #userFavorites (heading already in HTML, render grid only)
    const fullContainer = document.getElementById('favoritesSection');
    const inlineContainer = document.getElementById('userFavorites');
    if (!fullContainer && !inlineContainer) return;

    const gridHTML = `
        <div class="overflow-x-auto pb-1">
            <div class="grid grid-cols-5 gap-2 min-w-[280px]" id="favoriteSlots"></div>
        </div>
    `;

    if (fullContainer) {
        fullContainer.innerHTML = `
            <h3 class="text-base font-semibold text-white mb-3">Top 5 Favorites</h3>
            ${gridHTML}
        `;
    } else {
        inlineContainer.innerHTML = gridHTML;
    }

    const slotsEl = document.getElementById('favoriteSlots');
    for (let i = 0; i < 5; i++) {
        const mediaId = favData[i] || null;
        const mediaItem = mediaId ? (mediaMap[mediaId] || null) : null;
        slotsEl.appendChild(buildFavoriteSlot(mediaItem, i, isOwner, allMedia, db, reviewerId, mediaMap));
    }
    if (window.lucide) lucide.createIcons();
}

function buildFavoriteSlot(mediaItem, index, isOwner, allMedia, db, reviewerId, mediaMap) {
    const wrapper = document.createElement('div');
    wrapper.dataset.slotIndex = index;

    if (mediaItem) {
        const poster = mediaItem.poster || mediaItem.image || '';
        wrapper.className = 'relative group cursor-default';
        wrapper.innerHTML = `
            <img src="${poster}" alt="${mediaItem.title}"
                 class="w-full aspect-[2/3] object-cover rounded-lg border border-slate-700 shadow-md">
            <div class="absolute inset-0 rounded-lg bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span class="text-white text-xs font-medium line-clamp-2 leading-tight">${mediaItem.title}</span>
            </div>
            ${isOwner ? `<button class="slot-clear-btn absolute top-1 right-1 w-5 h-5 bg-black/70 hover:bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">✕</button>` : ''}
        `;
        if (isOwner) {
            wrapper.querySelector('.slot-clear-btn').addEventListener('click', async () => {
                await remove(ref(db, `favorites/${reviewerId}/${index}`));
                wrapper.replaceWith(buildFavoriteSlot(null, index, isOwner, allMedia, db, reviewerId, mediaMap));
                if (window.lucide) lucide.createIcons();
            });
        }
    } else if (isOwner) {
        wrapper.innerHTML = `
            <button class="slot-add-btn w-full aspect-[2/3] rounded-lg border-2 border-dashed border-slate-600 hover:border-indigo-500 hover:bg-indigo-500/5 flex flex-col items-center justify-center gap-1.5 transition-colors">
                <i data-lucide="plus" class="w-6 h-6 text-slate-500"></i>
                <span class="text-slate-500 text-xs font-medium">Add</span>
            </button>
        `;
        wrapper.querySelector('.slot-add-btn').addEventListener('click', () => {
            openFavoriteSearch(wrapper, index, isOwner, allMedia, db, reviewerId, mediaMap);
        });
    } else {
        wrapper.innerHTML = `<div class="w-full aspect-[2/3] rounded-lg border border-dashed border-slate-700/40 bg-slate-800/30"></div>`;
    }

    return wrapper;
}

function openFavoriteSearch(wrapper, index, isOwner, allMedia, db, reviewerId, mediaMap) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm';
    overlay.innerHTML = `
        <div class="bg-slate-800 rounded-xl w-full max-w-sm shadow-2xl border border-slate-700">
            <div class="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-700">
                <h4 class="text-white font-semibold text-sm">Add to Favorites</h4>
                <button class="close-btn text-slate-400 hover:text-white text-xl leading-none">&times;</button>
            </div>
            <div class="p-4">
                <input type="text"
                    class="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 placeholder-slate-500"
                    placeholder="Search for a title…"
                    autocomplete="off"
                >
                <div class="search-results mt-3 space-y-1 max-h-64 overflow-y-auto"></div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    const input = overlay.querySelector('input');
    const resultsList = overlay.querySelector('.search-results');
    input.focus();

    function close() {
        overlay.remove();
    }

    overlay.querySelector('.close-btn').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); }
    });

    input.addEventListener('input', () => {
        const term = input.value.trim().toLowerCase();
        resultsList.innerHTML = '';
        if (term.length < 2) return;

        allMedia
            .filter(item => item.title && item.title.toLowerCase().includes(term))
            .slice(0, 8)
            .forEach(item => {
                const poster = item.poster || item.image || '';
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-slate-200 hover:bg-indigo-600 rounded-lg transition-colors';
                btn.innerHTML = poster
                    ? `<img src="${poster}" class="w-8 h-11 object-cover rounded flex-shrink-0"><span class="truncate">${item.title}</span>`
                    : `<span class="truncate">${item.title}</span>`;
                btn.addEventListener('click', async () => {
                    const titleSlug = item.title.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                    const cat = Array.isArray(item.category) ? item.category[0] : (item.category || '');
                    const catSlug = cat.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                    const mediaId = catSlug ? `${catSlug}_${titleSlug}` : titleSlug;
                    await set(ref(db, `favorites/${reviewerId}/${index}`), mediaId);
                    wrapper.replaceWith(buildFavoriteSlot(item, index, isOwner, allMedia, db, reviewerId, mediaMap));
                    if (window.lucide) lucide.createIcons();
                    close();
                });
                resultsList.appendChild(btn);
            });
    });
}

// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Content Loaded, starting script.");
    lucide.createIcons();

    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    const params = new URLSearchParams(window.location.search);
    const urlReviewerId = params.get('id');
    console.log("Reviewer ID from URL:", urlReviewerId);

    if (urlReviewerId) {
        loadProfile(urlReviewerId);
    } else {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                loadProfile(user.uid);
            } else {
                const container = document.getElementById('profile-container');
                if (container) {
                    container.innerHTML = '<p class="text-center text-red-500">Reviewer ID not provided and you are not logged in.</p>';
                }
            }
        });
    }
});

async function loadProfile(reviewerId) {
    const db = getDatabase(app);
    const reviewerRef = ref(db, 'reviewers/' + reviewerId);
    
    try {
        console.log("Fetching reviewer data from Firebase...");
        const snapshot = await get(reviewerRef);
        let reviewerData = snapshot.val();

        if (!snapshot.exists()) {
            // Fallback: If viewing own profile but data is missing, create default data
            const currentUser = auth.currentUser;
            if (currentUser && currentUser.uid === reviewerId) {
                console.log("Profile missing in DB, creating default...");
                reviewerData = {
                    name: currentUser.displayName || currentUser.email.split('@')[0],
                    email: currentUser.email,
                    bio: "Welcome to my profile!",
                    createdAt: new Date().toISOString()
                };
                await set(reviewerRef, reviewerData);
            } else {
                document.getElementById('profile-container').innerHTML = '<p class="text-center text-red-500">Reviewer not found.</p>';
                return;
            }
        }

        console.log("Reviewer Data:", reviewerData);

        const reviewerForFeed = {
            id: reviewerId,
            username: reviewerData.name,
            avatar: reviewerData.avatar,
            bio: reviewerData.bio,
            following: [],
            followers: 0
        };

        console.log("Populating profile info...");
        const profileAvatar = document.getElementById('profileAvatar');
        if (profileAvatar) {
            profileAvatar.src = reviewerData.avatar || 'https://via.placeholder.com/150';
            profileAvatar.alt = reviewerData.name;
        }
        
        // For reviewer-profile.html
        const profileName = document.getElementById('profileName');
        if (profileName) profileName.textContent = reviewerData.name;
        
        const profileBio = document.getElementById('profileBio');
        if (profileBio) profileBio.textContent = reviewerData.bio || 'No bio provided.';
        
        // For userprofile.html
        const profileTitle = document.getElementById('profileTitle');
        if (profileTitle && auth.currentUser && auth.currentUser.uid === reviewerId) {
            profileTitle.textContent = `${reviewerData.name}'s Profile`;
        }

        const profileInfoContainer = document.getElementById('profileInfo');
        if (profileInfoContainer) {
            const joinDate = reviewerData.createdAt ? new Date(reviewerData.createdAt).toLocaleDateString() : 'Unknown';
            profileInfoContainer.innerHTML = `
                <p class="text-sm"><strong>Bio:</strong> ${reviewerData.bio || 'No bio provided.'}</p>
                <p class="text-sm mt-1"><strong>Favorite Genres:</strong> ${reviewerData.genres || 'N/A'}</p>
                <p class="text-xs text-slate-500 mt-2">Joined: ${joinDate}</p>
            `;
        }

        console.log("Fetching media...");
        const [movies, tvData, booksData] = await Promise.all([fetchMovies(), fetchTV(), fetchBooks()]);
        const allMedia = [...movies, ...tvData, ...music, ...games, ...booksData].filter(item => item && item.title);
        console.log("Total media items:", allMedia.length);
        
        let allReviews = [];
        console.log("Fetching all reviews...");
        
        // Create a map for faster media lookup
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

        const reviewsRef = ref(db, 'reviews');
        const reviewsSnapshot = await get(reviewsRef);

        if (reviewsSnapshot.exists()) {
            const reviewsData = reviewsSnapshot.val();
            Object.entries(reviewsData).forEach(([mediaId, reviews]) => {
                Object.entries(reviews).forEach(([reviewId, review]) => {
                    if (review.userId === reviewerId) {
                        const mediaItem = mediaMap[mediaId];
                        allReviews.push({
                            ...review,
                            id: reviewId,
                            mediaId: mediaId,
                            mediaTitle: mediaItem ? mediaItem.title : mediaId.replace(/_/g, ' '),
                            mediaCategory: mediaItem ? (mediaItem.category || 'unknown') : 'unknown'
                        });
                    }
                });
            });
        }
        console.log("Found reviews for this user:", allReviews.length);

        const isOwner = auth.currentUser && auth.currentUser.uid === reviewerId;

        // Render favorites section (non-fatal if rules block read)
        let favData = {};
        try {
            const favSnap = await get(ref(db, `favorites/${reviewerId}`));
            if (favSnap.exists()) favData = favSnap.val();
        } catch (e) {
            console.warn('Favorites read blocked — check Firebase rules:', e.message);
        }
        renderFavoritesSection(favData, allMedia, mediaMap, isOwner, db, reviewerId);

        const userReviewsContainer = document.getElementById('userReviews');
        if (allReviews.length > 0) {
            userReviewsContainer.innerHTML = '';
            allReviews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            allReviews.forEach(review => {
                const mediaItem = allMedia.find(m => m.title.trim() === review.mediaTitle.trim());
                const feedItem = createFeedItem(review, reviewerForFeed, mediaItem, isOwner);
                userReviewsContainer.appendChild(feedItem);
            });
        } else {
            userReviewsContainer.innerHTML = '<p class="text-slate-500 text-center">This reviewer has not posted any reviews yet.</p>';
        }

        // Fetch and Render Watchlist
        console.log("Fetching watchlist...");
        const watchlistContainer = document.getElementById('userWatchlist');
        if (watchlistContainer) {
            const watchlistRef = ref(db, `watchlist/${reviewerId}`);
            const watchlistSnapshot = await get(watchlistRef);
            
            if (watchlistSnapshot.exists()) {
                const watchlistData = watchlistSnapshot.val();
                const watchlistItems = [];
                
                Object.keys(watchlistData).forEach(mediaKey => {
                    const mediaItem = mediaMap[mediaKey];
                    if (mediaItem) {
                        watchlistItems.push(mediaItem);
                    }
                });

                watchlistContainer.innerHTML = '';
                if (watchlistItems.length > 0) {
                    watchlistContainer.className = 'space-y-2';
                    watchlistItems.forEach(item => {
                        watchlistContainer.appendChild(createWatchlistItem(item));
                    });
                } else {
                    watchlistContainer.innerHTML = '<p class="text-slate-500 text-center col-span-full">Watchlist is empty.</p>';
                }
            } else {
                watchlistContainer.innerHTML = '<p class="text-slate-500 text-center col-span-full">Watchlist is empty.</p>';
            }
        }

    } catch (error) {
        console.error("An error occurred:", error);
        const container = document.getElementById('profile-container');
        if (container) {
            container.innerHTML = `<p class="text-center text-red-500">An error occurred while loading the profile: ${error.message}</p>`;
        }
    }

    lucide.createIcons();
}
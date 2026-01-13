import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { app, auth } from './firebase.js';
import { fetchMovies } from './main.js';
import { tv } from "../TV Shows/tv.js";
import { music } from "../Music/music.js";
import { games } from "../Video Games/games.js";
import { books } from "../Books/books.js";

function createFeedItem(review, reviewer, mediaItem, isOwner) {
    const item = document.createElement('div');
    item.className = 'bg-slate-800 rounded-lg p-6 border border-slate-700 flex gap-6 relative group';

    const mediaPoster = mediaItem ? (mediaItem.poster || mediaItem.image) : 'https://via.placeholder.com/100x150.png?text=No+Image';
    const mediaTitle = mediaItem ? mediaItem.title : review.mediaTitle;

    const editButton = isOwner ? `
        <button class="edit-review-btn absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100" data-review-id="${review.id}" data-media-id="${review.mediaId}">
            <i data-lucide="edit-2" class="w-4 h-4"></i>
        </button>
    ` : '';

    item.innerHTML = `
        ${editButton}
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
            <div class="flex items-center gap-1 mb-3 text-yellow-400">
                <i data-lucide="star" class="w-4 h-4 fill-current"></i>
                <span class="font-bold">${review.rating}</span>
                <span class="text-xs text-slate-400 ml-1">/ 10</span>
            </div>
            <div class="review-body">${review.reviewText}</div>
            <p class="text-xs text-slate-500 mt-4">${new Date(review.timestamp).toLocaleString()}</p>
        </div>
    `;
    return item;
}

function createWatchlistCard(item) {
    const card = document.createElement('div');
    card.className = 'bg-slate-800 rounded-lg overflow-hidden border border-slate-700 hover:border-indigo-500 transition-all cursor-pointer group relative';
    
    const poster = item.poster || item.image || 'https://via.placeholder.com/300x450';
    
    card.innerHTML = `
        <div class="aspect-[2/3] relative">
            <img src="${poster}" alt="${item.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
            <div class="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-80"></div>
            <div class="absolute bottom-0 left-0 p-3 w-full">
                <h4 class="text-white font-bold text-sm line-clamp-2 leading-tight">${item.title}</h4>
                <p class="text-indigo-400 text-xs mt-1">${item.year || 'N/A'}</p>
            </div>
        </div>
    `;
    
    card.onclick = () => {
        if (window.showItemDetails) {
            window.showItemDetails(item);
        } else {
            console.warn('showItemDetails function not found. Ensure cards.js is loaded.');
        }
    };
    
    return card;
}

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
                    avatar: "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png",
                    bio: "Welcome to my profile!",
                    genres: "General",
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
        
        const profileGenres = document.getElementById('profileGenres');
        if (profileGenres) profileGenres.textContent = `Genres: ${reviewerData.genres || 'N/A'}`;

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
        const movies = await fetchMovies();
        const allMedia = [...movies, ...tv, ...music, ...games, ...books].filter(item => item && item.title);
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
                            mediaTitle: mediaItem ? mediaItem.title : mediaId.replace(/_/g, ' ') 
                        });
                    }
                });
            });
        }
        console.log("Found reviews for this user:", allReviews.length);

        const isOwner = auth.currentUser && auth.currentUser.uid === reviewerId;

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
                    watchlistContainer.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4';
                    watchlistItems.forEach(item => {
                        watchlistContainer.appendChild(createWatchlistCard(item));
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
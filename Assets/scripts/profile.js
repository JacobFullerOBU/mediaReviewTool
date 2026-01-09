import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { app } from './firebase.js';
import { tv } from "../TV Shows/tv.js";
import { music } from "../Music/music.js";
import { games } from "../Video Games/games.js";
import { books } from "../Books/books.js";

function createFeedItem(review, reviewer, mediaItem) {
    const item = document.createElement('div');
    item.className = 'bg-slate-800 rounded-lg p-6 border border-slate-700 flex gap-6';

    const mediaPoster = mediaItem ? (mediaItem.poster || mediaItem.image) : 'https://via.placeholder.com/100x150.png?text=No+Image';
    const mediaTitle = mediaItem ? mediaItem.title : review.mediaTitle;

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
                ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}
                <span class="text-xs text-slate-400 ml-2">(${review.rating}/5)</span>
            </div>
            <p class="text-slate-300">${review.reviewText}</p>
            <p class="text-xs text-slate-500 mt-4">${new Date(review.timestamp).toLocaleString()}</p>
        </div>
    `;
    return item;
}

async function fetchMovies() {
    try {
        const response = await fetch("Assets/Movies/movieList.json");
        if (!response.ok) {
            console.error("Failed to fetch movies:", response.statusText);
            return [];
        }
        return await response.json();
    } catch (error) {
        console.error("Error fetching movies:", error);
        return [];
    }
}

document.addEventListener('DOMContentLoaded', async () => {
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
    const reviewerId = params.get('id');
    console.log("Reviewer ID from URL:", reviewerId);


    if (!reviewerId) {
        document.getElementById('profile-container').innerHTML = '<p class="text-center text-red-500">Reviewer ID not provided.</p>';
        return;
    }

    const db = getDatabase(app);
    const reviewerRef = ref(db, 'reviewers/' + reviewerId);
    
    try {
        console.log("Fetching reviewer data from Firebase...");
        const snapshot = await get(reviewerRef);
        if (!snapshot.exists()) {
            console.log("Reviewer not found in Firebase.");
            document.getElementById('profile-container').innerHTML = '<p class="text-center text-red-500">Reviewer not found.</p>';
            return;
        }

        const reviewerData = snapshot.val();
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
        document.getElementById('profileAvatar').src = reviewerData.avatar || 'https://via.placeholder.com/150';
        document.getElementById('profileAvatar').alt = reviewerData.name;
        document.getElementById('profileName').textContent = reviewerData.name;
        document.getElementById('profileBio').textContent = reviewerData.bio || 'No bio provided.';
        document.getElementById('profileGenres').textContent = `Genres: ${reviewerData.genres || 'N/A'}`;

        console.log("Fetching media...");
        const movies = await fetchMovies();
        const allMedia = [...movies, ...tv, ...music, ...games, ...books].filter(item => item && item.title);
        console.log("Total media items:", allMedia.length);
        
        let allReviews = [];
        console.log("Fetching reviews for all media...");
        for (const media of allMedia) {
            const mediaId = media.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            const reviewsRef = ref(db, `reviews/${mediaId}`);
            const reviewsSnapshot = await get(reviewsRef);
            if (reviewsSnapshot.exists()) {
                const reviews = reviewsSnapshot.val();
                Object.values(reviews).forEach(review => {
                    if (review.userId === reviewerId) {
                        allReviews.push({ ...review, mediaTitle: media.title });
                    }
                });
            }
        }
        console.log("Found reviews for this user:", allReviews.length);

        const userReviewsContainer = document.getElementById('userReviews');
        if (allReviews.length > 0) {
            userReviewsContainer.innerHTML = '';
            allReviews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            allReviews.forEach(review => {
                const mediaItem = allMedia.find(m => m.title.trim() === review.mediaTitle.trim());
                const feedItem = createFeedItem(review, reviewerForFeed, mediaItem);
                userReviewsContainer.appendChild(feedItem);
            });
        } else {
            userReviewsContainer.innerHTML = '<p class="text-slate-500 text-center">This reviewer has not posted any reviews yet.</p>';
        }

    } catch (error) {
        console.error("An error occurred:", error);
        document.getElementById('profile-container').innerHTML = `<p class="text-center text-red-500">An error occurred while loading the profile: ${error.message}</p>`;
    }

    lucide.createIcons();
});
import { ref, get } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { auth, db } from "../scripts/firebase.js";
import { tv } from "../TV Shows/tv.js";
import { music } from "../Music/music.js";
import { games } from "../Video Games/games.js";
import { books } from "../Books/books.js";

async function fetchMovies() {
    const response = await fetch("../Movies/movieList.json");
    return await response.json();
}

function getAllMediaMap(movies, tv, music, games, books) {
    const all = [...movies, ...tv, ...music, ...games, ...books];
    const map = {};
    all.forEach(item => {
        const key = item.id || (item.title ? item.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : '');
        if (key) map[key] = item;
    });
    return map;
}

function createCardHTML(item) {
    return `
        <div class="media-card" style="margin:12px;max-width:260px;display:inline-block;vertical-align:top;">
            <div class="card-image" style="background-image: url('${item.poster || item.image || ''}');height:180px;background-size:cover;background-position:center;"></div>
            <div class="card-content">
                <h3 class="card-title">${item.title || ''}</h3>
                <p class="card-description">${item.description || ''}</p>
                <div class="card-meta">
                    <span class="card-year">${item.year || ''}</span>
                    <span class="card-director">${item.director ? 'Director: ' + item.director : ''}</span>
                </div>
                <div class="card-actors">${item.actors ? 'Cast: ' + item.actors.replace(/\n/g, ', ') : ''}</div>
                <div class="card-genre">${item.genre ? 'Genre: ' + item.genre : ''}</div>
            </div>
        </div>
    `;
}

async function renderFavorites() {
    const container = document.getElementById('favoritesContainer');
    if (!container) return;
    container.innerHTML = '<div>Loading favorites...</div>';
    auth.onAuthStateChanged(async user => {
        if (!user) {
            container.innerHTML = '<div>Please log in to see your favorites.</div>';
            return;
        }
        const userId = user.uid;
        const favRef = ref(db, `favorites/${userId}`);
        const snapshot = await get(favRef);
        if (!snapshot.exists()) {
            container.innerHTML = '<div>No favorites yet.</div>';
            return;
        }
        const favKeys = Object.keys(snapshot.val() || {});
        const movies = await fetchMovies();
        const mediaMap = getAllMediaMap(movies, tv, music, games, books);
        const favoriteItems = favKeys.map(key => mediaMap[key]).filter(Boolean);
        if (favoriteItems.length === 0) {
            container.innerHTML = '<div>No favorites found in your media library.</div>';
            return;
        }
        container.innerHTML = '<h2>Your Favorites</h2>' + favoriteItems.map(createCardHTML).join('');
    });
}

async function renderProfile() {
    auth.onAuthStateChanged(async user => {
        const profileTitle = document.getElementById('profileTitle');
        const profileInfo = document.getElementById('profileInfo');
        const userReviews = document.getElementById('userReviews');
        const userFavorites = document.getElementById('userFavorites');
        if (!user) {
            profileTitle.textContent = 'Your Profile';
            profileInfo.innerHTML = '<div>Please log in to see your profile.</div>';
            userReviews.innerHTML = '';
            userFavorites.innerHTML = '';
            return;
        }
        profileTitle.textContent = `${user.displayName || user.email || user.uid}'s Profile`;
        profileInfo.innerHTML = `<strong>Email:</strong> ${user.email || user.uid}`;
        // Reviews
        userReviews.innerHTML = '<li>Loading reviews...</li>';
        const reviewsRef = ref(db, 'reviews');
        const reviewsSnap = await get(reviewsRef);
        let reviewCount = 0;
        if (reviewsSnap.exists()) {
            const reviewsData = reviewsSnap.val();
            const userReviewList = [];
            Object.entries(reviewsData).forEach(([mediaKey, reviewObj]) => {
                Object.values(reviewObj).forEach(r => {
                    if (r.user === user.email || r.user === user.uid || r.user === user.displayName) {
                        userReviewList.push({ mediaKey, ...r });
                    }
                });
            });
            if (userReviewList.length > 0) {
                userReviews.innerHTML = '';
                userReviewList.forEach(r => {
                    const li = document.createElement('li');
                    li.innerHTML = `<strong>${r.mediaKey}</strong>: ${r.text || r.review || ''}`;
                    userReviews.appendChild(li);
                    reviewCount++;
                });
            } else {
                userReviews.innerHTML = '<li>No reviews yet.</li>';
            }
        } else {
            userReviews.innerHTML = '<li>No reviews yet.</li>';
        }
        // Favorites
        userFavorites.innerHTML = '<li>Loading favorites...</li>';
        const favRef = ref(db, `favorites/${user.uid || user.email || user.displayName}`);
        const favSnap = await get(favRef);
        if (favSnap.exists()) {
            const favKeys = Object.keys(favSnap.val() || {});
            const movies = await fetchMovies();
            const mediaMap = getAllMediaMap(movies, tv, music, games, books);
            const favoriteItems = favKeys.map(key => mediaMap[key]).filter(Boolean);
            if (favoriteItems.length > 0) {
                userFavorites.innerHTML = '';
                favoriteItems.forEach(item => {
                    const li = document.createElement('li');
                    li.innerHTML = `<strong>${item.title || item.id}</strong>`;
                    userFavorites.appendChild(li);
                });
            } else {
                userFavorites.innerHTML = '<li>No favorites found in your media library.</li>';
            }
        } else {
            userFavorites.innerHTML = '<li>No favorites yet.</li>';
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    renderFavorites();
    renderProfile();
});

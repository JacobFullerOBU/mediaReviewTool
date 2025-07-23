import { ref, get } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { auth, db } from "./firebase.js";
import { tv } from "../TV Shows/tv.js";
import { music } from "../Music/music.js";
import { games } from "../Video Games/games.js";
import { books } from "../Books/books.js";


// Use Firestore from the default app
const db = getFirestore();

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
    profileTitle.textContent = `${user.displayName || user.email}'s Profile`;
    // We'll update the review/favorite counts after fetching them
    profileInfo.innerHTML = `<strong>Email:</strong> ${user.email}<br><span id="profileStats"></span>`;
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
    // Find all reviews in the Realtime Database for this user
    // Reviews are stored under reviews/<mediaKey>/{reviewId: {user, text, ...}}
    const reviewsRef = ref(db, 'reviews');
    const snapshot = await get(reviewsRef);
    userReviews.innerHTML = '';
    let reviewCount = 0;
    if (!snapshot.exists()) {
        userReviews.innerHTML = '<li>No reviews yet.</li>';
        updateProfileStats({ reviewCount: 0, favoriteCount: window._favoriteCount || 0 });
        return;
    }
    const reviewsData = snapshot.val();
    // Flatten all reviews and filter by user
    const userReviewList = [];
    Object.entries(reviewsData).forEach(([mediaKey, reviewObj]) => {
        Object.values(reviewObj).forEach(r => {
            if (r.user === user.email || r.user === user.uid) {
                userReviewList.push({ mediaKey, ...r });
            }
        });
    });
    if (userReviewList.length === 0) {
        userReviews.innerHTML = '<li>No reviews yet.</li>';
        updateProfileStats({ reviewCount: 0, favoriteCount: window._favoriteCount || 0 });
        return;
    }
    userReviewList.forEach(r => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${r.mediaKey}</strong>: ${r.text || r.review || ''}`;
        userReviews.appendChild(li);
        reviewCount++;
    });
    window._reviewCount = reviewCount;
    updateProfileStats({ reviewCount, favoriteCount: window._favoriteCount || 0 });
}

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

async function renderFavorites(user) {
    const container = document.getElementById('userFavorites');
    if (!container) return;
    container.innerHTML = '<div>Loading favorites...</div>';
    auth.onAuthStateChanged(async user => {
        if (!user) {
            container.innerHTML = '<div>Please log in to see your favorites.</div>';
            // Update stats with 0 favorites (reviews will be updated separately)
            window._favoriteCount = 0;
            updateProfileStats({ reviewCount: window._reviewCount || 0, favoriteCount: 0 });
            return;
        }
        const userId = user.uid;
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
    });
}

// On load, check auth and render profile
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = '../index.html';
        return;
    }
    renderProfile(user);
    await renderReviews(user);
    await renderFavorites(user);
});

import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { tv } from "../TV Shows/tv.js";
import { music } from "../Music/music.js";
import { games } from "../Video Games/games.js";
import { books } from "../Books/books.js";

const firebaseConfig = {
  apiKey: "AIzaSyAKGL7v8zhVHFsoV_AWwgAshiWmv8v84yA",
  authDomain: "mediareviews-3cf32.firebaseapp.com",
  // ...other config values from Firebase Console...
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const profileInfo = document.getElementById('profileInfo');
const userReviews = document.getElementById('userReviews');
const userFavorites = document.getElementById('userFavorites');
const profileTitle = document.getElementById('profileTitle');
const backHomeBtn = document.getElementById('backHomeBtn');

// Fix: Use window.location.replace for Home button to force navigation
if (backHomeBtn) {
    backHomeBtn.onclick = function(e) {
        e.preventDefault();
        window.location.replace('../index.html');
    };
}

function renderProfile(user) {
    profileTitle.textContent = `${user.displayName || user.email}'s Profile`;
    profileInfo.innerHTML = `<strong>Email:</strong> ${user.email}`;
}

function showLoading(target) {
    target.innerHTML = '<li>Loading...</li>';
}

async function renderReviews(user) {
    showLoading(userReviews);
    const q = query(collection(db, "reviews"), where("userId", "==", user.uid));
    const querySnapshot = await getDocs(q);
    userReviews.innerHTML = '';
    if (querySnapshot.size === 0) {
        userReviews.innerHTML = '<li>No reviews yet.</li>';
        return;
    }
    querySnapshot.forEach(doc => {
        const data = doc.data();
        const li = document.createElement('li');
        li.innerHTML = `<strong>${data.mediaId}</strong>: ${data.reviewText} <span style="color:#888">(Rating: ${data.rating})</span>`;
        userReviews.appendChild(li);
    });
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

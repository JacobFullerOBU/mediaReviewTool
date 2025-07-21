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

document.addEventListener('DOMContentLoaded', renderFavorites);

import { ref, push, get } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { auth, db } from "../scripts/firebase.js";

// Fetch movies from JSON file
async function fetchMovies() {
    const response = await fetch("movieList.json");
    return await response.json();
}

let allMovies = [];
let currentGenre = 'all';

// Populate genre tabs dynamically from movie genres
function getUniqueGenres(movies) {
    const genres = new Set();
    movies.forEach(movie => {
        if (movie.genre) {
            movie.genre.split(/,|\n/).forEach(g => {
                const trimmed = g.trim();
                if (trimmed) genres.add(trimmed);
            });
        }
    });
    return Array.from(genres).sort();
}

function createGenreTabs(genres) {
    const genreTabs = document.getElementById('genreTabs');
    if (!genreTabs) return;
    genreTabs.innerHTML = '<button class="tab-btn active" data-genre="all">All</button>' +
        genres.map(g => `<button class="tab-btn" data-genre="${g}">${g}</button>`).join('');
    // Add event listeners
    genreTabs.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            genreTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filterByGenre(this.dataset.genre);
        });
    });
}

function filterByGenre(genre) {
    currentGenre = genre;
    let filtered = allMovies;
    if (genre !== 'all') {
        filtered = allMovies.filter(m => m.genre && m.genre.toLowerCase().includes(genre.toLowerCase()));
    }
    renderMovieCards(filtered);
}

function createMovieCardHTML(movie) {
    return `
        <div class="media-card" data-id="${movie.id || ''}">
            <div class="card-image" style="background-image: url('${movie.poster || movie.image || ''}')">
                <div class="card-category">${movie.genre || ''}</div>
            </div>
            <div class="card-content">
                <h3 class="card-title">${movie.title || ''}</h3>
                <p class="card-description">${movie.description || ''}</p>
                <div class="card-meta">
                    <span class="card-year">${movie.year || ''}</span>
                    <span class="card-director">${movie.director ? 'Director: ' + movie.director : ''}</span>
                </div>
                <div class="card-actors">${movie.actors ? 'Cast: ' + movie.actors.replace(/\n/g, ', ') : ''}</div>
            </div>
        </div>
    `;
}

function renderMovieCards(movies) {
    const container = document.getElementById('movieCardsContainer');
    if (!container) return;
    if (movies.length === 0) {
        container.innerHTML = `<div class="empty-state"><h3>No movies found</h3><p>Try a different genre or search.</p></div>`;
        return;
    }
    container.innerHTML = movies.map(createMovieCardHTML).join('');
    // Add click listeners for modals if needed (reuse modal logic from main site if desired)
}

function searchMovies(query) {
    let filtered = allMovies;
    if (query) {
        filtered = allMovies.filter(movie =>
            movie.title.toLowerCase().includes(query) ||
            movie.description.toLowerCase().includes(query) ||
            (movie.director && movie.director.toLowerCase().includes(query)) ||
            (movie.actors && movie.actors.toLowerCase().includes(query))
        );
    }
    if (currentGenre !== 'all') {
        filtered = filtered.filter(m => m.genre && m.genre.toLowerCase().includes(currentGenre.toLowerCase()));
    }
    renderMovieCards(filtered);
}

// Init
window.addEventListener('DOMContentLoaded', async () => {
    allMovies = (await fetchMovies()).filter(m => m.title && m.title.trim());
    const genres = getUniqueGenres(allMovies);
    createGenreTabs(genres);
    renderMovieCards(allMovies);
    // Search
    const searchInput = document.getElementById('movieSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            searchMovies(this.value.trim().toLowerCase());
        });
    }
});

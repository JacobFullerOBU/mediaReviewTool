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
    container.innerHTML = movies.map((movie, idx) => createMovieCardHTML({ ...movie, _idx: idx })).join('');
    // Add click listeners for modals
    container.querySelectorAll('.media-card').forEach((card, idx) => {
        card.addEventListener('click', function(e) {
            e.stopPropagation();
            // Use index to get the correct movie
            const movie = movies[idx];
            if (movie) {
                showMovieModal(movie);
            }
        });
    });
}

function showMovieModal(movie) {
    // Remove any existing modal
    let modal = document.getElementById('movieDetailModal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'movieDetailModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:600px;">
            <span class="close" id="closeMovieModal">&times;</span>
            <div class="modal-header" style="margin-bottom:12px;">
                <h2 style="margin-bottom:0;">${movie.title || ''}</h2>
            </div>
            <div class="modal-body" style="display:flex; gap:18px;">
                <img src="${movie.poster || movie.image || ''}" alt="${movie.title}" style="max-width:180px; border-radius:8px; box-shadow:0 2px 8px #0002;">
                <div style="flex:1;">
                    <p><strong>Year:</strong> ${movie.year || ''}</p>
                    <p><strong>Genre:</strong> ${movie.genre || ''}</p>
                    <p><strong>Director:</strong> ${movie.director || ''}</p>
                    <p><strong>Cast:</strong> ${movie.actors || ''}</p>
                    <p><strong>Description:</strong> ${movie.description || ''}</p>
                </div>
            </div>
            <hr style="margin:18px 0;">
            <div id="reviewsSection" style="margin-top:12px;">
                <h3 style="margin-bottom:8px;">Reviews</h3>
                <div id="reviewsList" style="margin-bottom:12px;">Loading reviews...</div>
                <form id="reviewForm" style="margin-top:12px;">
                    <textarea id="reviewText" rows="3" style="width:100%;" placeholder="Write your review..."></textarea>
                    <button type="submit" class="btn btn-primary" style="margin-top:8px;">Submit Review</button>
                </form>
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
    // Load and handle reviews
    loadReviews(movie);
    document.getElementById('reviewForm').onsubmit = function(e) {
        e.preventDefault();
        const text = document.getElementById('reviewText').value.trim();
        if (text) {
            submitReview(movie, text);
        }
    };
}

async function loadReviews(movie) {
    const reviewsList = document.getElementById('reviewsList');
    reviewsList.textContent = 'Loading reviews...';
    try {
        // Use movie.id if available, else fallback to sanitized title
        const key = movie.id ? String(movie.id) : (movie.title ? movie.title.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() : '');
        const reviewsRef = ref(db, `reviews/${key}`);
        const snapshot = await get(reviewsRef);
        let reviews = snapshot.exists() ? Object.values(snapshot.val()) : [];
        // If no reviews found, try fallback to alternate key (for legacy data)
        if (reviews.length === 0 && movie.title) {
            const altKey = movie.title.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
            if (altKey !== key) {
                const altRef = ref(db, `reviews/${altKey}`);
                const altSnap = await get(altRef);
                reviews = altSnap.exists() ? Object.values(altSnap.val()) : [];
            }
        }
        if (reviews.length === 0) {
            reviewsList.innerHTML = '<p style="color:#888;">No reviews yet. Be the first to review!</p>';
        } else {
            reviewsList.innerHTML = reviews
                .filter(r => {
                    if (typeof r === 'string') return r.trim() !== '';
                    if (r && (r.text || r.review)) return (r.text || r.review).trim() !== '';
                    return false;
                })
                .map(r => {
                    let text = '';
                    if (typeof r === 'string') {
                        text = r;
                    } else if (r && (r.text || r.review)) {
                        text = r.text || r.review;
                    }
                    const user = r && r.user ? r.user : 'Anonymous';
                    return `<div class="review" style="background:#f7f7f7; color:#222; border-radius:6px; padding:8px 12px; margin-bottom:8px;"><strong>${user}:</strong> <span>${text}</span></div>`;
                }).join('');
            if (reviewsList.innerHTML.trim() === '') {
                reviewsList.innerHTML = '<p style="color:#888;">No reviews yet. Be the first to review!</p>';
            }
        }
    } catch (err) {
        reviewsList.innerHTML = '<p style="color:#c00;">Error loading reviews.</p>';
    }
}

async function submitReview(movie, text) {
    const user = auth.currentUser ? auth.currentUser.email : 'Anonymous';
    const key = movie.id ? String(movie.id) : (movie.title ? movie.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : '');
    const reviewsRef = ref(db, `reviews/${key}`);
    await push(reviewsRef, { user, text, timestamp: Date.now() });
    document.getElementById('reviewText').value = '';
    loadReviews(movie);
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
            const query = this.value.trim().toLowerCase();
            let filtered = allMovies.filter(movie =>
                (movie.title && movie.title.toLowerCase().includes(query)) ||
                (movie.description && movie.description.toLowerCase().includes(query)) ||
                (movie.director && movie.director.toLowerCase().includes(query)) ||
                (movie.actors && movie.actors.toLowerCase().includes(query))
            );
            if (currentGenre !== 'all') {
                filtered = filtered.filter(m => m.genre && m.genre.toLowerCase().includes(currentGenre.toLowerCase()));
            }
            renderMovieCards(filtered);
        });
    }
});

import { ref, push, get } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { auth, db } from "../scripts/firebase.js";

// Fetch movies from JSON file
async function fetchMovies() {
    const response = await fetch("movieList.json");
    return await response.json();
}

let allMovies = [];
let currentGenre = 'all';
let filteredMovies = [];
let currentPage = 0;
let isLoading = false;
let hasMore = true;

// Virtual scrolling constants
const ITEMS_PER_PAGE = 50;
const SCROLL_THRESHOLD = 200; // pixels from bottom to trigger load

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
    filteredMovies = allMovies;
    if (genre !== 'all') {
        filteredMovies = allMovies.filter(m => m.genre && m.genre.toLowerCase().includes(genre.toLowerCase()));
    }
    resetPagination();
    loadMoviesPage();
}

function resetPagination() {
    currentPage = 0;
    isLoading = false;
    hasMore = true;
    const container = document.getElementById('movieCardsContainer');
    if (container) {
        container.innerHTML = '';
    }
}

function loadMoviesPage() {
    if (isLoading || !hasMore) return;
    
    isLoading = true;
    showSkeletonCards();
    
    const startIdx = currentPage * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const pageMovies = filteredMovies.slice(startIdx, endIdx);
    
    if (pageMovies.length === 0) {
        hasMore = false;
        isLoading = false;
        hideSkeletonCards();
        return;
    }
    
    // Simulate slight delay to prevent overwhelming the browser
    setTimeout(() => {
        hideSkeletonCards();
        renderMovieCards(pageMovies, currentPage > 0);
        currentPage++;
        hasMore = endIdx < filteredMovies.length;
        isLoading = false;
        
        // Update loading indicator
        updateLoadingIndicator();
    }, currentPage === 0 ? 0 : 100); // No delay for first page
}

function showSkeletonCards() {
    if (currentPage > 0) return; // Only show skeleton for initial load
    
    const container = document.getElementById('movieCardsContainer');
    if (!container) return;
    
    const skeletonHTML = Array(8).fill().map(() => `
        <div class="skeleton-card">
            <div class="card-image skeleton"></div>
            <div class="card-content">
                <div class="skeleton-title skeleton"></div>
                <div class="skeleton-description skeleton"></div>
                <div class="skeleton-description skeleton"></div>
                <div class="skeleton-meta skeleton"></div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = skeletonHTML;
}

function hideSkeletonCards() {
    const container = document.getElementById('movieCardsContainer');
    if (!container) return;
    
    const skeletonCards = container.querySelectorAll('.skeleton-card');
    skeletonCards.forEach(card => card.remove());
}

function createMovieCardHTML(movie) {
    const movieId = generateMovieId(movie);
    const posterUrl = movie.poster || movie.image || '';
    return `
        <div class="media-card" data-id="${movieId}">
            <div class="card-image" data-bg="${posterUrl}" style="background-color: #f0f0f0;">
                <div class="card-category">${movie.genre || ''}</div>
            </div>
            <div class="card-content">
                <h3 class="card-title">${movie.title || ''}</h3>
                <p class="card-description">${(movie.description || '').length > 150 ? (movie.description || '').substring(0, 150) + '...' : (movie.description || '')}</p>
                <div class="card-meta">
                    <span class="card-year">${movie.year || ''}</span>
                    <span class="card-director">${movie.director ? 'Director: ' + movie.director : ''}</span>
                </div>
                <div class="card-actors">${movie.actors ? 'Cast: ' + movie.actors.replace(/\n/g, ', ').substring(0, 100) + (movie.actors.length > 100 ? '...' : '') : ''}</div>
            </div>
        </div>
    `;
}

function generateMovieId(movie) {
    return movie.id || (movie.title ? movie.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : Math.random().toString(36));
}

function renderMovieCards(movies, append = false) {
    const container = document.getElementById('movieCardsContainer');
    if (!container) return;
    
    if (movies.length === 0 && !append) {
        container.innerHTML = `<div class="empty-state"><h3>No movies found</h3><p>Try a different genre or search.</p></div>`;
        return;
    }
    
    const cardsHTML = movies.map((movie, idx) => createMovieCardHTML(movie)).join('');
    
    if (append) {
        container.insertAdjacentHTML('beforeend', cardsHTML);
    } else {
        container.innerHTML = cardsHTML;
    }
    
    // Add click listeners only to new cards
    const allCards = container.querySelectorAll('.media-card');
    const startIdx = append ? allCards.length - movies.length : 0;
    
    for (let i = startIdx; i < allCards.length; i++) {
        const card = allCards[i];
        const movieIndex = i;
        if (!card.hasAttribute('data-listener-added')) {
            card.addEventListener('click', function(e) {
                e.stopPropagation();
                const movie = getMovieByGlobalIndex(movieIndex);
                if (movie) {
                    showMovieModal(movie);
                }
            });
            card.setAttribute('data-listener-added', 'true');
        }
    }
    
    // Initialize lazy loading for images
    initializeLazyLoading();
}

function getMovieByGlobalIndex(index) {
    // Get movie from currently displayed filtered results
    const container = document.getElementById('movieCardsContainer');
    const cards = container.querySelectorAll('.media-card');
    if (index < cards.length) {
        const cardId = cards[index].getAttribute('data-id');
        return filteredMovies.find(movie => generateMovieId(movie) === cardId) || filteredMovies[index];
    }
    return null;
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
    document.getElementById('reviewForm').onsubmit = async function(e) {
        e.preventDefault();
        const text = document.getElementById('reviewText').value.trim();
        // For now, ask for rating as a prompt (can be improved with UI)
        let rating = 5;
        if (window.prompt) {
            const input = window.prompt('Enter your rating (1-10):', '5');
            const num = parseInt(input);
            if (!isNaN(num) && num >= 1 && num <= 10) {
                rating = num;
            }
        }
        if (text) {
            // Use Firestore-backed review upload
            try {
                // Dynamically import postReview from main.js
                const { postReview } = await import('../scripts/main.js');
                await postReview(movie.id || (movie.title ? movie.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : ''), text, rating);
                document.getElementById('reviewText').value = '';
                loadReviews(movie);
            } catch (err) {
                alert('Error posting review: ' + (err.message || err));
            }
        }
    };
}

async function loadReviews(movie) {
    const reviewsList = document.getElementById('reviewsList');
    if (!reviewsList) return;
    
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
            // Limit reviews display for performance (show max 20 reviews)
            const displayReviews = reviews.slice(0, 20);
            reviewsList.innerHTML = displayReviews
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
                    // Truncate very long reviews for performance
                    const truncatedText = text.length > 300 ? text.substring(0, 300) + '...' : text;
                    return `<div class="review" style="background:#f7f7f7; color:#222; border-radius:6px; padding:8px 12px; margin-bottom:8px;"><strong>${user}:</strong> <span>${truncatedText}</span></div>`;
                }).join('');
            
            if (reviewsList.innerHTML.trim() === '') {
                reviewsList.innerHTML = '<p style="color:#888;">No reviews yet. Be the first to review!</p>';
            } else if (reviews.length > 20) {
                reviewsList.innerHTML += `<p style="color:#666; font-style:italic; margin-top:10px;">Showing first 20 of ${reviews.length} reviews</p>`;
            }
        }
    } catch (err) {
        reviewsList.innerHTML = '<p style="color:#c00;">Error loading reviews.</p>';
    }
}

// Deprecated: Use Firestore-backed review upload from main.js
// async function submitReview(movie, text) {
//     const user = auth.currentUser ? auth.currentUser.email : 'Anonymous';
//     const key = movie.id ? String(movie.id) : (movie.title ? movie.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : '');
//     const reviewsRef = ref(db, `reviews/${key}`);
//     await push(reviewsRef, { user, text, timestamp: Date.now() });
//     document.getElementById('reviewText').value = '';
//     loadReviews(movie);
// }

// Init
window.addEventListener('DOMContentLoaded', async () => {
    allMovies = (await fetchMovies()).filter(m => m.title && m.title.trim());
    filteredMovies = allMovies;
    const genres = getUniqueGenres(allMovies);
    createGenreTabs(genres);
    loadMoviesPage();
    
    // Setup infinite scrolling
    setupInfiniteScrolling();
    
    // Setup debounced search
    const searchInput = document.getElementById('movieSearchInput');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            const query = this.value.trim().toLowerCase();
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                performSearch(query);
            }, 300); // 300ms debounce
        });
    }
});

function performSearch(query) {
    let filtered = allMovies.filter(movie =>
        (movie.title && movie.title.toLowerCase().includes(query)) ||
        (movie.description && movie.description.toLowerCase().includes(query)) ||
        (movie.director && movie.director.toLowerCase().includes(query)) ||
        (movie.actors && movie.actors.toLowerCase().includes(query))
    );
    
    if (currentGenre !== 'all') {
        filtered = filtered.filter(m => m.genre && m.genre.toLowerCase().includes(currentGenre.toLowerCase()));
    }
    
    filteredMovies = filtered;
    resetPagination();
    loadMoviesPage();
}

function setupInfiniteScrolling() {
    let scrollTimeout;
    const backToTopBtn = document.getElementById('backToTop');
    
    window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            if (shouldLoadMore()) {
                loadMoviesPage();
            }
            
            // Show/hide back to top button
            if (backToTopBtn) {
                if (window.scrollY > 500) {
                    backToTopBtn.style.display = 'flex';
                } else {
                    backToTopBtn.style.display = 'none';
                }
            }
        }, 100); // 100ms throttle
    });
    
    // Back to top button click handler
    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
}

function shouldLoadMore() {
    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    
    return (documentHeight - scrollY - windowHeight) < SCROLL_THRESHOLD;
}

function updateLoadingIndicator() {
    let indicator = document.getElementById('loadingIndicator');
    
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'loadingIndicator';
        indicator.style.cssText = `
            text-align: center;
            padding: 20px;
            color: #666;
            font-style: italic;
        `;
        const container = document.getElementById('movieCardsContainer');
        if (container && container.parentNode) {
            container.parentNode.insertBefore(indicator, container.nextSibling);
        }
    }
    
    if (isLoading) {
        indicator.textContent = 'Loading more movies...';
        indicator.style.display = 'block';
    } else if (!hasMore && filteredMovies.length > 0) {
        indicator.textContent = `Showing all ${filteredMovies.length} movies`;
        indicator.style.display = 'block';
    } else {
        indicator.style.display = 'none';
    }
}

// Lazy loading for images
function initializeLazyLoading() {
    const imageElements = document.querySelectorAll('.card-image[data-bg]:not([data-loaded])');
    
    if (!window.lazyImageObserver) {
        window.lazyImageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const imgElement = entry.target;
                    const bgUrl = imgElement.getAttribute('data-bg');
                    if (bgUrl) {
                        // Create a new image to preload
                        const img = new Image();
                        img.onload = () => {
                            imgElement.style.backgroundImage = `url('${bgUrl}')`;
                            imgElement.style.backgroundSize = 'cover';
                            imgElement.style.backgroundPosition = 'center';
                            imgElement.setAttribute('data-loaded', 'true');
                        };
                        img.onerror = () => {
                            imgElement.style.backgroundColor = '#e0e0e0';
                            imgElement.setAttribute('data-loaded', 'true');
                        };
                        img.src = bgUrl;
                    }
                    window.lazyImageObserver.unobserve(imgElement);
                }
            });
        }, {
            rootMargin: '50px' // Start loading 50px before image comes into view
        });
    }
    
    imageElements.forEach(img => {
        window.lazyImageObserver.observe(img);
    });
}

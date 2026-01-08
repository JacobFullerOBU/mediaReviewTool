import { ref, push, get } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { auth, db } from "../scripts/firebase.js";

// Rich Text Editor functionality
let quillEditor = null;

function loadQuillJS() {
    return new Promise((resolve, reject) => {
        if (window.Quill) {
            resolve();
            return;
        }
        
        // Load Quill CSS
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://cdn.quilljs.com/1.3.7/quill.snow.css';
        document.head.appendChild(css);
        
        // Load Quill JS
        const script = document.createElement('script');
        script.src = 'https://cdn.quilljs.com/1.3.7/quill.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

function sanitizeHTML(html) {
    const allowedTags = ['b', 'strong', 'i', 'em', 'u', 'p', 'br', 'ul', 'ol', 'li', 'a'];
    const allowedAttributes = {
        'a': ['href', 'target']
    };
    
    if (typeof html !== 'string') {
        return String(html);
    }
    
    // If it looks like plain text (no HTML tags), return as is but escape any HTML
    if (!html.includes('<')) {
        return html.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#x27;')
                  .replace(/\n/g, '<br>');
    }
    
    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    function sanitizeNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent;
        }
        
        if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();
            
            if (allowedTags.includes(tagName)) {
                let result = `<${tagName}`;
                
                // Add allowed attributes
                if (allowedAttributes[tagName]) {
                    for (const attr of allowedAttributes[tagName]) {
                        const value = node.getAttribute(attr);
                        if (value) {
                            // Sanitize URLs for links
                            if (attr === 'href' && !value.match(/^https?:\/\/|^mailto:|^\//)) {
                                continue; // Skip unsafe links
                            }
                            result += ` ${attr}="${value.replace(/"/g, '&quot;')}"`;
                        }
                    }
                }
                
                result += '>';
                
                // Process child nodes
                for (const child of node.childNodes) {
                    result += sanitizeNode(child);
                }
                
                result += `</${tagName}>`;
                return result;
            } else {
                // For disallowed tags, just return the text content
                let result = '';
                for (const child of node.childNodes) {
                    result += sanitizeNode(child);
                }
                return result;
            }
        }
        
        return '';
    }
    
    let result = '';
    for (const child of tempDiv.childNodes) {
        result += sanitizeNode(child);
    }
    
    return result || html.replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#x27;');
}

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
                console.log('Movie card clicked, index:', movieIndex);
                const movie = getMovieByGlobalIndex(movieIndex);
                console.log('Movie data:', movie);
                if (movie) {
                    showMovieModal(movie);
                } else {
                    console.error('No movie found for index:', movieIndex);
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

// Initialize rich text editor if not already loaded

function showMovieModal(movie) {
    console.log('showMovieModal called with movie:', movie);
    
    // Remove any existing modal
    let modal = document.getElementById('movieDetailModal');
    if (modal) {
        console.log('Removing existing modal');
        modal.remove();
    }
    
    modal = document.createElement('div');
    modal.id = 'movieDetailModal';
    modal.className = 'modal';
    modal.style.cssText = `
        display: block;
        position: fixed;
        z-index: 1000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0,0,0,0.5);
    `;
    
    modal.innerHTML = `
        <div class="modal-content" style="background: white; margin: 5% auto; padding: 20px; border-radius: 8px; max-width: 700px; max-height: 90vh; overflow-y: auto; position: relative;">
            <span class="close" id="closeMovieModal" style="color: #aaa; float: right; font-size: 28px; font-weight: bold; cursor: pointer; position: absolute; top: 10px; right: 15px;">&times;</span>
            <div class="modal-header" style="margin-bottom: 12px; padding-top: 30px;">
                <h2 style="margin-bottom: 0; color: #333;">${movie.title || 'Unknown Title'}</h2>
            </div>
            <div class="modal-body" style="display: flex; gap: 18px; margin-bottom: 20px;">
                <img src="${movie.poster || movie.image || ''}" alt="${movie.title}" style="max-width: 180px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" onerror="this.style.display='none'">
                <div style="flex: 1; color: #333;">
                    <p><strong>Year:</strong> ${movie.year || 'N/A'}</p>
                    <p><strong>Genre:</strong> ${movie.genre || 'N/A'}</p>
                    <p><strong>Director:</strong> ${movie.director || 'N/A'}</p>
                    <p><strong>Cast:</strong> ${movie.actors || 'N/A'}</p>
                    <p><strong>Description:</strong> ${movie.description || 'No description available'}</p>
                </div>
            </div>
            <hr style="margin: 18px 0; border: 0; border-top: 1px solid #eee;">
            <div id="reviewsSection" style="margin-top: 12px;">
                <h3 style="margin-bottom: 8px; color: #333;">Reviews</h3>
                <div id="reviewsList" style="margin-bottom: 12px;">Loading reviews...</div>
                <div id="reviewFormContainer" style="background: #f8f9fa; padding: 16px; border-radius: 8px; border: 1px solid #e9ecef; margin-top: 12px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;">Write your review:</label>
                    <div id="reviewEditor" style="height: 150px; background: white; border: 1px solid #ccc; border-radius: 4px;"></div>
                    <div style="display: flex; align-items: center; gap: 10px; margin-top: 12px;">
                        <label style="font-weight: bold; color: #333;">Rating:</label>
                        <select id="reviewRating" style="padding: 5px; border: 1px solid #ccc; border-radius: 4px; min-width: 120px;">
                            <option value="1">1 ⭐</option>
                            <option value="2">2 ⭐⭐</option>
                            <option value="3">3 ⭐⭐⭐</option>
                            <option value="4">4 ⭐⭐⭐⭐</option>
                            <option value="5" selected>5 ⭐⭐⭐⭐⭐</option>
                        </select>
                        <button id="submitReviewBtn" class="btn btn-primary" style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Submit Review</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    console.log('Modal added to DOM');
    
    document.getElementById('closeMovieModal').onclick = function() {
        console.log('Close button clicked');
        quillEditor = null;
        modal.remove();
    };
    
    modal.onclick = function(e) {
        if (e.target === modal) {
            console.log('Modal background clicked');
            quillEditor = null;
            modal.remove();
        }
    };
    
    // Initialize the rich text editor
    console.log('Initializing rich text editor...');
    initializeRichTextEditor();
    
    // Load and handle reviews
    loadReviews(movie);
    
    // Handle review submission
    document.getElementById('submitReviewBtn').onclick = async function(e) {
        e.preventDefault();
        console.log('Submit review button clicked');
        
        let htmlContent = '';
        let textContent = '';
        
        if (quillEditor) {
            console.log('Using Quill editor');
            htmlContent = quillEditor.root.innerHTML;
            textContent = quillEditor.getText().trim();
        } else {
            console.log('Using fallback textarea');
            // Fallback to textarea
            const fallbackElement = document.getElementById('reviewTextFallback');
            if (fallbackElement) {
                textContent = fallbackElement.value.trim();
                htmlContent = textContent.replace(/\n/g, '<br>');
            }
        }
        
        const rating = parseInt(document.getElementById('reviewRating').value);
        console.log('Review content:', textContent, 'Rating:', rating);
        
        if (textContent.length > 0) {
            try {
                // Dynamically import postReview from main.js
                const { postReview } = await import('../scripts/main.js');
                await postReview(movie.id || (movie.title ? movie.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : ''), htmlContent, rating);
                
                // Clear the editor
                if (quillEditor) {
                    quillEditor.setText('');
                } else {
                    const fallbackElement = document.getElementById('reviewTextFallback');
                    if (fallbackElement) {
                        fallbackElement.value = '';
                    }
                }
                loadReviews(movie);
                alert('Review submitted successfully!');
            } catch (err) {
                console.error('Error posting review:', err);
                alert('Error posting review: ' + (err.message || err));
            }
        } else {
            alert('Please write a review before submitting.');
        }
    };
}

async function initializeRichTextEditor() {
    console.log('Starting rich text editor initialization...');
    
    try {
        console.log('Loading Quill.js...');
        await loadQuillJS();
        console.log('Quill.js loaded successfully');
        
        const editorElement = document.getElementById('reviewEditor');
        if (!editorElement) {
            console.error('reviewEditor element not found');
            return;
        }
        
        const toolbarOptions = [
            ['bold', 'italic', 'underline'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['link'],
            ['clean'] // remove formatting button
        ];
        
        console.log('Initializing Quill editor...');
        quillEditor = new Quill('#reviewEditor', {
            theme: 'snow',
            placeholder: 'Write your review here... You can use formatting like bold, italics, lists, and links.',
            modules: {
                toolbar: toolbarOptions
            }
        });
        
        console.log('Quill editor initialized successfully');
        
        // Style the editor to match the theme
        setTimeout(() => {
            const editorContainer = document.querySelector('#reviewEditor .ql-container');
            const toolbar = document.querySelector('#reviewEditor .ql-toolbar');
            
            if (editorContainer) {
                editorContainer.style.borderColor = '#ccc';
                editorContainer.style.fontSize = '14px';
                editorContainer.style.borderRadius = '0 0 4px 4px';
                console.log('Styled editor container');
            }
            
            if (toolbar) {
                toolbar.style.borderColor = '#ccc';
                toolbar.style.borderRadius = '4px 4px 0 0';
                toolbar.style.backgroundColor = '#f8f9fa';
                console.log('Styled editor toolbar');
            }
        }, 100);
        
    } catch (error) {
        console.error('Failed to load rich text editor, falling back to textarea:', error);
        // Fallback to textarea if Quill fails to load
        const editorElement = document.getElementById('reviewEditor');
        if (editorElement) {
            editorElement.outerHTML = `
                <textarea id="reviewTextFallback" rows="4" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; resize:vertical; font-family: inherit;" placeholder="Write your review..."></textarea>
            `;
            console.log('Fallback textarea created');
        }
    }
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
                .map(review => {
                    let content = '';
                    let rating = null;
                    let user = 'Anonymous';
                    let timestamp = '';
                    
                    if (typeof review === 'string') {
                        content = review;
                    } else if (review && (review.text || review.review)) {
                        content = review.text || review.review;
                        rating = review.rating || null;
                        user = review.user || 'Anonymous';
                        if (review.timestamp) {
                            try {
                                timestamp = new Date(review.timestamp).toLocaleDateString();
                            } catch (e) {
                                timestamp = '';
                            }
                        }
                    }
                    
                    // Sanitize HTML content to prevent XSS while allowing basic formatting
                    const sanitizedContent = sanitizeHTML(content);
                    
                    // Create rating display
                    let ratingDisplay = '';
                    if (rating && rating >= 1 && rating <= 5) {
                        const stars = '⭐'.repeat(rating);
                        ratingDisplay = `<div style="margin-bottom:4px; font-size:14px;">${stars} (${rating}/5)</div>`;
                    }
                    
                    // Create timestamp display
                    const timeDisplay = timestamp ? `<span style="color:#999; font-size:12px;"> • ${timestamp}</span>` : '';
                    
                    return `
                        <div class="review" style="background:#f7f7f7; color:#222; border-radius:8px; padding:12px; margin-bottom:12px; border-left:3px solid #007bff;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                <strong style="color:#333;">${user}</strong>
                                ${timeDisplay}
                            </div>
                            ${ratingDisplay}
                            <div style="line-height:1.5;">${sanitizedContent}</div>
                        </div>
                    `;
                }).join('');
            
            if (reviewsList.innerHTML.trim() === '') {
                reviewsList.innerHTML = '<p style="color:#888;">No reviews yet. Be the first to review!</p>';
            } else if (reviews.length > 20) {
                reviewsList.innerHTML += `<p style="color:#666; font-style:italic; margin-top:10px;">Showing first 20 of ${reviews.length} reviews</p>`;
            }
        }
    } catch (err) {
        reviewsList.innerHTML = '<p style="color:#c00;">Error loading reviews.</p>';
        console.error('Error loading reviews:', err);
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

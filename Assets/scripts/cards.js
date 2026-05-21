import { fetchMovies, fetchTV, fetchBooks } from './main.js';

const TMDB_KEY = 'f50a7cd62fa00a24f29a0e3ebb12c130';

// Maps TMDB provider IDs to a function that builds a platform search URL
const STREAMING_URLS = {
    8:   t => `https://www.netflix.com/search?q=${encodeURIComponent(t)}`,
    9:   t => `https://www.amazon.com/gp/video/search?phrase=${encodeURIComponent(t)}&tag=${AMAZON_TAG}`,
    15:  t => `https://www.hulu.com/search?q=${encodeURIComponent(t)}`,
    337: t => `https://www.disneyplus.com/search/${encodeURIComponent(t)}`,
    384: t => `https://www.max.com/search?q=${encodeURIComponent(t)}`,
    386: t => `https://tv.apple.com/search?term=${encodeURIComponent(t)}`,
    531: t => `https://www.paramountplus.com/search/?query=${encodeURIComponent(t)}`,
    387: t => `https://www.peacocktv.com/search?q=${encodeURIComponent(t)}`,
    283: t => `https://www.crunchyroll.com/search?q=${encodeURIComponent(t)}`,
    192: t => `https://www.youtube.com/results?search_query=${encodeURIComponent(t)}`,
};

async function fetchStreamingProviders(item) {
    const cat = (item.category || '').toLowerCase();
    const mediaType = cat === 'movies' ? 'movie' : cat === 'tv' ? 'tv' : null;
    if (!mediaType) return null;
    try {
        const searchResp = await fetch(
            `https://api.themoviedb.org/3/search/${mediaType}?api_key=${TMDB_KEY}&query=${encodeURIComponent(item.title)}&language=en-US`
        );
        const tmdbId = (await searchResp.json()).results?.[0]?.id;
        if (!tmdbId) return null;
        const provResp = await fetch(
            `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/watch/providers?api_key=${TMDB_KEY}`
        );
        const usData = (await provResp.json()).results?.US;
        return {
            providers: usData?.flatrate || null,
            justWatchLink: usData?.link || null,
        };
    } catch (e) {
        console.error('Streaming lookup failed:', e);
        return null;
    }
}

const AMAZON_TAG = 'mediareviews6-20';
function buildAmazonUrl(item) {
    let terms = item.title || '';
    const cat = (item.category || '').toLowerCase();
    if (cat === 'books')  { if (item.author) terms += ' ' + item.author; terms += ' book'; }
    else if (cat === 'movies') terms += ' blu-ray dvd';
    else if (cat === 'tv')     terms += ' complete series dvd';
    else if (cat === 'music')  terms += ' cd vinyl album';
    else if (cat === 'games')  terms += ' video game';
    return `https://www.amazon.com/s?k=${encodeURIComponent(terms)}&tag=${AMAZON_TAG}`;
}

let allItems = [];
let currentFilter = 'all';
let currentGenreFilter = 'all';
let quillEditor = null;

// Function to check if user has unsaved review content
function checkUnsavedReviewContent() {
    // Check if review form is open
    const reviewForm = document.querySelector('#reviewFormContainer');
    if (!reviewForm || reviewForm.classList.contains('hidden')) {
        return false;
    }
    
    // Check if Quill editor has content
    if (quillEditor && quillEditor.getText().trim().length > 0) {
        return true;
    }
    
    // Check if fallback textarea has content
    const fallbackTextarea = document.querySelector('#reviewTextEditorFallback');
    if (fallbackTextarea && fallbackTextarea.value.trim().length > 0) {
        return true;
    }
    
    // Check if rating is selected
    const ratingInput = document.querySelector('#reviewRating');
    if (ratingInput && ratingInput.value && ratingInput.value !== '') {
        return true;
    }
    
    return false;
}

// Rich Text Editor functionality
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

async function initializeRichTextEditor(containerId) {
    console.log('Initializing rich text editor for:', containerId);
    
    try {
        await loadQuillJS();
        
        const editorElement = document.getElementById(containerId);
        if (!editorElement) {
            console.error('Editor container not found:', containerId);
            return null;
        }
        
        const toolbarOptions = [
            ['bold', 'italic', 'underline'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['link'],
            ['clean'] // remove formatting button
        ];
        
        quillEditor = new Quill(`#${containerId}`, {
            theme: 'snow',
            placeholder: 'Write your review here... You can use formatting like bold, italics, lists, and links.',
            modules: {
                toolbar: toolbarOptions
            }
        });
        
        // Style the editor to match the theme
        setTimeout(() => {
            const editorContainer = document.querySelector(`#${containerId} .ql-container`);
            const toolbar = document.querySelector(`#${containerId} .ql-toolbar`);
            
            if (editorContainer) {
                editorContainer.style.borderColor = '#374151';
                editorContainer.style.fontSize = '14px';
                editorContainer.style.borderRadius = '0 0 8px 8px';
                editorContainer.style.backgroundColor = '#1f2937';
                editorContainer.style.color = '#f8fafc';
            }
            
            if (toolbar) {
                toolbar.style.borderColor = '#374151';
                toolbar.style.borderRadius = '8px 8px 0 0';
                toolbar.style.backgroundColor = '#374151';
                toolbar.style.color = '#f8fafc';
            }
            
            // Style toolbar buttons
            const toolbarButtons = toolbar.querySelectorAll('.ql-formats button, .ql-formats .ql-picker');
            toolbarButtons.forEach(btn => {
                btn.style.color = '#f8fafc';
            });
        }, 100);
        
        console.log('Rich text editor initialized successfully');
        return quillEditor;
        
    } catch (error) {
        console.error('Failed to load rich text editor, falling back to textarea:', error);
        // Fallback to textarea if Quill fails to load
        const editorElement = document.getElementById(containerId);
        if (editorElement) {
            editorElement.outerHTML = `
                <textarea id="${containerId}Fallback" rows="4" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-vertical" placeholder="Write your review..."></textarea>
            `;
        }
        return null;
    }
}

function getEditorContent() {
    if (quillEditor) {
        return {
            html: quillEditor.root.innerHTML,
            text: quillEditor.getText().trim()
        };
    } else {
        const fallbackElement = document.querySelector('[id$="Fallback"]');
        if (fallbackElement) {
            const text = fallbackElement.value.trim();
            return {
                html: text.replace(/\n/g, '<br>'),
                text: text
            };
        }
    }
    return { html: '', text: '' };
}

function clearEditor() {
    if (quillEditor) {
        quillEditor.setText('');
    } else {
        const fallbackElement = document.querySelector('[id$="Fallback"]');
        if (fallbackElement) {
            fallbackElement.value = '';
        }
    }
}

function sanitizeHTML(html) {
    const allowedTags = ['b', 'strong', 'i', 'em', 'u', 'p', 'br', 'ul', 'ol', 'li', 'a'];
    const allowedAttributes = {
        'a': ['href', 'target']
    };
    
    if (typeof html !== 'string') {
        return String(html);
    }
    if (!html.includes('<')) {
        return html.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#x27;')
                  .replace(/\n/g, '<br>');
    }
    
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
                for (const child of node.childNodes) {
                    result += sanitizeNode(child);
                }
                result += `</${tagName}>`;
                return result;
            } else {
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
import {
    ref,
    push,
    get,
    child,
    onValue
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import {
    auth,
    db
} from "./firebase.js";
// Import media arrays from separate files
import { music } from "./music.js";
import { games } from "./games.js";
import { adminState, deleteReview, editReview } from "./admin.js";

function getMediaId(item) {
    if (item.id) return item.id;
    const titleSlug = item.title ? item.title.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : '';
    const cat = Array.isArray(item.category) ? item.category[0] : (item.category || '');
    const catSlug = cat.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    return catSlug ? `${catSlug}_${titleSlug}` : titleSlug;
}

// Get number of reviews for a media item (Realtime Database)
async function getReviewCount(mediaId) {
    const reviewsRef = ref(db, `reviews/${mediaId}`);
    const snapshot = await get(reviewsRef);
    if (snapshot.exists()) {
        return Object.keys(snapshot.val()).length;
    }
    return 0;
}
// Get average rating for a media item (Realtime Database)
async function getAverageRating(mediaId) {
    const reviewsRef = ref(db, `reviews/${mediaId}`);
    const snapshot = await get(reviewsRef);
    let total = 0;
    let count = 0;
    if (snapshot.exists()) {
        const reviews = snapshot.val();
        Object.values(reviews).forEach(data => {
            if (typeof data.rating === "number") {
                total += data.rating;
                count++;
            }
        });
    }
    return count > 0 ? (total / count).toFixed(1) : "N/A";
}
// Cards functionality for displaying popular content
document.addEventListener('DOMContentLoaded', async function () {
    await initCards();
});
async function initCards() {
    const container = document.getElementById('cardsContainer');
    if (!container) return;

    let movies = [], validTV = [], validMusic = [], validGames = [], validBooks = [];

    try {
        movies = (await fetchMovies()).filter(m => typeof m.title === 'string' && m.title);
    } catch (e) {
        console.error("Failed to load movies:", e);
    }

    try {
        const tvData = await fetchTV();
        validTV = tvData.filter(item => typeof item.title === 'string' && item.title);
    } catch (e) {
        console.error("Failed to load TV shows:", e);
    }

    try {
        validMusic = Array.isArray(music) ? music.filter(item => typeof item.title === 'string' && item.title) : [];
    } catch (e) {
        console.error("Failed to load music:", e);
    }

    try {
        validGames = Array.isArray(games) ? games.filter(item => typeof item.title === 'string' && item.title) : [];
    } catch (e) {
        console.error("Failed to load games:", e);
    }

    try {
        const booksData = await fetchBooks();
        validBooks = booksData.filter(item => typeof item.title === 'string' && item.title);
    } catch (e) {
        console.error("Failed to load books:", e);
    }

    allItems = [...movies, ...validTV, ...validMusic, ...validGames, ...validBooks];
    window.allItems = allItems;
    
    // Initialize tab functionality
    initTabFunctionality();

    // Set default sort to 'rating-desc'
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.value = 'rating-desc';
    }

    // Check if any items were loaded and render them with default sort.
    if (allItems.length > 0) {
        await filterCards('all');
    } else {
        container.innerHTML = '<div style="padding:32px;text-align:center;color:#888;">Could not load any media. Please check data sources and browser console for errors.</div>';
    }
}

function renderGenreFilters(category) {
    const container = document.getElementById('genreFilterContainer');
    if (!container) return;

    if (!category || category === 'all') {
        container.innerHTML = '';
        container.classList.add('hidden');
        container.classList.remove('flex');
        currentGenreFilter = 'all';
        return;
    }

    const categoryItems = allItems.filter(item => {
        if (typeof item.category === 'string') return item.category.toLowerCase() === category.toLowerCase();
        if (Array.isArray(item.category)) return item.category.map(c => c.toLowerCase()).includes(category.toLowerCase());
        return category === 'movies' && !item.category;
    });

    const genreSet = new Set();
    categoryItems.forEach(item => {
        if (item.genre) {
            item.genre.split(',').forEach(g => { const t = g.trim(); if (t) genreSet.add(t); });
        }
    });

    const genres = Array.from(genreSet).sort();
    if (genres.length === 0) {
        container.innerHTML = '';
        container.classList.add('hidden');
        container.classList.remove('flex');
        return;
    }

    currentGenreFilter = 'all';

    const base = 'genre-btn px-3 py-1 rounded-full text-xs whitespace-nowrap transition-all cursor-pointer border';
    const inactive = 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700';
    const active = 'bg-indigo-600 text-white border-indigo-600 shadow-sm';

    container.innerHTML = [
        `<button class="${base} ${active}" data-genre="all">All</button>`,
        ...genres.map(g => `<button class="${base} ${inactive}" data-genre="${escapeHtml(g)}">${escapeHtml(g)}</button>`)
    ].join('');

    container.classList.remove('hidden');
    container.classList.add('flex');

    container.querySelectorAll('.genre-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            container.querySelectorAll('.genre-btn').forEach(b => {
                b.className = `${base} ${inactive}`;
            });
            this.className = `${base} ${active}`;
            currentGenreFilter = this.dataset.genre;
            filterCards(category);
        });
    });
}

function escapeHtml(str) {
    return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function initTabFunctionality() {
        // Scroll search bar to top of viewport when sort changes
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                // Scroll search bar to top of viewport
                const searchContainer = document.querySelector('.search-and-sort-container');
                if (searchContainer) {
                    const rect = searchContainer.getBoundingClientRect();
                    window.scrollBy({
                        top: rect.top - 64,
                        left: 0,
                        behavior: 'smooth'
                    });
                }
            });
        }
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            const category = this.dataset.category;
            // Update active tab styling
            tabBtns.forEach(tab => {
                tab.classList.remove('active', 'bg-indigo-600', 'text-white', 'shadow-md');
                tab.classList.add('bg-slate-800', 'text-slate-400');
            });
            this.classList.add('active', 'bg-indigo-600', 'text-white', 'shadow-md');
            this.classList.remove('bg-slate-800', 'text-slate-400');
            // Render genre sub-filters then filter cards
            renderGenreFilters(category);
            filterCards(category);
            // Scroll search bar to top of viewport
            const searchContainer = document.querySelector('.search-and-sort-container');
            if (searchContainer) {
                const rect = searchContainer.getBoundingClientRect();
                window.scrollBy({
                    top: rect.top - 64,
                    left: 0,
                    behavior: 'smooth'
                });
            }
        });
    });
    const searchInput = document.getElementById('mediaSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const activeTab = document.querySelector('.tab-btn.active');
            const category = activeTab ? activeTab.dataset.category : 'all';
            filterCards(category);
            // Scroll search bar to top of viewport
            const searchContainer = document.querySelector('.search-and-sort-container');
            if (searchContainer) {
                const rect = searchContainer.getBoundingClientRect();
                window.scrollBy({
                    top: rect.top - 64,
                    left: 0,
                    behavior: 'smooth'
                });
            }
        });
    }

    const surpriseBtn = document.getElementById('surprise-button');
    if (surpriseBtn) {
        surpriseBtn.addEventListener('click', function () {
            const activeBtn = document.querySelector('.tab-btn.active');
            const currentCategory = activeBtn ? activeBtn.getAttribute('data-category') : 'all';
            let poolOfItems = allItems;
            if (currentCategory !== 'all') {
                poolOfItems = allItems.filter(item => 
                    (item.category && item.category.toLowerCase() === currentCategory.toLowerCase())
                );
            }
            if (poolOfItems.length === 0) {
                poolOfItems = allItems;
            }
            
            if (poolOfItems.length === 0) {
                alert(`No media items have been loaded yet!`);
                return;
            }
            const randomItem = poolOfItems[Math.floor(Math.random() * poolOfItems.length)];
            if (randomItem) {
                showItemDetails(randomItem);
            } else {
                alert("Could not find an item to show.");
            }
        });
    }
}

async function fetchRatingsForItems(items) {
    const itemsNeedingRating = items.filter(i => i.liveAvgRating === undefined);
    if (itemsNeedingRating.length > 0) {
        const ratingPromises = itemsNeedingRating.map(item => {
            const mediaId = getMediaId(item);
            return getAverageRating(mediaId).then(rating => {
                item.liveAvgRating = (rating === "N/A") ? -1 : parseFloat(rating);
            });
        });
        await Promise.all(ratingPromises);
    }
}

async function filterCards(category) {
    currentFilter = category;
    let items = allItems;
    const searchTerm = document.getElementById('mediaSearchInput')?.value.toLowerCase() || '';
    // Filter by category
    if (category && category !== 'all') {
        items = allItems.filter(item => {
            // Accept both string and array category
            if (typeof item.category === 'string') {
                return item.category.toLowerCase() === category.toLowerCase();
            } else if (Array.isArray(item.category)) {
                return item.category.map(c => c.toLowerCase()).includes(category.toLowerCase());
            }
            // Fallback: Movies if no category
            return category === 'movies' && !item.category;
        });
    }
    // Filter by genre
    if (currentGenreFilter && currentGenreFilter !== 'all') {
        items = items.filter(item => {
            if (!item.genre) return false;
            return item.genre.split(',').map(g => g.trim()).includes(currentGenreFilter);
        });
    }
    // Filter by search term (title, director, actors, description, etc.)
    if (searchTerm) {
        items = items.filter(item => {
            let match = item.title && item.title.toLowerCase().includes(searchTerm);
            // Movies: director, actors, description
            if (!match && item.director) {
                match = item.director.toLowerCase().includes(searchTerm);
            }
            if (!match && item.actors) {
                match = item.actors.toLowerCase().includes(searchTerm);
            }
            if (!match && item.description) {
                match = item.description.toLowerCase().includes(searchTerm);
            }
            // For TV: creator(s), cast
            if (!match && item.creator) {
                match = item.creator.toLowerCase().includes(searchTerm);
            }
            if (!match && item.creators) {
                match = item.creators.toLowerCase().includes(searchTerm);
            }
            if (!match && item.cast) {
                match = item.cast.toLowerCase().includes(searchTerm);
            }
            // Music: artist
            if (!match && item.artist) {
                match = item.artist.toLowerCase().includes(searchTerm);
            }
            // Games: developer
            if (!match && item.developer) {
                match = item.developer.toLowerCase().includes(searchTerm);
            }
            // Books: author
            if (!match && item.author) {
                match = item.author.toLowerCase().includes(searchTerm);
            }
            return match;
        });
    }
    const sortOption = document.getElementById('sortSelect')?.value || 'year-desc';
    if (sortOption.startsWith('rating-')) {
        await fetchRatingsForItems(items);
    }
    items = sortItems(items, sortOption);
    loadCardsWithItems(items);
}

async function loadCardsWithItems(items) {
    const container = document.getElementById('cardsContainer');
    if (!container) {
        console.error('[cards.js] cardsContainer not found');
        return;
    }
    showLoadingState(container);
    // No artificial delay; render immediately
    await renderCards(container, items);
    addCardListeners();
}
window.filterCards = filterCards;

function buildReviewsHtml(reviewsData, mediaId) {
    const entries = Object.entries(reviewsData).sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp));
    if (!entries.length) return '<div class="mt-8 text-slate-500">No reviews yet.</div>';

    let html = `<h3 class="text-xl font-bold text-white mt-8 mb-4">All Reviews</h3><div class="space-y-4">`;
    html += entries.map(([reviewId, r]) => {
        const sanitizedContent = sanitizeHTML(r.reviewText || r.text || '');
        let formattedDate = '';
        if (r.timestamp) {
            formattedDate = new Date(r.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        }
        const adminControls = adminState.isAdmin ? `
            <div class="admin-controls flex gap-2 mt-3 pt-2 border-t border-slate-700/50">
                <button class="admin-edit-review flex items-center gap-1 text-xs bg-blue-900/50 hover:bg-blue-800 text-blue-300 px-2 py-1 rounded transition-colors" data-review-id="${reviewId}" data-media-id="${mediaId}">
                    <i data-lucide="edit-2" class="w-3 h-3"></i> Edit
                </button>
                <button class="admin-delete-review flex items-center gap-1 text-xs bg-red-900/50 hover:bg-red-800 text-red-300 px-2 py-1 rounded transition-colors" data-review-id="${reviewId}" data-media-id="${mediaId}">
                    <i data-lucide="trash-2" class="w-3 h-3"></i> Delete
                </button>
            </div>` : '';
        return `
            <div class="review-block bg-slate-900/50 p-4 rounded-lg border border-slate-700"
                 data-review-id="${reviewId}" data-media-id="${mediaId}"
                 data-rating="${r.rating}" data-plain-text="${encodeURIComponent(r.text || '')}">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2 text-yellow-400 font-bold">
                        <i data-lucide="star" class="w-4 h-4 fill-current"></i> ${r.rating}
                    </div>
                    <div class="text-right">
                        <div class="text-slate-400 text-sm">${r.user || 'Anonymous'}</div>
                        <span class="text-slate-500 text-xs">${formattedDate}</span>
                    </div>
                </div>
                <div class="review-content text-slate-300" style="line-height: 1.6;">${sanitizedContent}</div>
                ${adminControls}
            </div>
        `;
    }).join('');
    html += `</div>`;
    return html;
}

// Modal logic moved to a dedicated async function
async function showItemDetails(item) {
    let mediaId = getMediaId(item);
    const legacyId = item.title ? item.title.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : '';
    let reviewsHtml = '';

    try {
        let snapshot = await get(ref(db, `reviews/${mediaId}`));
        // Fall back to legacy title-only ID so existing reviews are still visible
        if (!snapshot.exists() && legacyId !== mediaId) {
            const legacySnapshot = await get(ref(db, `reviews/${legacyId}`));
            if (legacySnapshot.exists()) {
                snapshot = legacySnapshot;
                mediaId = legacyId;
            }
        }
        reviewsHtml = snapshot.exists()
            ? buildReviewsHtml(snapshot.val(), mediaId)
            : `<div class="mt-8 text-slate-500">No reviews yet.</div>`;
    } catch (err) {
        reviewsHtml = `<div class="mt-8 text-red-500">Error loading reviews.</div>`;
    }

    let avgRating = await getAverageRating(mediaId);
    let reviewCount = await getReviewCount(mediaId);

    let modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm';
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            // Check if user has unsaved review content
            const hasUnsavedContent = checkUnsavedReviewContent();
            if (hasUnsavedContent) {
                // Show warning and prevent closure
                if (!confirm('You have unsaved review content. Are you sure you want to close without saving?')) {
                    return;
                }
            }
            modal.remove();
            document.body.style.overflow = 'auto';
        }
    });
    modal.innerHTML = `
        <div class="bg-slate-800 rounded-2xl p-8 w-full max-w-2xl border border-slate-700 shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar">
            <button class="close-btn absolute top-4 right-4 text-slate-400 hover:text-white">
                <i data-lucide="x" class="w-6 h-6"></i>
            </button>
            <div class="flex flex-col md:flex-row gap-8 items-start">
                <img src="${item.poster || item.image || ''}" alt="${item.title}" class="w-48 h-auto rounded-lg shadow-lg object-cover flex-shrink-0 mx-auto md:mx-0">
                <div class="flex-1 text-slate-300">
                    <h2 class="text-3xl font-bold text-white mb-2">${item.title || ''}</h2>
                    <div class="flex items-center gap-4 text-sm text-slate-400 mb-4">
                        <span>${item.year ? `<strong>Year:</strong> ${item.year}` : ''}</span>
                        ${item.genre ? `<span><strong>Genre:</strong> ${item.genre}</span>` : ''}
                    </div>
                    <div class="text-sm text-slate-400 mb-4">
                        ${item.director ? `<strong>Director:</strong> ${item.director}` : item.creator ? `<strong>Creator:</strong> ${item.creator}` : item.author ? `<strong>Author:</strong> ${item.author}` : ''}
                    </div>
                    <div class="text-sm text-slate-400 mb-4">
                        ${item.actors ? `<strong>Cast:</strong> ${item.actors}` : ''}
                    </div>
                    <p class="text-slate-400 mb-4">${item.description || ''}</p>
                    <div id="streamingSection" class="mb-4">
                        ${['movies', 'tv'].includes((item.category || '').toLowerCase())
                            ? '<p class="text-xs text-slate-500 italic">Checking streaming availability...</p>'
                            : ''}
                    </div>
                    <div class="flex items-center gap-6 bg-slate-900/50 p-3 rounded-lg mb-6">
                        <div>
                            <strong>Avg. Rating:</strong> 
                            <span id="modalRating" class="font-bold text-yellow-400 ml-1">★ ${avgRating}</span>
                        </div>
                        <div>
                            <strong>Reviews:</strong> 
                            <span id="modalReviewCount" class="font-bold text-white ml-1">${reviewCount}</span>
                        </div>
                    </div>
                    <div class="flex flex-wrap items-center gap-3">
                        <button class="btn-primary bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors" id="writeReviewBtn">Write a Review</button>
                        <button class="btn-secondary border border-slate-600 hover:bg-slate-700 text-slate-300 font-bold py-2 px-4 rounded-lg transition-colors" id="addToFavoritesBtn">Add to Favorites</button>
                        <button class="btn-secondary border border-amber-600 hover:bg-amber-700 text-amber-300 font-bold py-2 px-4 rounded-lg transition-colors" id="addToWatchlistBtn">Add to Watchlist</button>
                        <a href="${buildAmazonUrl(item)}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold py-2 px-4 rounded-lg transition-colors text-sm">
                            <i data-lucide="shopping-cart" class="w-4 h-4"></i> Buy on Amazon
                        </a>
                    </div>
                    <p class="text-xs text-slate-500 mt-2">As an Amazon Associate I earn from qualifying purchases.</p>
                </div>
            </div>
            <div id="reviewFormContainer" class="hidden mt-6 pt-6 border-t border-slate-700">
                <h4 class="text-lg font-bold text-white mb-4">Write Your Review</h4>
                <form id="reviewForm" class="space-y-4">
                    <div>
                        <label for="reviewRating" class="block text-sm font-medium text-slate-300 mb-2">Rating (1-10, half-points allowed):</label>
                        <input type="number" id="reviewRating" min="1" max="10" step="0.5" required class="w-24 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none">
                    </div>
                    <div>
                        <label for="reviewTextEditor" class="block text-sm font-medium text-slate-300 mb-2">Your Review:</label>
                        <div id="reviewTextEditor" style="height: 150px; background: #1f2937; border: 1px solid #374151; border-radius: 8px;"></div>
                    </div>
                    <button type="submit" class="btn-primary bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">Submit Review</button>
                </form>
                <div id="reviewError" class="text-red-500 mt-4"></div>
            </div>
            <div id="reviewsSection">${reviewsHtml}</div>
        </div>
    `;
        // Watchlist functionality
        const addToWatchlistBtn = modal.querySelector('#addToWatchlistBtn');
        const mediaKey = getMediaId(item);
        let isWatchlisted = false;
        if (auth.currentUser) {
            const userId = auth.currentUser.uid || auth.currentUser.email || auth.currentUser.displayName;
            const watchRef = ref(db, `watchlist/${userId}/${mediaKey}`);
            get(watchRef).then(snapshot => {
                if (snapshot.exists()) {
                    isWatchlisted = true;
                    addToWatchlistBtn.textContent = 'Remove from Watchlist';
                    addToWatchlistBtn.classList.add('bg-amber-900', 'border-amber-600');
                    addToWatchlistBtn.classList.remove('bg-amber-600');
                }
            });
        }
        //Add to watchlist
        addToWatchlistBtn.addEventListener('click', async () => {
            if (!auth.currentUser) {
                alert('You must be logged in to use the watchlist.');
                return;
            }
            const userId = auth.currentUser.uid || auth.currentUser.email || auth.currentUser.displayName;
            const watchRef = ref(db, `watchlist/${userId}/${mediaKey}`);
            if (!isWatchlisted) {
                await import('https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js').then(({ set }) => set(watchRef, true));
                addToWatchlistBtn.textContent = 'Remove from Watchlist';
                isWatchlisted = true;
                addToWatchlistBtn.classList.add('bg-amber-900', 'border-amber-600');
                addToWatchlistBtn.classList.remove('bg-amber-600');
            } else {
                await import('https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js').then(({ remove }) => remove(watchRef));
                addToWatchlistBtn.textContent = 'Add to Watchlist';
                isWatchlisted = false;
                addToWatchlistBtn.classList.remove('bg-amber-900', 'border-amber-600');
                addToWatchlistBtn.classList.add('bg-amber-600');
            }
        });
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    lucide.createIcons();

    // Admin controls: delete and inline-edit any review
    if (adminState.isAdmin) {
        const reviewsSection = modal.querySelector('#reviewsSection');
        reviewsSection.addEventListener('click', async (e) => {
            const deleteBtn = e.target.closest('.admin-delete-review');
            const editBtn   = e.target.closest('.admin-edit-review');
            const saveBtn   = e.target.closest('.admin-save-edit');
            const cancelBtn = e.target.closest('.admin-cancel-edit');

            async function refreshReviews() {
                const snap = await get(ref(db, `reviews/${mediaId}`));
                reviewsSection.innerHTML = snap.exists()
                    ? buildReviewsHtml(snap.val(), mediaId)
                    : '<div class="mt-8 text-slate-500">No reviews yet.</div>';
                const count  = snap.exists() ? Object.keys(snap.val()).length : 0;
                const newAvg = snap.exists()
                    ? (Object.values(snap.val()).reduce((s, r) => s + (r.rating || 0), 0) / count).toFixed(1)
                    : 'N/A';
                modal.querySelector('#modalReviewCount').textContent = count;
                modal.querySelector('#modalRating').textContent = `★ ${newAvg}`;
                lucide.createIcons();
            }

            if (deleteBtn) {
                if (!confirm('Delete this review? This cannot be undone.')) return;
                const reviewId = deleteBtn.dataset.reviewId;
                await deleteReview(mediaId, reviewId);
                await refreshReviews();
            }

            if (editBtn) {
                const reviewBlock = editBtn.closest('.review-block');
                if (reviewBlock.querySelector('.admin-edit-form')) return;
                const reviewId   = reviewBlock.dataset.reviewId;
                const currRating = reviewBlock.dataset.rating;
                const currText   = decodeURIComponent(reviewBlock.dataset.plainText || '');

                reviewBlock.innerHTML = `
                    <div class="admin-edit-form space-y-3">
                        <p class="text-xs text-slate-400 uppercase tracking-wide font-medium">Editing Review</p>
                        <div class="flex items-center gap-2">
                            <label class="text-xs text-slate-400">Rating:</label>
                            <input type="number" class="edit-rating w-24 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm" min="1" max="10" step="0.5">
                        </div>
                        <textarea class="edit-text w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm resize-vertical" rows="5"></textarea>
                        <div class="flex gap-2">
                            <button class="admin-save-edit text-xs bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded transition-colors" data-review-id="${reviewId}">Save Changes</button>
                            <button class="admin-cancel-edit text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded transition-colors">Cancel</button>
                        </div>
                    </div>
                `;
                reviewBlock.dataset.reviewId = reviewId;
                reviewBlock.querySelector('.edit-rating').value = currRating;
                reviewBlock.querySelector('.edit-text').value   = currText;
            }

            if (saveBtn) {
                const reviewId  = saveBtn.dataset.reviewId;
                const form      = saveBtn.closest('.admin-edit-form');
                const newText   = form.querySelector('.edit-text').value.trim();
                const newRating = parseFloat(form.querySelector('.edit-rating').value);
                if (!newText || isNaN(newRating) || newRating < 1 || newRating > 10) {
                    alert('Valid review text and rating (1–10) required.');
                    return;
                }
                saveBtn.textContent = 'Saving…';
                saveBtn.disabled = true;
                await editReview(mediaId, reviewId, newText, newRating);
                await refreshReviews();
            }

            if (cancelBtn) {
                await refreshReviews();
            }
        });
    }

    // Streaming availability (movies + TV only)
    const streamingSection = modal.querySelector('#streamingSection');
    if (streamingSection && ['movies', 'tv'].includes((item.category || '').toLowerCase())) {
        fetchStreamingProviders(item).then(result => {
            if (!result || !result.providers || result.providers.length === 0) {
                streamingSection.innerHTML = '<p class="text-xs text-slate-500">Not available to stream in the US.</p>';
                return;
            }
            const { providers, justWatchLink } = result;
            const logos = providers.slice(0, 8).map(p => {
                const urlFn = STREAMING_URLS[p.provider_id];
                const href = urlFn ? urlFn(item.title) : justWatchLink || '#';
                return `<a href="${href}" target="_blank" rel="noopener noreferrer" title="Watch on ${p.provider_name}">
                    <img src="https://image.tmdb.org/t/p/w45${p.logo_path}" alt="${p.provider_name}" class="w-9 h-9 rounded-lg hover:ring-2 hover:ring-white transition-all" onerror="this.parentElement.style.display='none'">
                </a>`;
            }).join('');
            streamingSection.innerHTML = `
                <p class="text-xs text-slate-400 font-semibold mb-2 uppercase tracking-wide">Available to Stream</p>
                <div class="flex flex-wrap gap-2">${logos}</div>
            `;
        });
    }

    // Add keyboard event listener for Escape key
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            const hasUnsavedContent = checkUnsavedReviewContent();
            if (hasUnsavedContent) {
                // Show warning and prevent closure
                if (!confirm('You have unsaved review content. Are you sure you want to close without saving?')) {
                    return;
                }
            }
            modal.remove();
            document.body.style.overflow = 'auto';
            document.removeEventListener('keydown', handleKeyDown);
        }
    };
    document.addEventListener('keydown', handleKeyDown);
    
    // Clean up event listener when modal is removed
    const originalRemove = modal.remove;
    modal.remove = function() {
        document.removeEventListener('keydown', handleKeyDown);
        originalRemove.call(this);
    };

    // --- Add Event Listeners to Modal Elements ---

    modal.querySelector('.close-btn').addEventListener('click', () => {
        // Check if user has unsaved review content
        const hasUnsavedContent = checkUnsavedReviewContent();
        if (hasUnsavedContent) {
            // Show warning and prevent closure
            if (!confirm('You have unsaved review content. Are you sure you want to close without saving?')) {
                return;
            }
        }
        modal.remove();
        document.body.style.overflow = 'auto';
    });

    modal.querySelector('#writeReviewBtn').addEventListener('click', async () => {
        const reviewFormContainer = modal.querySelector('#reviewFormContainer');
        reviewFormContainer.classList.toggle('hidden');
        
        // Initialize rich text editor when form is shown
        if (!reviewFormContainer.classList.contains('hidden')) {
            console.log('Initializing rich text editor...');
            quillEditor = await initializeRichTextEditor('reviewTextEditor');
        } else {
            // Clean up editor when form is hidden
            quillEditor = null;
        }
    });

    // Favorites Logic
    const addToFavoritesBtn = modal.querySelector('#addToFavoritesBtn');
    let isFavorite = false;
    if (auth.currentUser) {
        const userId = auth.currentUser.uid;
        const favRef = ref(db, `favorites/${userId}/${mediaKey}`);
        get(favRef).then(snapshot => {
            if (snapshot.exists()) {
                isFavorite = true;
                addToFavoritesBtn.textContent = 'Remove from Favorites';
                addToFavoritesBtn.classList.add('bg-red-600', 'hover:bg-red-700', 'border-red-600');
            }
        });
    }

    addToFavoritesBtn.addEventListener('click', async () => {
        if (!auth.currentUser) {
            alert('You must be logged in to add favorites.');
            return;
        }
        const userId = auth.currentUser.uid;
        const favRef = ref(db, `favorites/${userId}/${mediaKey}`);
        if (!isFavorite) {
            await push(favRef, {
                mediaId: mediaKey,
                addedAt: new Date().toISOString()
            });
            addToFavoritesBtn.textContent = 'Remove from Favorites';
            isFavorite = true;
            addToFavoritesBtn.classList.add('bg-red-600', 'hover:bg-red-700', 'border-red-600');
        } else {
            get(favRef).then(snapshot => {
                if (snapshot.exists()) {
                    const updates = {};
                    Object.keys(snapshot.val()).forEach(key => {
                        updates[`${key}`] = null;
                    });
                    import('https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js').then(({
                        update
                    }) => {
                        update(favRef, updates);
                    });
                }
            });
            addToFavoritesBtn.textContent = 'Add to Favorites';
            isFavorite = false;
            addToFavoritesBtn.classList.remove('bg-red-600', 'hover:bg-red-700', 'border-red-600');
        }
    });

    // Review Submission Logic
    modal.querySelector('#reviewForm').addEventListener('submit', async function (e) {
        e.preventDefault();
        console.log('Review form submitted');
        
        const editorContent = getEditorContent();
        const reviewText = editorContent.text;
        const reviewHTML = editorContent.html;
        const reviewRating = parseFloat(modal.querySelector('#reviewRating').value);
        const reviewError = modal.querySelector('#reviewError');
        reviewError.textContent = '';

        console.log('Review text:', reviewText, 'Rating:', reviewRating);

        if (!reviewText || isNaN(reviewRating) || reviewRating < 1 || reviewRating > 10 || (reviewRating * 10) % 1 !== 0) {
            reviewError.textContent = 'Please enter a review and a rating between 1 and 10, with at most one decimal place.';
            return;
        }

        const user = auth.currentUser;
        if (!user) {
            reviewError.textContent = 'You must be logged in to submit a review.';
            return;
        }

        try {
            const reviewsRef = ref(db, `reviews/${mediaId}`);
            await push(reviewsRef, {
                userId: user.uid,
                mediaId: mediaId,
                reviewText: reviewHTML, // Store HTML content for formatting
                text: reviewText, // Also store plain text for backwards compatibility
                rating: reviewRating,
                timestamp: new Date().toISOString(),
                user: user.email || user.displayName || 'Anonymous'
            });

            // Refresh reviews, rating, and count
            const newAvgRating = await getAverageRating(mediaId);
            const newReviewCount = await getReviewCount(mediaId);
            const reviewsSnapshot = await get(reviewsRef);
            modal.querySelector('#reviewsSection').innerHTML = reviewsSnapshot.exists()
                ? buildReviewsHtml(reviewsSnapshot.val(), mediaId)
                : '<div class="mt-8 text-slate-500">No reviews yet.</div>';
            modal.querySelector('#modalRating').textContent = `★ ${newAvgRating}`;
            modal.querySelector('#modalReviewCount').textContent = newReviewCount;
            lucide.createIcons();

            // Clear the rich text editor and form
            clearEditor();
            modal.querySelector('#reviewForm').reset();
            modal.querySelector('#reviewFormContainer').classList.add('hidden');
            console.log('Review submitted successfully!');

        } catch (err) {
            reviewError.textContent = 'Error submitting review: ' + (err.message || err);
        }
    });
}
window.showItemDetails = showItemDetails;

// Attach card listeners outside of showItemDetails
function addCardListeners() {
    const container = document.getElementById('cardsContainer');
    if (!container) return;
    // Remove any previous click handler
    container.onclick = null;
    container.onclick = function (e) {
        // Find the closest .media-card ancestor
        const card = e.target.closest('.media-card');
        if (!card || !container.contains(card)) return;
        // Get item id from card dataset
        const itemId = card.dataset.id;
        // Find item by id or title
        let item = allItems.find(item => {
            if (item.id && item.id == itemId) return true;
            // fallback: match normalized title
            if (!item.id && item.title) {
                const normTitle = item.title.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                return normTitle === itemId;
            }
            return false;
        });
        if (item) {
            showItemDetails(item);
        }
    };
    // Optionally, set pointer cursor for accessibility
    const cards = container.querySelectorAll('.media-card');
    cards.forEach(card => {
        const imageElem = card.querySelector('.card-image');
        const titleElem = card.querySelector('.card-title');
        if (imageElem) imageElem.style.cursor = 'pointer';
        if (titleElem) titleElem.style.cursor = 'pointer';
    });
}

// Export function for use by other modules
window.filterCards = filterCards;

// Render cards in the container
async function renderCards(container, items) {
    console.log('[cards.js] renderCards called with items:', items);

    container.innerHTML = '';
    if (!items || items.length === 0) {
        container.innerHTML = '<div style="padding:32px;text-align:center;color:#888;">No media items found.</div>';
        return;
    }

    // Collapse logic: show only first 9 by default
    let visibleCount = 9;
    let loadingMore = false;
    let observer = null;

    async function renderVisibleCards() {
        container.style.background = 'transparent';
        container.style.padding = '0';
        container.style.borderRadius = '0';
        container.style.boxShadow = 'none';

        let cardHTML = '';
        const toShow = items.slice(0, visibleCount);
        // Batch fetch ratings for only visible cards
        await fetchRatingsForItems(toShow);
        toShow.forEach(item => {
            const reviewSnippet = item.reviewSnippet || (item.description ? item.description.split('.').slice(0, 1).join('.') : '');
            const cardId = item.id || (item.title ? item.title.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : '');
            const avgRating = (item.liveAvgRating !== undefined && item.liveAvgRating !== -1)
                ? `<i data-lucide=\"star\" class=\"w-3 h-3 fill-current\"></i> ${item.liveAvgRating}`
                : `<span class=\"text-slate-400 text-xs\">No reviews yet</span>`;
            cardHTML += `
                <div class=\"media-card group bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-indigo-500/50 transition-all hover:shadow-xl hover:shadow-indigo-500/10 flex flex-col cursor-pointer\" data-id=\"${cardId}\">
                    <div class=\"relative h-48 overflow-hidden\">
                        <img class=\"card-image w-full h-full object-cover transform group-hover:scale-110 transition-duration-500 transition-transform\" src=\"${item.poster || item.image || ''}\" alt=\"${item.title || ''}\">
                        <div class=\"absolute top-2 right-2 px-2 py-1 rounded-md flex items-center gap-1\">
                            <span class=\"star-rating text-yellow-400 text-xs flex items-center gap-1 review-score-glow\" id=\"rating-${cardId}\">${avgRating}</span>
                        </div>
                    </div>
                    <div class=\"p-5 flex-1 flex flex-col\">
                        <div class="flex justify-between items-start mb-2">
                            <h3 class="card-title text-lg font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-1">${item.title || ''}</h3>
                            <span class="text-xs text-slate-500 font-mono mt-1">${item.year || ''}</span>
                        </div>
                         <p class="text-slate-400 text-sm mb-4 flex-1 line-clamp-2">
                            ${reviewSnippet}
                        </p>
                        <div class="pt-4 border-t border-slate-700 text-slate-500 text-xs mb-2">
                             <span class="font-medium text-slate-400">${item.genre || ''}</span>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = cardHTML;
        lucide.createIcons();

        // Infinite scroll: add sentinel if more cards remain
        if (items.length > visibleCount) {
            let sentinel = document.getElementById('infinite-scroll-sentinel');
            if (!sentinel) {
                sentinel = document.createElement('div');
                sentinel.id = 'infinite-scroll-sentinel';
                sentinel.style.height = '32px';
                container.appendChild(sentinel);
            }
            // Setup IntersectionObserver
            if (observer) observer.disconnect();
            observer = new window.IntersectionObserver(entries => {
                if (entries[0].isIntersecting && !loadingMore) {
                    loadingMore = true;
                    setTimeout(async () => {
                        visibleCount += 9;
                        await renderVisibleCards();
                        addCardListeners();
                        loadingMore = false;
                    }, 200);
                }
            });
            observer.observe(sentinel);
        }
    }
    renderVisibleCards();
}

// Show loading state
function showLoadingState(container) {
    container.innerHTML = '<div style="padding:32px;text-align:center;color:#888;">Loading...</div>';
}

// Sorting functionality
function sortItems(items, sortOption) {
    if (!items || !Array.isArray(items)) return items;
    let sorted = [...items];
    switch (sortOption) {
        case 'year-desc':
            sorted = sorted.filter(item => item.year && !isNaN(parseInt(item.year)));
            sorted.sort((a, b) => parseInt(b.year) - parseInt(a.year));
            break;
        case 'year-asc':
            sorted = sorted.filter(item => item.year && !isNaN(parseInt(item.year)));
            sorted.sort((a, b) => parseInt(a.year) - parseInt(b.year));
            break;
        case 'title-asc':
            sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
            break;
        case 'title-desc':
            sorted.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
            break;
        case 'rating-desc':
            sorted.sort((a, b) => (b.liveAvgRating ?? -1) - (a.liveAvgRating ?? -1));
            break;
        case 'rating-asc':
            sorted.sort((a, b) => {
                const aRating = a.liveAvgRating === -1 ? Infinity : (a.liveAvgRating ?? Infinity);
                const bRating = b.liveAvgRating === -1 ? Infinity : (b.liveAvgRating ?? Infinity);
                return aRating - bRating;
            });
            break;
        default:
            break;
    }
    return sorted;
}

// Listen for sort apply button
const applySortBtn = document.getElementById('applySortBtn');
if (applySortBtn) {
    applySortBtn.addEventListener('click', async function () {
        const btn = this;
        btn.classList.remove('bg-indigo-600');
        btn.classList.add('bg-indigo-800');

        try {
            await filterCards(currentFilter);
        } catch (err) {
            console.error('Error applying sort/filter:', err);
        }

        const searchContainer = document.querySelector('.search-and-sort-container');
        if (searchContainer) {
            const rect = searchContainer.getBoundingClientRect();
            window.scrollBy({ top: rect.top - 64, left: 0, behavior: 'smooth' });
        }

        setTimeout(() => {
            btn.classList.remove('bg-indigo-800');
            btn.classList.add('bg-indigo-600');
        }, 250);
    });
}
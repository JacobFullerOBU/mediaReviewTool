import { fetchMovies, fetchTV, fetchBooks } from './main.js';

const TMDB_KEY = 'f50a7cd62fa00a24f29a0e3ebb12c130';
const OMDB_KEY = '2669280';

const RT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" class="inline w-3 h-3 -mt-0.5 mr-0.5" viewBox="0 0 16 16"><circle cx="8" cy="9.5" r="5.5" fill="currentColor"/><path d="M6 4.5 C6 4.5 6 2 8 2 C10 2 10 4.5 10 4.5 C10 4.5 9 3.5 8 4 C7 3.5 6 4.5 6 4.5Z" fill="#16a34a"/><path d="M8 2 C8 2 8 0.5 9.5 1" stroke="#16a34a" stroke-width="1" stroke-linecap="round" fill="none"/></svg>`;

function updateTrueRated(item, cardId) {
    const el = document.getElementById(`tr-${cardId}`);
    if (!el) return;
    const scores = [];
    if (item.liveAvgRating != null && item.liveAvgRating !== -1) scores.push(item.liveAvgRating);
    if (item.rtScore != null) scores.push(parseInt(item.rtScore) / 10);
    if (item.tmdbScore != null) scores.push(item.tmdbScore);
    if (scores.length < 2) {
        el.textContent = 'TR —';
        el.className = 'text-xs font-mono text-slate-500';
        return;
    }
    const trueRated = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
    el.textContent = `TR ${trueRated}`;
    el.className = 'text-xs font-mono font-semibold text-indigo-400';
}

async function fetchTMDBScore(item) {
    const cacheKey = `tmdb_score_${(item.title || '').toLowerCase().replace(/[^a-z0-9]/g, '_')}_${item.year || ''}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        const { score, ts } = JSON.parse(cached);
        if (Date.now() - ts < 7 * 24 * 60 * 60 * 1000) return score;
    }
    try {
        const params = new URLSearchParams({ api_key: TMDB_KEY, query: item.title, language: 'en-US' });
        if (item.year) params.set('year', item.year);
        const data = await fetch(`https://api.themoviedb.org/3/search/movie?${params}`).then(r => r.json());
        const score = data.results?.[0]?.vote_average ?? null;
        localStorage.setItem(cacheKey, JSON.stringify({ score, ts: Date.now() }));
        return score;
    } catch (e) {
        console.error('TMDB score fetch failed:', e);
        return null;
    }
}

async function fetchRTScore(item) {
    const cacheKey = `rt_${(item.title || '').toLowerCase().replace(/[^a-z0-9]/g, '_')}_${item.year || ''}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        const { score, ts } = JSON.parse(cached);
        if (Date.now() - ts < 7 * 24 * 60 * 60 * 1000) return score;
    }
    try {
        const params = new URLSearchParams({ t: item.title, apikey: OMDB_KEY });
        if (item.year) params.set('y', item.year);
        const data = await fetch(`https://www.omdbapi.com/?${params}`).then(r => r.json());
        const score = data.Ratings?.find(r => r.Source === 'Rotten Tomatoes')?.Value || null;
        localStorage.setItem(cacheKey, JSON.stringify({ score, ts: Date.now() }));
        return score;
    } catch (e) {
        console.error('RT score fetch failed:', e);
        return null;
    }
}

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
let currentInTheatresFilter = false;
let quillEditor = null;
let musicLoaded = false;

// Title slugs that appear in more than one category (e.g. "the_housemaid" in both movies + books).
// The legacy fallback must be blocked for these to prevent a book card from displaying movie reviews.
let crossCategoryAmbiguousSlugs = new Set();

function buildCrossCategoryAmbiguousSlugs() {
    const slugCatMap = {};
    for (const item of allItems) {
        const slug = item.title ? item.title.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : '';
        const cat = (Array.isArray(item.category) ? item.category[0] : (item.category || '')).toLowerCase();
        if (!slugCatMap[slug]) slugCatMap[slug] = new Set();
        slugCatMap[slug].add(cat);
    }
    crossCategoryAmbiguousSlugs = new Set(
        Object.entries(slugCatMap)
            .filter(([, cats]) => cats.size > 1)
            .map(([slug]) => slug)
    );
}

const MUSIC_GENRE_BUCKETS = [
    { label: 'Pop',        re: /\bpop\b/i },
    { label: 'Rock',       re: /\brock\b|hard rock|classic rock/i },
    { label: 'Hip-Hop',    re: /hip.?hop|\brap\b|\btrap\b/i },
    { label: 'Electronic', re: /electronic|edm|\bhouse\b|techno|trance|\bdance\b/i },
    { label: 'R&B / Soul', re: /r.?n.?b|\bsoul\b|\bfunk\b|rhythm and blues/i },
    { label: 'Country',    re: /\bcountry\b/i },
    { label: 'Jazz',       re: /\bjazz\b/i },
    { label: 'Classical',  re: /classical|orchestral|opera/i },
    { label: 'Indie',      re: /\bindie\b|alternative/i },
    { label: 'Metal',      re: /\bmetal\b/i },
    { label: 'Latin',      re: /latin|reggaeton|salsa|bachata/i },
    { label: 'K-Pop',      re: /k.?pop|korean pop/i },
    { label: 'Blues',      re: /\bblues\b/i },
    { label: 'Folk',       re: /\bfolk\b/i },
    { label: 'Reggae',     re: /reggae/i },
    { label: 'Punk',       re: /\bpunk\b/i },
];

function normalizeMusicGenre(rawGenre) {
    for (const bucket of MUSIC_GENRE_BUCKETS) {
        if (bucket.re.test(rawGenre)) return bucket.label;
    }
    return null;
}

function getMusicGenres(item) {
    if (Array.isArray(item.genres) && item.genres.length) return item.genres;
    if (item.genre) return item.genre.split(',').map(g => g.trim()).filter(Boolean);
    return [];
}

// Ordered most-specific → least-specific so "Science Fiction" matches before "Fiction"
const BOOK_GENRE_BUCKETS = [
    { label: 'Mystery & Thriller', re: /mystery|thriller|detective|crime|suspense|true crime/i },
    { label: 'Science Fiction',    re: /science fiction|sci-fi|dystopia|extraterrestrial|life on other planets|alternate history/i },
    { label: 'Fantasy',            re: /fantasy|magic\b|dragon|wizard|hobbit|sorcery|mythical/i },
    { label: 'Horror',             re: /horror|vampire|haunted|supernatural/i },
    { label: 'Historical Fiction', re: /historical fiction|historical romance/i },
    { label: 'Romance',            re: /\bromance\b|love stor/i },
    { label: 'Biography & Memoir', re: /biograph|autobiography|memoir/i },
    { label: 'Young Adult',        re: /young adult|juvenile/i },
    { label: 'Graphic Novels',     re: /graphic novel|comic/i },
    { label: 'Self-Help',          re: /self.help|self.actuali|motivat|personal development/i },
    { label: 'History',            re: /\bhistory\b|political science|world war|social history/i },
    { label: 'Science',            re: /\bscience\b|technology|engineering|mathematics|physics|biology/i },
    { label: 'Business',           re: /\bbusiness\b|economics|finance|management|leadership/i },
    { label: 'Poetry',             re: /poetry|poems/i },
    { label: 'Fiction',            re: /fiction|literature|literary/i },
];

function normalizeBookGenre(rawGenre) {
    for (const bucket of BOOK_GENRE_BUCKETS) {
        if (bucket.re.test(rawGenre)) return bucket.label;
    }
    return null;
}

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
import { fetchMusic } from "./music.js";
import { games } from "./games.js";
import { adminState, deleteReview, editReview, getMediaOverride, updateMediaOverride, getAllMediaOverrides } from "./admin.js";

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
const SKELETON_CARD_HTML = `
    <div class="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 animate-pulse">
        <div class="h-48 bg-slate-700"></div>
        <div class="p-5 space-y-3">
            <div class="h-5 bg-slate-700 rounded w-3/4"></div>
            <div class="h-4 bg-slate-700 rounded w-1/2"></div>
            <div class="h-4 bg-slate-700 rounded w-1/3 mt-4"></div>
        </div>
    </div>
`;

// Cards functionality for displaying popular content
document.addEventListener('DOMContentLoaded', async function () {
    await initCards();
});
async function initCards() {
    const container = document.getElementById('cardsContainer');
    if (!container) return;

    // Show skeleton cards immediately so the page isn't blank during fetch
    container.innerHTML = Array(9).fill(SKELETON_CARD_HTML).join('');

    let movies = [], validTV = [], validGames = [], validBooks = [];

    // Fetch JSON sources, Firebase overrides, and review caches all in parallel
    const [moviesRes, tvRes, booksRes, overridesRes] = await Promise.allSettled([
        fetchMovies(),
        fetchTV(),
        fetchBooks(),
        getAllMediaOverrides(),
        fetchLatestReviewTimesForItems([]), // warms reviewTimestampCache + ratingBulkCache early
    ]);

    if (moviesRes.status === 'fulfilled') {
        movies = moviesRes.value.filter(m => typeof m.title === 'string' && m.title);
    } else {
        console.error("Failed to load movies:", moviesRes.reason);
    }
    if (tvRes.status === 'fulfilled') {
        validTV = tvRes.value.filter(item => typeof item.title === 'string' && item.title);
    } else {
        console.error("Failed to load TV shows:", tvRes.reason);
    }
    if (booksRes.status === 'fulfilled') {
        validBooks = booksRes.value.filter(item => typeof item.title === 'string' && item.title);
    } else {
        console.error("Failed to load books:", booksRes.reason);
    }

    validGames = Array.isArray(games) ? games.filter(item => typeof item.title === 'string' && item.title) : [];

    // Normalize category casing ("Movie" → "movies", "TV" → "tv", etc.)
    const CAT_NORM = { movie: 'movies', tv: 'tv', book: 'books', game: 'games', music: 'music' };
    const normalizeCategory = item => {
        const raw = (Array.isArray(item.category) ? item.category[0] : (item.category || '')).trim();
        const lc = raw.toLowerCase();
        item.category = CAT_NORM[lc] || lc || raw;
        return item;
    };

    const allRaw = [...movies, ...validTV, ...validGames, ...validBooks].map(normalizeCategory);

    // Deduplicate: within each category, keep one card per title slug.
    // For books: multiple editions of the same book → keep one with the best cover + longest description.
    // For movies/TV: same-slug items may be legitimately different films (remakes) — keep all.
    const dedupedBooks = (() => {
        const seen = {};
        for (const item of allRaw.filter(i => i.category === 'books')) {
            const slug = item.title ? item.title.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : '';
            if (!seen[slug]) {
                seen[slug] = item;
            } else {
                const prev = seen[slug];
                const hasBetterCover = item.poster && !item.poster.includes('image not available') &&
                    (!prev.poster || prev.poster.includes('image not available'));
                const hasLongerDesc = (item.description || '').length > (prev.description || '').length;
                if (hasBetterCover || (!prev.poster && hasLongerDesc)) {
                    seen[slug] = item;
                }
            }
        }
        return Object.values(seen);
    })();

    allItems = [
        ...allRaw.filter(i => i.category !== 'books'),
        ...dedupedBooks,
    ];

    // Apply admin field overrides (e.g. genre, title) stored in Firebase
    const overrides = overridesRes?.status === 'fulfilled' ? overridesRes.value : {};
    if (overrides && Object.keys(overrides).length > 0) {
        allItems = allItems.map(item => {
            const id = getMediaId(item);
            return overrides[id] ? { ...item, ...overrides[id] } : item;
        });
    }

    window.allItems = allItems;

    // Build the cross-category ambiguous slugs set so legacy fallback won't bleed across categories.
    buildCrossCategoryAmbiguousSlugs();

    // Initialize tab functionality
    initTabFunctionality();

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.value = 'rating-desc';
    }

    // Mark the 'All' tab as active on initial load
    const allTabBtn = document.querySelector('.tab-btn[data-category="all"]');
    if (allTabBtn) {
        document.querySelectorAll('.tab-btn').forEach(t => {
            t.classList.remove('active', 'bg-indigo-600', 'text-white', 'shadow-md');
            t.classList.add('bg-slate-800', 'text-slate-400');
        });
        allTabBtn.classList.add('active', 'bg-indigo-600', 'text-white', 'shadow-md');
        allTabBtn.classList.remove('bg-slate-800', 'text-slate-400');
    }

    // Check if any items were loaded and render them with default sort.
    if (allItems.length > 0) {
        await filterCards('all');
    } else {
        container.innerHTML = '<div style="padding:32px;text-align:center;color:#888;">Could not load any media. Please check data sources and browser console for errors.</div>';
    }

    // Background-load music — large JSON, doesn't block the initial render
    fetchMusic().then(async musicData => {
        const validMusic = musicData
            .filter(item => typeof item.title === 'string' && item.title)
            .map(item => {
                const raw = (Array.isArray(item.category) ? item.category[0] : (item.category || '')).trim();
                const lc = raw.toLowerCase();
                item.category = CAT_NORM[lc] || lc || raw;
                return item;
            });
        musicLoaded = true;
        if (!validMusic.length) return;
        allItems.push(...validMusic);
        window.allItems = allItems;
        buildCrossCategoryAmbiguousSlugs();
        // Re-render only if the active tab will show music
        const activeTab = document.querySelector('.tab-btn.active');
        const activeCat = activeTab ? activeTab.dataset.category : 'all';
        if (activeCat === 'all' || activeCat === 'music') {
            await filterCards(activeCat);
        }
    }).catch(e => {
        musicLoaded = true; // don't show "Loading..." forever on failure
        console.error('Failed to load music:', e);
    });
}

function renderGenreFilters(category) {
    const container = document.getElementById('genreFilterContainer');
    if (!container) return;

    const theatresCheckboxRow = document.getElementById('inTheatresCheckboxRow');
    const theatresCheckbox = document.getElementById('inTheatresSortCheckbox');

    const isMovies = category && category.toLowerCase() === 'movies';
    const showTheatresFilter = !category || category === 'all' || isMovies;

    if (theatresCheckboxRow) theatresCheckboxRow.classList.toggle('hidden', !showTheatresFilter);
    if (!showTheatresFilter) {
        currentInTheatresFilter = false;
        if (theatresCheckbox) theatresCheckbox.checked = false;
    } else if (theatresCheckbox) {
        theatresCheckbox.checked = currentInTheatresFilter;
    }

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

    const isBooks = category.toLowerCase() === 'books';
    const isMusic = category.toLowerCase() === 'music';
    const genreSet = new Set();
    categoryItems.forEach(item => {
        const rawGenres = isMusic ? getMusicGenres(item) : (item.genre || '').split(',').map(g => g.trim()).filter(Boolean);
        rawGenres.forEach(t => {
            if (!t) return;
            if (isBooks) {
                const normalized = normalizeBookGenre(t);
                if (normalized) genreSet.add(normalized);
            } else if (isMusic) {
                const normalized = normalizeMusicGenre(t);
                if (normalized) genreSet.add(normalized);
            } else {
                genreSet.add(t);
            }
        });
    });

    // Preserve bucket order for books and music; sort alphabetically for others
    const genres = isBooks
        ? BOOK_GENRE_BUCKETS.map(b => b.label).filter(l => genreSet.has(l))
        : isMusic
            ? MUSIC_GENRE_BUCKETS.map(b => b.label).filter(l => genreSet.has(l))
            : Array.from(genreSet).sort();

    if (genres.length === 0 && !isMovies) {
        container.innerHTML = '';
        container.classList.add('hidden');
        container.classList.remove('flex');
        return;
    }

    currentGenreFilter = 'all';

    const base = 'genre-btn px-3 py-1 rounded-full text-xs whitespace-nowrap transition-all cursor-pointer border';
    const inactive = 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700';
    const active = 'bg-indigo-600 text-white border-indigo-600 shadow-sm';
    const theatresActive = 'bg-emerald-600 text-white border-emerald-600 shadow-sm';
    const theatresInactive = 'bg-slate-800 text-emerald-400 border-emerald-700 hover:bg-slate-700';

    const parts = [];
    if (isMovies) {
        parts.push(`<button id="inTheatresMainBtn" class="px-3 py-1 rounded-full text-xs whitespace-nowrap transition-all cursor-pointer border ${currentInTheatresFilter ? theatresActive : theatresInactive}">In Theatres</button>`);
        if (genres.length > 0) {
            parts.push(`<span class="text-slate-600 self-center select-none">|</span>`);
        }
    }
    if (genres.length > 0) {
        parts.push(`<button class="${base} ${active}" data-genre="all">All</button>`);
        genres.forEach(g => parts.push(`<button class="${base} ${inactive}" data-genre="${escapeHtml(g)}">${escapeHtml(g)}</button>`));
    }

    container.innerHTML = parts.join('');
    container.classList.remove('hidden');
    container.classList.add('flex');

    const inTheatresBtn = document.getElementById('inTheatresMainBtn');
    if (inTheatresBtn) {
        inTheatresBtn.addEventListener('click', function () {
            currentInTheatresFilter = !currentInTheatresFilter;
            this.className = `px-3 py-1 rounded-full text-xs whitespace-nowrap transition-all cursor-pointer border ${currentInTheatresFilter ? theatresActive : theatresInactive}`;
            const cb = document.getElementById('inTheatresSortCheckbox');
            if (cb) cb.checked = currentInTheatresFilter;
            filterCards(category);
        });
    }

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
    // Pull from sessionStorage cache (5-min TTL) before hitting Firebase
    let ssCache = {};
    try {
        const stored = sessionStorage.getItem('ratingCache');
        if (stored) {
            const { data, ts } = JSON.parse(stored);
            if (Date.now() - ts < 5 * 60 * 1000) ssCache = data;
        }
    } catch {}

    const itemsNeedingRating = items.filter(i => {
        if (i.liveAvgRating !== undefined) return false;
        const mediaId = getMediaId(i);
        if (ssCache[mediaId] !== undefined) { i.liveAvgRating = ssCache[mediaId]; return false; }
        // Use bulk rating cache computed from the single reviews tree read — avoids N individual Firebase requests
        if (ratingBulkCache !== null) {
            const legacyId = i.title ? i.title.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : '';
            const canUseLegacy = legacyId !== mediaId && !crossCategoryAmbiguousSlugs.has(legacyId);
            if (ratingBulkCache[mediaId] !== undefined) {
                i.liveAvgRating = ratingBulkCache[mediaId];
                return false;
            }
            if (canUseLegacy && ratingBulkCache[legacyId] !== undefined) {
                i.liveAvgRating = ratingBulkCache[legacyId];
                return false;
            }
            i.liveAvgRating = -1;
            return false;
        }
        return true;
    });

    if (itemsNeedingRating.length > 0) {
        const ratingPromises = itemsNeedingRating.map(async item => {
            const mediaId = getMediaId(item);
            const legacyId = item.title ? item.title.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : '';
            let rating = await getAverageRating(mediaId);
            if (rating === 'N/A' && legacyId !== mediaId && !crossCategoryAmbiguousSlugs.has(legacyId)) {
                rating = await getAverageRating(legacyId);
            }
            item.liveAvgRating = (rating === 'N/A') ? -1 : parseFloat(rating);
            ssCache[mediaId] = item.liveAvgRating;
        });
        await Promise.all(ratingPromises);
        try {
            sessionStorage.setItem('ratingCache', JSON.stringify({ data: ssCache, ts: Date.now() }));
        } catch {}
    }
}

let reviewTimestampCache = null;
let ratingBulkCache = null;

async function fetchLatestReviewTimesForItems(items) {
    if (!reviewTimestampCache) {
        // Check sessionStorage first (5-min TTL) to avoid re-reading the full reviews tree on refresh
        try {
            const stored = sessionStorage.getItem('reviewTsCache');
            if (stored) {
                const { data, ts } = JSON.parse(stored);
                if (Date.now() - ts < 5 * 60 * 1000) reviewTimestampCache = data;
            }
        } catch {}
    }

    // Restore rating bulk cache from sessionStorage on page reload
    if (!ratingBulkCache) {
        try {
            const stored = sessionStorage.getItem('reviewRatingCache');
            if (stored) {
                const { data, ts } = JSON.parse(stored);
                if (Date.now() - ts < 5 * 60 * 1000) ratingBulkCache = data;
            }
        } catch {}
    }

    if (!reviewTimestampCache) {
        reviewTimestampCache = {};
        ratingBulkCache = {};
        try {
            const snapshot = await get(ref(db, 'reviews'));
            if (snapshot.exists()) {
                snapshot.forEach(mediaSnap => {
                    let latest = 0;
                    let total = 0, count = 0;
                    mediaSnap.forEach(reviewSnap => {
                        const data = reviewSnap.val();
                        const ts = data.timestamp;
                        if (ts) {
                            const t = new Date(ts).getTime();
                            if (t > latest) latest = t;
                        }
                        if (typeof data.rating === 'number') {
                            total += data.rating;
                            count++;
                        }
                    });
                    reviewTimestampCache[mediaSnap.key] = latest;
                    if (count > 0) {
                        ratingBulkCache[mediaSnap.key] = parseFloat((total / count).toFixed(1));
                    }
                });
            }
        } catch (e) {
            reviewTimestampCache = {};
            ratingBulkCache = {};
        }
        try {
            sessionStorage.setItem('reviewTsCache', JSON.stringify({ data: reviewTimestampCache, ts: Date.now() }));
            sessionStorage.setItem('reviewRatingCache', JSON.stringify({ data: ratingBulkCache, ts: Date.now() }));
        } catch {}
    }

    const cache = reviewTimestampCache;
    items.forEach(item => {
        if (item.latestReviewTime !== undefined) return;
        const mediaId = getMediaId(item);
        const legacyId = item.title ? item.title.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : '';
        const canUseLegacy = legacyId !== mediaId && !crossCategoryAmbiguousSlugs.has(legacyId);
        item.latestReviewTime = cache[mediaId] || (canUseLegacy ? cache[legacyId] : 0) || 0;
    });
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

    // 'All' tab shows only reviewed items when not actively searching
    const isDefaultHome = !category || category === 'all';
    if (isDefaultHome && !searchTerm) {
        await fetchLatestReviewTimesForItems(items);
        items = items.filter(item => item.latestReviewTime > 0);
    }

    // Filter by in-theatres (movies only): if a releaseDate is present, only include movies
    // that have already opened and are within the standard 8-week theatrical window.
    if (currentInTheatresFilter) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const eightWeeksAgo = new Date(today);
        eightWeeksAgo.setDate(today.getDate() - 56);
        items = items.filter(item => {
            if (!item.inTheatres) return false;
            if (!item.releaseDate) return true; // no date yet — include it
            const release = new Date(item.releaseDate);
            return release <= today && release >= eightWeeksAgo;
        });
    }

    // Filter by genre
    if (currentGenreFilter && currentGenreFilter !== 'all') {
        items = items.filter(item => {
            const cat = (Array.isArray(item.category) ? item.category[0] : (item.category || '')).toLowerCase();
            if (cat === 'music') {
                return getMusicGenres(item).some(g => normalizeMusicGenre(g) === currentGenreFilter);
            }
            if (!item.genre) return false;
            if (cat === 'books') {
                return item.genre.split(',').some(g => normalizeBookGenre(g.trim()) === currentGenreFilter);
            }
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
    const sortOption = document.getElementById('sortSelect')?.value || 'rating-desc';
    if (sortOption.startsWith('rating-')) {
        // Pre-populate the bulk rating cache (single Firebase read) so fetchRatingsForItems
        // can resolve all items from cache instead of making N individual requests.
        await fetchLatestReviewTimesForItems(items);
        await fetchRatingsForItems(items);
        // Secondary guard: in 'all' tab (no active search), drop items with no actual rating
        if (isDefaultHome && !searchTerm) {
            items = items.filter(item => item.liveAvgRating !== -1);
        }
    } else if (sortOption === 'recent-desc') {
        await fetchLatestReviewTimesForItems(items);
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
        const spoilerTag = r.spoilers
            ? `<span class="text-xs font-semibold text-amber-400 bg-amber-900/30 border border-amber-700/50 px-2 py-0.5 rounded">Spoilers</span>`
            : '';
        const uid = `spoiler-${reviewId}`;
        const contentHtml = r.spoilers ? `
            <div class="spoiler-gate mt-2">
                <label class="flex items-center gap-2 text-sm text-amber-400 cursor-pointer select-none w-fit">
                    <input type="checkbox" class="spoiler-toggle w-4 h-4 rounded border-amber-700 bg-slate-900 text-amber-500 focus:ring-amber-500 cursor-pointer" id="${uid}" checked>
                    Uncheck to reveal spoilers
                </label>
                <div class="spoiler-body hidden mt-2 review-content text-slate-300" style="line-height: 1.6;" data-for="${uid}">${sanitizedContent}</div>
            </div>
        ` : `<div class="review-content text-slate-300 mt-2" style="line-height: 1.6;">${sanitizedContent}</div>`;
        return `
            <div class="review-block bg-slate-900/50 p-4 rounded-lg border border-slate-700"
                 data-review-id="${reviewId}" data-media-id="${mediaId}"
                 data-rating="${r.rating}" data-plain-text="${encodeURIComponent(r.text || '')}">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2 text-yellow-400 font-bold">
                        <i data-lucide="star" class="w-4 h-4 fill-current"></i> ${r.rating}
                        ${spoilerTag}
                    </div>
                    <div class="text-right">
                        <div class="text-slate-400 text-sm">${r.user || 'Anonymous'}</div>
                        <span class="text-slate-500 text-xs">${formattedDate}</span>
                    </div>
                </div>
                ${contentHtml}
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
    const override = await getMediaOverride(mediaId);
    const displayItem = override ? { ...item, ...override } : item;
    let reviewsHtml = '';

    try {
        let snapshot = await get(ref(db, `reviews/${mediaId}`));
        // Fall back to the legacy title-only ID only when the slug is unambiguous
        // (i.e. this title does not exist in another category). This prevents a book
        // detail view from displaying reviews that were written for a same-named movie.
        if (!snapshot.exists() && legacyId !== mediaId && !crossCategoryAmbiguousSlugs.has(legacyId)) {
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
                <img id="modalPoster" src="${displayItem.poster || displayItem.image || ''}" alt="${displayItem.title}" class="w-48 h-auto rounded-lg shadow-lg object-cover flex-shrink-0 mx-auto md:mx-0">
                <div class="flex-1 text-slate-300">
                    <h2 id="modalTitle" class="text-3xl font-bold text-white mb-2">${displayItem.title || ''}</h2>
                    <div class="flex items-center gap-4 text-sm text-slate-400 mb-4">
                        <span id="modalYear">${displayItem.year ? `<strong>Year:</strong> ${displayItem.year}` : ''}</span>
                        <span id="modalGenre">${displayItem.genre ? `<strong>Genre:</strong> ${displayItem.genre}` : ''}</span>
                    </div>
                    <div id="modalCredit" class="text-sm text-slate-400 mb-4">
                        ${displayItem.director ? `<strong>Director:</strong> ${displayItem.director}` : displayItem.creator ? `<strong>Creator:</strong> ${displayItem.creator}` : displayItem.author ? `<strong>Author:</strong> ${displayItem.author}` : ''}
                    </div>
                    <div id="modalActors" class="text-sm text-slate-400 mb-4">
                        ${displayItem.actors ? `<strong>Cast:</strong> ${displayItem.actors}` : ''}
                    </div>
                    <p id="modalDescription" class="text-slate-400 mb-4">${displayItem.description || ''}</p>
                    <div id="streamingSection" class="mb-4">
                        ${['movies', 'tv'].includes((displayItem.category || '').toLowerCase())
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
                        ${adminState.isAdmin ? `<button id="editInfoBtn" class="flex items-center gap-1 border border-purple-600 hover:bg-purple-800 text-purple-300 font-bold py-2 px-4 rounded-lg transition-colors text-sm"><i data-lucide="pencil" class="w-4 h-4"></i> Edit Info</button>` : ''}
                    </div>
                    <p class="text-xs text-slate-500 mt-2">As an Amazon Associate I earn from qualifying purchases.</p>
                </div>
            </div>
            ${adminState.isAdmin ? `
            <div id="editInfoPanel" class="hidden mt-6 pt-6 border-t border-purple-800/50">
                <h4 class="text-sm font-bold text-white uppercase tracking-wide mb-4 flex items-center gap-2">
                    <i data-lucide="pencil" class="w-4 h-4 text-purple-400"></i> Edit Card Info
                </h4>
                <div class="space-y-3">
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs text-slate-400 mb-1">Title</label>
                            <input id="editTitle" type="text" class="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-white text-sm focus:ring-1 focus:ring-purple-500 outline-none">
                        </div>
                        <div>
                            <label class="block text-xs text-slate-400 mb-1">Year</label>
                            <input id="editYear" type="text" class="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-white text-sm focus:ring-1 focus:ring-purple-500 outline-none">
                        </div>
                    </div>
                    <div>
                        <label class="block text-xs text-slate-400 mb-1">Genre</label>
                        <input id="editGenre" type="text" class="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-white text-sm focus:ring-1 focus:ring-purple-500 outline-none">
                    </div>
                    <div>
                        <label class="block text-xs text-slate-400 mb-1">Poster URL</label>
                        <input id="editPoster" type="url" class="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-white text-sm focus:ring-1 focus:ring-purple-500 outline-none">
                    </div>
                    <div>
                        <label class="block text-xs text-slate-400 mb-1">Description</label>
                        <textarea id="editDescription" rows="4" class="w-full bg-slate-900 border border-slate-600 rounded px-2 py-2 text-white text-sm resize-vertical focus:ring-1 focus:ring-purple-500 outline-none"></textarea>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label id="editCreditLabel" class="block text-xs text-slate-400 mb-1">Director</label>
                            <input id="editCredit" type="text" class="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-white text-sm focus:ring-1 focus:ring-purple-500 outline-none">
                        </div>
                        <div>
                            <label class="block text-xs text-slate-400 mb-1">Cast / Actors</label>
                            <input id="editActors" type="text" class="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-white text-sm focus:ring-1 focus:ring-purple-500 outline-none">
                        </div>
                    </div>
                    <div class="flex gap-2 pt-2">
                        <button id="saveInfoBtn" class="text-sm bg-purple-700 hover:bg-purple-600 text-white px-4 py-1.5 rounded font-semibold transition-colors">Save Changes</button>
                        <button id="cancelInfoBtn" class="text-sm bg-slate-700 hover:bg-slate-600 text-white px-4 py-1.5 rounded transition-colors">Cancel</button>
                    </div>
                    <p id="editInfoError" class="text-red-400 text-xs hidden"></p>
                </div>
            </div>
            ` : ''}
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
                    <div class="flex items-center gap-2">
                        <input type="checkbox" id="reviewSpoilers" class="w-4 h-4 rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500 cursor-pointer">
                        <label for="reviewSpoilers" class="text-sm text-slate-300 cursor-pointer select-none">Contains spoilers</label>
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

    // Spoiler toggles: reveal/hide spoiler content when checkbox is unchecked/checked
    modal.querySelector('#reviewsSection').addEventListener('change', (e) => {
        const toggle = e.target.closest('.spoiler-toggle');
        if (!toggle) return;
        const body = toggle.closest('.spoiler-gate').querySelector('.spoiler-body');
        if (body) body.classList.toggle('hidden', toggle.checked);
    });

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

        // Edit card info controls
        const editInfoBtn    = modal.querySelector('#editInfoBtn');
        const editInfoPanel  = modal.querySelector('#editInfoPanel');
        const saveInfoBtn    = modal.querySelector('#saveInfoBtn');
        const cancelInfoBtn  = modal.querySelector('#cancelInfoBtn');

        const cat = (displayItem.category || '').toLowerCase();
        const creditKey = cat === 'books' ? 'author' : cat === 'tv' ? 'creator' : 'director';
        const creditLabel = modal.querySelector('#editCreditLabel');
        if (creditLabel) creditLabel.textContent = cat === 'books' ? 'Author' : cat === 'tv' ? 'Creator' : 'Director';

        editInfoBtn?.addEventListener('click', () => {
            const isHidden = editInfoPanel.classList.contains('hidden');
            editInfoPanel.classList.toggle('hidden');
            if (isHidden) {
                modal.querySelector('#editTitle').value       = displayItem.title || '';
                modal.querySelector('#editYear').value        = displayItem.year || '';
                modal.querySelector('#editGenre').value       = displayItem.genre || '';
                modal.querySelector('#editPoster').value      = displayItem.poster || displayItem.image || '';
                modal.querySelector('#editDescription').value = displayItem.description || '';
                modal.querySelector('#editCredit').value      = displayItem[creditKey] || '';
                modal.querySelector('#editActors').value      = displayItem.actors || '';
                editInfoBtn.innerHTML = '<i data-lucide="x" class="w-4 h-4"></i> Close Editor';
            } else {
                editInfoBtn.innerHTML = '<i data-lucide="pencil" class="w-4 h-4"></i> Edit Info';
            }
            lucide.createIcons();
        });

        saveInfoBtn?.addEventListener('click', async () => {
            const fields = {
                title:       modal.querySelector('#editTitle').value.trim(),
                year:        modal.querySelector('#editYear').value.trim(),
                genre:       modal.querySelector('#editGenre').value.trim(),
                poster:      modal.querySelector('#editPoster').value.trim(),
                description: modal.querySelector('#editDescription').value.trim(),
            };
            const creditVal = modal.querySelector('#editCredit').value.trim();
            if (creditVal) fields[creditKey] = creditVal;
            const actorsVal = modal.querySelector('#editActors').value.trim();
            if (actorsVal) fields.actors = actorsVal;

            const errEl = modal.querySelector('#editInfoError');
            errEl.classList.add('hidden');
            saveInfoBtn.textContent = 'Saving…';
            saveInfoBtn.disabled = true;
            try {
                await updateMediaOverride(mediaId, fields);
                // Merge into displayItem so re-opens reflect changes
                Object.assign(displayItem, fields);
                // Update visible modal elements
                modal.querySelector('#modalTitle').textContent = fields.title || '';
                modal.querySelector('#modalYear').innerHTML    = fields.year ? `<strong>Year:</strong> ${fields.year}` : '';
                modal.querySelector('#modalGenre').innerHTML   = fields.genre ? `<strong>Genre:</strong> ${fields.genre}` : '';
                modal.querySelector('#modalDescription').textContent = fields.description || '';
                if (fields.poster) modal.querySelector('#modalPoster').src = fields.poster;
                const creditEl = modal.querySelector('#modalCredit');
                if (creditEl) creditEl.innerHTML = fields[creditKey] ? `<strong>${creditLabel?.textContent || 'Credit'}:</strong> ${fields[creditKey]}` : '';
                const actorsEl = modal.querySelector('#modalActors');
                if (actorsEl) actorsEl.innerHTML = fields.actors ? `<strong>Cast:</strong> ${fields.actors}` : '';
                // Sync in-memory allItems so the grid reflects changes without reload
                const idx = allItems.findIndex(i => getMediaId(i) === mediaId);
                if (idx !== -1) Object.assign(allItems[idx], fields);
                // Update poster/title/genre on the visible grid card
                const gridCard = document.querySelector(`.media-card[data-id="${mediaId}"]`);
                if (gridCard) {
                    if (fields.poster) gridCard.querySelector('.card-image')?.setAttribute('src', fields.poster);
                    if (fields.title)  { const t = gridCard.querySelector('.card-title'); if (t) t.textContent = fields.title; }
                    const genreContainer = gridCard.querySelector('.pt-3');
                    if (genreContainer) {
                        const rawGenres = (fields.genre || '').split(',').map(g => g.trim()).filter(Boolean);
                        let newPillText = '';
                        if (cat === 'music') {
                            for (const g of rawGenres) { const n = normalizeMusicGenre(g); if (n) { newPillText = n; break; } }
                        } else if (cat === 'books') {
                            for (const g of rawGenres) { const n = normalizeBookGenre(g); if (n) { newPillText = n; break; } }
                        } else {
                            newPillText = rawGenres[0] || '';
                        }
                        genreContainer.innerHTML = newPillText
                            ? `<span class="px-2 py-0.5 bg-slate-700 rounded-full text-slate-300 text-xs">${newPillText}</span>`
                            : '';
                    }
                }
                editInfoPanel.classList.add('hidden');
                editInfoBtn.innerHTML = '<i data-lucide="pencil" class="w-4 h-4"></i> Edit Info';
                lucide.createIcons();
            } catch (e) {
                errEl.textContent = 'Save failed: ' + e.message;
                errEl.classList.remove('hidden');
            } finally {
                saveInfoBtn.textContent = 'Save Changes';
                saveInfoBtn.disabled = false;
            }
        });

        cancelInfoBtn?.addEventListener('click', () => {
            editInfoPanel.classList.add('hidden');
            editInfoBtn.innerHTML = '<i data-lucide="pencil" class="w-4 h-4"></i> Edit Info';
            lucide.createIcons();
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
        const containsSpoilers = modal.querySelector('#reviewSpoilers')?.checked ?? false;
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
                spoilers: containsSpoilers,
                timestamp: new Date().toISOString(),
                user: user.email || user.displayName || 'Anonymous'
            });

            // Invalidate caches so ratings and timestamps reflect the new review
            reviewTimestampCache = null;
            ratingBulkCache = null;
            sessionStorage.removeItem('reviewRatingCache');
            delete item.latestReviewTime;

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

    container.innerHTML = '';
    if (!items || items.length === 0) {
        const isMusicPending = !musicLoaded && currentFilter === 'music';
        container.innerHTML = isMusicPending
            ? '<div style="padding:32px;text-align:center;color:#888;">Loading music...</div>'
            : '<div style="padding:32px;text-align:center;color:#888;">No media items found.</div>';
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
        toShow.forEach(item => {
            const cat = (Array.isArray(item.category) ? item.category[0] : (item.category || '')).toLowerCase();
            const isMusic = cat === 'music';
            const reviewSnippet = item.reviewSnippet || (item.description ? item.description.split('.').slice(0, 1).join('.') : '');
            const cardId = item.id || (item.title ? item.title.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : '');
            // Use cached rating immediately; uncached items show placeholder until async fetch completes
            const avgRating = (item.liveAvgRating !== undefined && item.liveAvgRating !== -1)
                ? `★ ${item.liveAvgRating}`
                : item.liveAvgRating === -1
                    ? `<span class=\"text-slate-400 text-xs\">No reviews yet</span>`
                    : `<span class=\"text-slate-400 text-xs opacity-40\">★ —</span>`;

            // For music: find the primary normalized genre to display as a pill
            let topMusicGenre = '';
            if (isMusic) {
                for (const g of getMusicGenres(item)) {
                    const n = normalizeMusicGenre(g);
                    if (n) { topMusicGenre = n; break; }
                }
            }

            // For non-music: pick the first recognizable genre for the pill
            let primaryGenre = '';
            if (!isMusic) {
                const rawGenres = (item.genre || '').split(',').map(g => g.trim()).filter(Boolean);
                if (cat === 'books') {
                    for (const g of rawGenres) {
                        const n = normalizeBookGenre(g);
                        if (n) { primaryGenre = n; break; }
                    }
                } else {
                    primaryGenre = rawGenres[0] || '';
                }
            }

            const cardBody = isMusic ? `
                    <div class="flex justify-between items-start mb-1">
                        <h3 class="card-title text-lg font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-1">${item.title || ''}</h3>
                        <span class="text-xs text-slate-500 font-mono mt-1 ml-2 shrink-0">${item.year || ''}</span>
                    </div>
                    <p class="text-indigo-400 text-sm font-medium mb-3 line-clamp-1">${item.artist || ''}</p>
                    <div class="flex-1"></div>
                    <div class="pt-3 border-t border-slate-700 flex items-center justify-between">
                        ${topMusicGenre ? `<span class="px-2 py-0.5 bg-slate-700 rounded-full text-slate-300 text-xs">${topMusicGenre}</span>` : '<span></span>'}
                    </div>
            ` : `
                    <div class="flex justify-between items-start mb-1">
                        <h3 class="card-title text-lg font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-1">${item.title || ''}</h3>
                        <span class="text-xs text-slate-500 font-mono mt-1">${item.year || ''}</span>
                    </div>
                    <p class="text-slate-400 text-sm mb-3 flex-1 line-clamp-2">${reviewSnippet}</p>
                    <div class="pt-3 border-t border-slate-700 flex items-center justify-between">
                        ${primaryGenre ? `<span class="px-2 py-0.5 bg-slate-700 rounded-full text-slate-300 text-xs">${primaryGenre}</span>` : '<span></span>'}
                        ${cat === 'movies' ? `<div class="flex items-center gap-2"><span class="star-rating text-yellow-400 text-xs flex items-center gap-1 review-score-glow" id="rating-${cardId}">${avgRating}</span><span id="rt-${cardId}" class="text-xs text-slate-500 font-mono">${RT_ICON} —</span></div>` : ''}
                    </div>
            `;

            const imageHeight = isMusic ? 'h-56' : 'h-48';

            cardHTML += `
                <div class=\"media-card group bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-indigo-500/50 transition-all hover:shadow-xl hover:shadow-indigo-500/10 flex flex-col cursor-pointer\" data-id=\"${cardId}\">
                    <div class=\"relative ${imageHeight} overflow-hidden\">
                        <img class=\"card-image w-full h-full object-cover transform group-hover:scale-110 transition-duration-500 transition-transform\" src=\"${item.poster || item.image || ''}\" alt=\"${item.title || ''}\" onerror=\"handleImageError(this)\">
                        <div class=\"absolute top-2 right-2 px-2 py-1 rounded-md flex items-center gap-1\">
                            ${cat === 'movies'
                                ? `<span id="tr-${cardId}" class="text-xs font-mono text-slate-500">TR —</span>`
                                : `<span class="star-rating text-yellow-400 text-xs flex items-center gap-1 review-score-glow" id="rating-${cardId}">${avgRating}</span>`
                            }
                        </div>
                    </div>
                    <div class=\"p-5 flex-1 flex flex-col\">
                        ${cardBody}
                    </div>
                </div>
            `;
        });

        container.innerHTML = cardHTML;
        lucide.createIcons();

        // Fetch ratings for any uncached cards and patch them into the DOM without re-rendering
        const uncached = toShow.filter(i => i.liveAvgRating === undefined);
        if (uncached.length > 0) {
            fetchRatingsForItems(uncached).then(() => {
                uncached.forEach(item => {
                    const cId = item.id || (item.title ? item.title.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : '');
                    const el = document.getElementById(`rating-${cId}`);
                    if (!el) return;
                    if (item.liveAvgRating !== undefined && item.liveAvgRating !== -1) {
                        el.className = 'star-rating text-yellow-400 text-xs flex items-center gap-1 review-score-glow';
                        el.textContent = `★ ${item.liveAvgRating}`;
                    } else {
                        el.className = 'star-rating text-yellow-400 text-xs flex items-center gap-1 review-score-glow';
                        el.innerHTML = `<span class="text-slate-400 text-xs">No reviews yet</span>`;
                    }
                    updateTrueRated(item, cId);
                });
            });
        }

        // Fetch RT scores for movie cards and patch them into the DOM
        toShow.forEach(async item => {
            const iCat = (Array.isArray(item.category) ? item.category[0] : (item.category || '')).toLowerCase();
            if (iCat !== 'movies') return;
            const cId = item.id || (item.title ? item.title.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : '');
            const [score, tmdbScore] = await Promise.all([fetchRTScore(item), fetchTMDBScore(item)]);
            item.rtScore = score;
            item.tmdbScore = tmdbScore;
            const el = document.getElementById(`rt-${cId}`);
            if (el) {
                if (score) {
                    const pct = parseInt(score);
                    el.className = `text-xs font-mono ${pct >= 60 ? 'text-red-400' : 'text-yellow-500'}`;
                    el.innerHTML = `${RT_ICON} ${score}`;
                } else {
                    el.className = 'text-xs text-slate-600 font-mono';
                    el.innerHTML = `${RT_ICON} N/A`;
                }
            }
            updateTrueRated(item, cId);
        });

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

window.handleImageError = function(img) {
    img.onerror = null;
    img.style.display = 'none';
    const ph = document.createElement('div');
    ph.className = 'w-full h-full flex flex-col items-center justify-center bg-slate-700/50 text-slate-500 select-none';
    ph.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 mb-2 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
        <span class="text-xs font-medium tracking-wide">No Image</span>
    `;
    img.parentElement.appendChild(ph);
};

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
        case 'recent-desc':
            sorted.sort((a, b) => (b.latestReviewTime || 0) - (a.latestReviewTime || 0));
            break;
        case 'release-desc':
            sorted.sort((a, b) => {
                const aDate = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
                const bDate = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
                return bDate - aDate;
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

        const theatresRow = document.getElementById('inTheatresCheckboxRow');
        const theatresCb = document.getElementById('inTheatresSortCheckbox');
        if (theatresCb && theatresRow && !theatresRow.classList.contains('hidden')) {
            currentInTheatresFilter = theatresCb.checked;
            // Keep genre pill in sync
            const pill = document.getElementById('inTheatresMainBtn');
            if (pill) {
                const theatresActive = 'bg-emerald-600 text-white border-emerald-600 shadow-sm';
                const theatresInactive = 'bg-slate-800 text-emerald-400 border-emerald-700 hover:bg-slate-700';
                pill.className = `px-3 py-1 rounded-full text-xs whitespace-nowrap transition-all cursor-pointer border ${currentInTheatresFilter ? theatresActive : theatresInactive}`;
            }
        }

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
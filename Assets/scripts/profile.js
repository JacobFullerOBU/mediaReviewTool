import { getDatabase, ref, get, set, remove } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { app, auth } from './firebase.js';
import { fetchMovies, fetchTV, fetchBooks } from './main.js';
import { music } from "./music.js";
import { games } from "./games.js";

const mediaItemCache = {};
let statsCharts = [];

// ── Avatar helpers ────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
    '#3730a3','#0f766e','#6d28d9','#be185d',
    '#c2410c','#065f46','#0369a1','#a21caf',
];
function avatarBg(name) {
    return AVATAR_COLORS[(name || '?').trim().toUpperCase().charCodeAt(0) % AVATAR_COLORS.length];
}
function makeInitialEl(name, extraClasses, fontSize) {
    const div = document.createElement('div');
    div.className = `${extraClasses} rounded-full flex items-center justify-center flex-shrink-0`;
    div.style.cssText = `background:${avatarBg(name)};color:#fff;font-weight:700;font-size:${fontSize};line-height:1;`;
    div.textContent = (name || '?').trim().charAt(0).toUpperCase();
    return div;
}
function makeAvatarEl(name, photoUrl, extraClasses, fontSize) {
    if (!photoUrl) return makeInitialEl(name, extraClasses, fontSize);
    const img = document.createElement('img');
    img.className = `${extraClasses} rounded-full object-cover`;
    img.alt = name;
    img.src = photoUrl;
    img.onerror = () => img.replaceWith(makeInitialEl(name, extraClasses, fontSize));
    return img;
}
// Used by onerror on inline <img> elements inside innerHTML strings
window._avatarErr = function(img) {
    const div = makeInitialEl(img.dataset.name, img.dataset.cls, img.dataset.fs);
    img.replaceWith(div);
};

window.openMediaDetails = (mediaId) => {
    const mediaItem = mediaItemCache[mediaId];
    if (mediaItem && window.showItemDetails) {
        window.showItemDetails(mediaItem);
    } else {
        console.error('Media item not found or showItemDetails is not available.');
    }
};

function createFeedItem(review, reviewer, mediaItem, isOwner) {
    const item = document.createElement('div');
    item.className = 'bg-slate-800 rounded-lg p-6 border border-slate-700 flex flex-col sm:flex-row gap-6 relative group';
    item.dataset.category = review.mediaCategory || (mediaItem ? (mediaItem.category || 'unknown') : 'unknown');

    const mediaPoster = (mediaItem && (mediaItem.poster || mediaItem.image)) || '';
    const mediaTitle = mediaItem ? mediaItem.title : review.mediaTitle;
    const mediaId = `media-${review.id}`;
    const movieUrl = `movie.html?id=${encodeURIComponent(review.mediaId)}`;

    if (mediaItem) {
        mediaItemCache[mediaId] = mediaItem;
    }

    const editButton = isOwner ? `
        <button class="edit-review-btn absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100" data-review-id="${review.id}" data-media-id="${review.mediaId}">
            <i data-lucide="edit-2" class="w-4 h-4"></i>
        </button>
    ` : '';

    item.innerHTML = `
        ${editButton}
        <a href="${movieUrl}" class="w-24 mx-auto sm:mx-0 flex-shrink-0 block" onclick="if(window.showItemDetails){event.preventDefault();openMediaDetails('${mediaId}');}">
            <img src="${mediaPoster}" alt="${mediaTitle}" class="w-full h-auto rounded-md hover:opacity-80 transition-opacity" onerror="this.onerror=null;this.style.display='none'">
        </a>
        <div class="flex-grow text-center sm:text-left">
            <div class="flex items-center justify-center sm:justify-start gap-3 mb-2 flex-wrap">
                ${reviewer.avatar
                    ? `<img src="${reviewer.avatar}" alt="${reviewer.username}" class="w-8 h-8 rounded-full object-cover flex-shrink-0" data-name="${reviewer.username}" data-cls="w-8 h-8" data-fs="0.875rem" onerror="_avatarErr(this)">`
                    : `<div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style="background:${avatarBg(reviewer.username)};color:#fff;font-weight:700;font-size:0.875rem;line-height:1;">${(reviewer.username||'?').charAt(0).toUpperCase()}</div>`
                }
                <span class="font-semibold text-white">${reviewer.username}</span>
                <span class="text-xs text-slate-400">reviewed</span>
                <a href="${movieUrl}" class="font-semibold text-indigo-400 hover:text-indigo-300 break-all" onclick="if(window.showItemDetails){event.preventDefault();openMediaDetails('${mediaId}');}">
                    ${mediaTitle}
                </a>
            </div>
            <div class="flex items-center justify-center sm:justify-start gap-1 mb-3 text-yellow-400">
                <i data-lucide="star" class="w-4 h-4 fill-current"></i>
                <span class="font-bold">${review.rating}</span>
                <span class="text-xs text-slate-400 ml-1">/ 10</span>
            </div>
            <div class="review-body break-words">${review.reviewText}</div>
            <p class="text-xs text-slate-500 mt-4">${new Date(review.timestamp).toLocaleString()}</p>
        </div>
    `;

    return item;
}

function createWatchlistItem(item) {
    const listItem = document.createElement('div');
    listItem.className = 'flex items-center gap-4 p-2 rounded-lg hover:bg-slate-700/50 transition-colors cursor-pointer';
    listItem.dataset.category = item.category || 'unknown';

    const poster = item.poster || item.image || 'https://via.placeholder.com/100x150.png?text=No+Image';
    
    listItem.innerHTML = `
        <div class="w-12 flex-shrink-0">
            <img src="${poster}" alt="${item.title}" class="w-full h-auto rounded-md">
        </div>
        <div class="flex-grow">
            <h4 class="text-white font-semibold break-all">${item.title}</h4>
            <p class="text-slate-400 text-sm">${item.year || 'N/A'}</p>
        </div>
    `;

    listItem.onclick = () => {
        if (window.showItemDetails) {
            window.showItemDetails(item);
        } else {
            console.warn('showItemDetails function not found. Ensure cards.js is loaded.');
        }
    };
    
    return listItem;
}

// ── Favorites ────────────────────────────────────────────────────────────────

function renderFavoritesSection(favData, allMedia, mediaMap, isOwner, db, reviewerId) {
    // reviewer-profile.html uses #favoritesSection (renders heading + grid)
    // userprofile.html uses #userFavorites (heading already in HTML, render grid only)
    const fullContainer = document.getElementById('favoritesSection');
    const inlineContainer = document.getElementById('userFavorites');
    if (!fullContainer && !inlineContainer) return;

    const gridHTML = `
        <div class="grid grid-cols-5 gap-4" id="favoriteSlots"></div>
    `;

    if (fullContainer) {
        fullContainer.innerHTML = `
            <h3 class="text-xl font-bold text-white mb-4">Top 5 Favorites</h3>
            ${gridHTML}
        `;
    } else {
        inlineContainer.innerHTML = gridHTML;
    }

    const slotsEl = document.getElementById('favoriteSlots');
    for (let i = 0; i < 5; i++) {
        const mediaId = favData[i] || null;
        const mediaItem = mediaId ? (mediaMap[mediaId] || null) : null;
        slotsEl.appendChild(buildFavoriteSlot(mediaItem, i, isOwner, allMedia, db, reviewerId, mediaMap));
    }
    if (window.lucide) lucide.createIcons();
}

function buildFavoriteSlot(mediaItem, index, isOwner, allMedia, db, reviewerId, mediaMap) {
    const wrapper = document.createElement('div');
    wrapper.dataset.slotIndex = index;

    if (mediaItem) {
        const poster = mediaItem.poster || mediaItem.image || '';
        wrapper.className = 'relative group cursor-default';
        wrapper.innerHTML = `
            <img src="${poster}" alt="${mediaItem.title}"
                 class="w-full aspect-[2/3] object-cover rounded-xl border border-slate-700 shadow-lg">
            <div class="absolute inset-0 rounded-xl bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <span class="text-white text-sm font-semibold line-clamp-2 leading-tight">${mediaItem.title}</span>
            </div>
            ${isOwner ? `<button class="slot-clear-btn absolute top-2 right-2 w-6 h-6 bg-black/70 hover:bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">✕</button>` : ''}
        `;
        if (isOwner) {
            wrapper.querySelector('.slot-clear-btn').addEventListener('click', async () => {
                await remove(ref(db, `favorites/${reviewerId}/${index}`));
                wrapper.replaceWith(buildFavoriteSlot(null, index, isOwner, allMedia, db, reviewerId, mediaMap));
                if (window.lucide) lucide.createIcons();
            });
        }
    } else if (isOwner) {
        wrapper.innerHTML = `
            <button class="slot-add-btn w-full aspect-[2/3] rounded-xl border-2 border-dashed border-slate-600 hover:border-indigo-500 hover:bg-indigo-500/5 flex flex-col items-center justify-center gap-2 transition-colors">
                <i data-lucide="plus" class="w-8 h-8 text-slate-500"></i>
                <span class="text-slate-500 text-sm font-medium">Add</span>
            </button>
        `;
        wrapper.querySelector('.slot-add-btn').addEventListener('click', () => {
            openFavoriteSearch(wrapper, index, isOwner, allMedia, db, reviewerId, mediaMap);
        });
    } else {
        wrapper.innerHTML = `<div class="w-full aspect-[2/3] rounded-xl border border-dashed border-slate-700/40 bg-slate-800/30"></div>`;
    }

    return wrapper;
}

function openFavoriteSearch(wrapper, index, isOwner, allMedia, db, reviewerId, mediaMap) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm';
    overlay.innerHTML = `
        <div class="bg-slate-800 rounded-xl w-full max-w-sm shadow-2xl border border-slate-700">
            <div class="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-700">
                <h4 class="text-white font-semibold text-sm">Add to Favorites</h4>
                <button class="close-btn text-slate-400 hover:text-white text-xl leading-none">&times;</button>
            </div>
            <div class="p-4">
                <input type="text"
                    class="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 placeholder-slate-500"
                    placeholder="Search for a title…"
                    autocomplete="off"
                >
                <div class="search-results mt-3 space-y-1 max-h-64 overflow-y-auto"></div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    const input = overlay.querySelector('input');
    const resultsList = overlay.querySelector('.search-results');
    input.focus();

    function close() {
        overlay.remove();
    }

    overlay.querySelector('.close-btn').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); }
    });

    input.addEventListener('input', () => {
        const term = input.value.trim().toLowerCase();
        resultsList.innerHTML = '';
        if (term.length < 2) return;

        allMedia
            .filter(item => item.title && item.title.toLowerCase().includes(term))
            .slice(0, 8)
            .forEach(item => {
                const poster = item.poster || item.image || '';
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-slate-200 hover:bg-indigo-600 rounded-lg transition-colors';
                btn.innerHTML = poster
                    ? `<img src="${poster}" class="w-8 h-11 object-cover rounded flex-shrink-0"><span class="truncate">${item.title}</span>`
                    : `<span class="truncate">${item.title}</span>`;
                btn.addEventListener('click', async () => {
                    const titleSlug = item.title.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                    const cat = Array.isArray(item.category) ? item.category[0] : (item.category || '');
                    const catSlug = cat.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                    const mediaId = catSlug ? `${catSlug}_${titleSlug}` : titleSlug;
                    await set(ref(db, `favorites/${reviewerId}/${index}`), mediaId);
                    wrapper.replaceWith(buildFavoriteSlot(item, index, isOwner, allMedia, db, reviewerId, mediaMap));
                    if (window.lucide) lucide.createIcons();
                    close();
                });
                resultsList.appendChild(btn);
            });
    });
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function renderStats(reviews, mediaMap) {
    const container = document.getElementById('profileStats');
    if (!container) return;
    if (reviews.length === 0) { container.classList.add('hidden'); return; }

    statsCharts.forEach(c => c.destroy());
    statsCharts = [];

    const total = reviews.length;
    const avgRating = reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / total;

    // ── Data prep ──────────────────────────────────────────────────

    // Rating distribution (1–10, displayed as ★0.5–★5)
    const dist = Array(10).fill(0);
    for (const r of reviews) {
        const idx = Math.round(r.rating || 0) - 1;
        if (idx >= 0 && idx < 10) dist[idx]++;
    }

    // Films by decade + avg rating by decade
    const decadeCount = {};
    const decadeRatingAcc = {};
    for (const r of reviews) {
        const yr = parseInt(r.mediaYear);
        if (isNaN(yr) || yr < 1888) continue;
        const decade = Math.floor(yr / 10) * 10;
        decadeCount[decade] = (decadeCount[decade] || 0) + 1;
        if (!decadeRatingAcc[decade]) decadeRatingAcc[decade] = { sum: 0, count: 0 };
        decadeRatingAcc[decade].sum += r.rating || 0;
        decadeRatingAcc[decade].count++;
    }
    const decades = Object.keys(decadeCount).map(Number).sort((a, b) => a - b);
    const decadeLabels   = decades.map(d => `${d}s`);
    const decadeCounts   = decades.map(d => decadeCount[d]);
    const decadeAvgs     = decades.map(d => {
        const acc = decadeRatingAcc[d];
        return acc ? parseFloat((acc.sum / acc.count).toFixed(2)) : 0;
    });

    // Scatter: release year vs rating
    const scatterPts = reviews
        .filter(r => r.mediaYear && !isNaN(parseInt(r.mediaYear)))
        .map(r => ({ x: parseInt(r.mediaYear), y: r.rating || 0, title: r.mediaTitle || '' }));

    // Logging activity by date
    const dateCount = {};
    for (const r of reviews) {
        if (!r.timestamp) continue;
        const d = r.timestamp.split('T')[0];
        dateCount[d] = (dateCount[d] || 0) + 1;
    }
    const activityDates  = Object.keys(dateCount).sort();
    const activityCounts = activityDates.map(d => dateCount[d]);

    // Cumulative films over time
    const sorted = reviews.filter(r => r.timestamp).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const cumulLabels = [];
    const cumulData   = [];
    let running = 0;
    for (const r of sorted) {
        running++;
        cumulLabels.push(r.timestamp.split('T')[0]);
        cumulData.push(running);
    }

    // 10/10 club
    const tenClub = reviews
        .filter(r => r.rating === 10)
        .sort((a, b) => (a.mediaTitle || '').localeCompare(b.mediaTitle || ''));

    // Per-category breakdown
    const catMap = {};
    for (const r of reviews) {
        const cat = r.mediaCategory || 'unknown';
        if (cat === 'unknown') continue;
        if (!catMap[cat]) catMap[cat] = { count: 0, sum: 0 };
        catMap[cat].count++;
        catMap[cat].sum += r.rating || 0;
    }
    const catMeta = {
        movies: { label: 'Movies', icon: 'film' },
        tv:     { label: 'TV Shows', icon: 'monitor' },
        music:  { label: 'Music', icon: 'music' },
        games:  { label: 'Games', icon: 'gamepad-2' },
        books:  { label: 'Books', icon: 'book-open' },
    };
    const catHTML = Object.entries(catMap)
        .sort((a, b) => b[1].count - a[1].count)
        .map(([cat, { count, sum }]) => {
            const meta = catMeta[cat] || { label: cat, icon: 'layers' };
            const avg = (sum / count).toFixed(1);
            return `
                <div class="flex items-center gap-3 bg-slate-700/40 rounded-lg px-4 py-3">
                    <i data-lucide="${meta.icon}" class="w-5 h-5 text-indigo-400 flex-shrink-0"></i>
                    <div>
                        <div class="text-white font-semibold text-sm">${meta.label}</div>
                        <div class="text-slate-400 text-xs">${count} review${count !== 1 ? 's' : ''} &middot; avg <span class="text-yellow-400">${avg}</span></div>
                    </div>
                </div>`;
        }).join('');

    // 10/10 club HTML (poster grid)
    const tenClubHTML = tenClub.map(r => {
        const media = mediaMap?.[r.mediaId] || null;
        const poster = media?.poster || media?.image || '';
        const yr = r.mediaYear || '';
        if (poster) {
            return `<div class="relative group cursor-default">
                <img src="${poster}" alt="${r.mediaTitle}" class="w-full aspect-[2/3] object-cover rounded-lg border border-slate-600">
                <div class="absolute inset-0 rounded-lg bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span class="text-white text-xs font-semibold leading-tight">${r.mediaTitle}${yr ? ` (${yr})` : ''}</span>
                </div>
            </div>`;
        }
        return `<div class="bg-slate-700/50 rounded-lg p-3 flex flex-col justify-center items-center text-center border border-slate-600 aspect-[2/3]">
            <span class="text-white text-xs font-semibold leading-snug">${r.mediaTitle}</span>
            ${yr ? `<span class="text-slate-400 text-xs mt-1">${yr}</span>` : ''}
        </div>`;
    }).join('');

    // ── Render HTML ────────────────────────────────────────────────
    container.innerHTML = `
        <h3 class="text-xl font-bold text-white mb-5">Stats</h3>

        <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
            <div class="bg-slate-700/40 rounded-lg p-4 text-center">
                <div class="text-3xl font-bold text-white">${total}</div>
                <div class="text-slate-400 text-sm mt-1">Total Reviews</div>
            </div>
            <div class="bg-slate-700/40 rounded-lg p-4 text-center">
                <div class="text-3xl font-bold text-yellow-400">${avgRating.toFixed(1)}</div>
                <div class="text-slate-400 text-sm mt-1">Average Rating</div>
            </div>
            <div class="bg-slate-700/40 rounded-lg p-4 text-center col-span-2 sm:col-span-1">
                <div class="text-3xl font-bold text-indigo-400">${tenClub.length}</div>
                <div class="text-slate-400 text-sm mt-1">Perfect 10s</div>
            </div>
        </div>

        <div class="mb-8">
            <div class="text-sm font-medium text-slate-400 mb-3">Rating Distribution</div>
            <div style="position:relative;height:140px"><canvas id="statsDistChart"></canvas></div>
        </div>

        ${decades.length > 0 ? `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            <div>
                <div class="text-sm font-medium text-slate-400 mb-3">Films by Decade</div>
                <div style="position:relative;height:180px"><canvas id="statsDecadeCountChart"></canvas></div>
            </div>
            <div>
                <div class="text-sm font-medium text-slate-400 mb-3">Average Rating by Decade</div>
                <div style="position:relative;height:180px"><canvas id="statsDecadeRatingChart"></canvas></div>
            </div>
        </div>` : ''}

        ${scatterPts.length > 0 ? `
        <div class="mb-8">
            <div class="text-sm font-medium text-slate-400 mb-3">Rating vs. Release Year</div>
            <div style="position:relative;height:220px"><canvas id="statsScatterChart"></canvas></div>
        </div>` : ''}

        ${activityDates.length > 1 ? `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            <div>
                <div class="text-sm font-medium text-slate-400 mb-3">Logging Activity</div>
                <div style="position:relative;height:160px"><canvas id="statsActivityChart"></canvas></div>
            </div>
            <div>
                <div class="text-sm font-medium text-slate-400 mb-3">Cumulative Films Logged</div>
                <div style="position:relative;height:160px"><canvas id="statsCumulChart"></canvas></div>
            </div>
        </div>` : ''}

        ${tenClub.length > 0 ? `
        <div class="mb-8">
            <div class="text-sm font-medium text-slate-400 mb-3">10/10 Club <span class="text-slate-500">(${tenClub.length})</span></div>
            <div class="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2">${tenClubHTML}</div>
        </div>` : ''}

        ${catHTML ? `
        <div>
            <div class="text-sm font-medium text-slate-400 mb-3">By Category</div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">${catHTML}</div>
        </div>` : ''}
    `;

    container.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();

    // ── Init Chart.js ──────────────────────────────────────────────
    if (typeof Chart === 'undefined') return;

    const gridColor  = '#1e293b';
    const tickColor  = '#64748b';
    const baseScales = {
        x: { grid: { color: gridColor }, ticks: { color: tickColor } },
        y: { grid: { color: gridColor }, ticks: { color: tickColor } },
    };

    function mkBar(id, labels, data, color, yOverride) {
        const el = document.getElementById(id);
        if (!el) return;
        statsCharts.push(new Chart(el, {
            type: 'bar',
            data: {
                labels,
                datasets: [{ data, backgroundColor: color, borderRadius: 3, borderSkipped: false }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: baseScales.x,
                    y: { ...baseScales.y, ...(yOverride || {}) },
                },
            },
        }));
    }

    // Rating distribution (Letterboxd star labels)
    mkBar('statsDistChart',
        ['★½','★1','★1½','★2','★2½','★3','★3½','★4','★4½','★5'],
        dist, '#6366f1');

    // Films by decade
    mkBar('statsDecadeCountChart', decadeLabels, decadeCounts, '#0ea5e9');

    // Avg rating by decade
    mkBar('statsDecadeRatingChart', decadeLabels, decadeAvgs, '#f59e0b',
        { min: 0, max: 10, ticks: { color: tickColor, stepSize: 2 } });

    // Scatter: rating vs year
    const scEl = document.getElementById('statsScatterChart');
    if (scEl) {
        statsCharts.push(new Chart(scEl, {
            type: 'scatter',
            data: {
                datasets: [{
                    data: scatterPts,
                    backgroundColor: 'rgba(99,102,241,0.55)',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.raw.title} (${ctx.raw.x}) — ${ctx.raw.y}/10`,
                        },
                    },
                },
                scales: {
                    x: { ...baseScales.x, title: { display: true, text: 'Release Year', color: tickColor } },
                    y: { ...baseScales.y, min: 1, max: 10, title: { display: true, text: 'Rating', color: tickColor } },
                },
            },
        }));
    }

    // Logging activity
    mkBar('statsActivityChart', activityDates, activityCounts, '#10b981',
        undefined);

    // Cumulative
    const cumEl = document.getElementById('statsCumulChart');
    if (cumEl) {
        statsCharts.push(new Chart(cumEl, {
            type: 'line',
            data: {
                labels: cumulLabels,
                datasets: [{
                    data: cumulData,
                    borderColor: '#818cf8',
                    backgroundColor: 'rgba(129,140,248,0.12)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ...baseScales.x, ticks: { color: tickColor, maxTicksLimit: 6, maxRotation: 45 } },
                    y: { ...baseScales.y },
                },
            },
        }));
    }
}

// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Content Loaded, starting script.");
    lucide.createIcons();

    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    const params = new URLSearchParams(window.location.search);
    const urlReviewerId = params.get('id');
    console.log("Reviewer ID from URL:", urlReviewerId);

    if (urlReviewerId) {
        loadProfile(urlReviewerId);
    } else {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                loadProfile(user.uid);
            } else {
                const container = document.getElementById('profile-container');
                if (container) {
                    container.innerHTML = '<p class="text-center text-red-500">Reviewer ID not provided and you are not logged in.</p>';
                }
            }
        });
    }
});

async function loadProfile(reviewerId) {
    const db = getDatabase(app);
    const reviewerRef = ref(db, 'reviewers/' + reviewerId);
    
    try {
        console.log("Fetching reviewer data from Firebase...");
        const snapshot = await get(reviewerRef);
        let reviewerData = snapshot.val();

        if (!snapshot.exists()) {
            // Fallback: If viewing own profile but data is missing, create default data
            const currentUser = auth.currentUser;
            if (currentUser && currentUser.uid === reviewerId) {
                console.log("Profile missing in DB, creating default...");
                reviewerData = {
                    name: currentUser.displayName || currentUser.email.split('@')[0],
                    email: currentUser.email,
                    bio: "Welcome to my profile!",
                    createdAt: new Date().toISOString()
                };
                await set(reviewerRef, reviewerData);
            } else {
                document.getElementById('profile-container').innerHTML = '<p class="text-center text-red-500">Reviewer not found.</p>';
                return;
            }
        }

        console.log("Reviewer Data:", reviewerData);

        const reviewerForFeed = {
            id: reviewerId,
            username: reviewerData.name,
            avatar: reviewerData.avatar,
            bio: reviewerData.bio,
            following: [],
            followers: 0
        };

        console.log("Populating profile info...");
        const profileAvatarSlot = document.getElementById('profileAvatar');
        if (profileAvatarSlot) {
            const avatarEl = makeAvatarEl(reviewerData.name, reviewerData.avatar, 'w-32 h-32', '2.5rem');
            avatarEl.classList.add('border-4', 'border-slate-700');
            profileAvatarSlot.replaceWith(avatarEl);
        }
        
        // For reviewer-profile.html
        const profileName = document.getElementById('profileName');
        if (profileName) profileName.textContent = reviewerData.name;
        
        const profileBio = document.getElementById('profileBio');
        if (profileBio) profileBio.textContent = reviewerData.bio || 'No bio provided.';
        
        // For userprofile.html
        const profileTitle = document.getElementById('profileTitle');
        if (profileTitle && auth.currentUser && auth.currentUser.uid === reviewerId) {
            profileTitle.textContent = `${reviewerData.name}'s Profile`;
        }

        const profileInfoContainer = document.getElementById('profileInfo');
        if (profileInfoContainer) {
            const joinDate = reviewerData.createdAt ? new Date(reviewerData.createdAt).toLocaleDateString() : 'Unknown';
            profileInfoContainer.innerHTML = `
                <p class="text-sm"><strong>Bio:</strong> ${reviewerData.bio || 'No bio provided.'}</p>
                <p class="text-sm mt-1"><strong>Favorite Genres:</strong> ${reviewerData.genres || 'N/A'}</p>
                <p class="text-xs text-slate-500 mt-2">Joined: ${joinDate}</p>
            `;
        }

        console.log("Fetching media...");
        const [movies, tvData, booksData] = await Promise.all([fetchMovies(), fetchTV(), fetchBooks()]);
        const allMedia = [...movies, ...tvData, ...music, ...games, ...booksData].filter(item => item && item.title);
        console.log("Total media items:", allMedia.length);
        
        let allReviews = [];
        console.log("Fetching all reviews...");
        
        // Create a map for faster media lookup.
        // Index by both the plain title slug AND the category-prefixed slug (e.g. "movies_the_dark_knight")
        // because cards.js saves Firebase review keys in the category-prefixed format via getMediaId().
        const mediaMap = {};
        allMedia.forEach(media => {
            if (media.id != null) {
                mediaMap[media.id] = media;
            }
            if (media.title) {
                const titleSlug = media.title.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                mediaMap[titleSlug] = media;
                const cat = Array.isArray(media.category) ? media.category[0] : (media.category || '');
                const catSlug = cat.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                if (catSlug) {
                    mediaMap[`${catSlug}_${titleSlug}`] = media;
                }
            }
        });

        const reviewsRef = ref(db, 'reviews');
        const reviewsSnapshot = await get(reviewsRef);

        if (reviewsSnapshot.exists()) {
            const reviewsData = reviewsSnapshot.val();
            Object.entries(reviewsData).forEach(([mediaId, reviews]) => {
                Object.entries(reviews).forEach(([reviewId, review]) => {
                    if (review.userId === reviewerId) {
                        const mediaItem = mediaMap[mediaId];
                        allReviews.push({
                            ...review,
                            id: reviewId,
                            mediaId: mediaId,
                            mediaTitle: mediaItem ? mediaItem.title : mediaId.replace(/_/g, ' '),
                            mediaCategory: mediaItem ? (mediaItem.category || 'unknown') : 'unknown'
                        });
                    }
                });
            });
        }
        console.log("Found reviews for this user:", allReviews.length);

        renderStats(allReviews, mediaMap);

        const isOwner = auth.currentUser && auth.currentUser.uid === reviewerId;

        // Render favorites section (non-fatal if rules block read)
        let favData = {};
        try {
            const favSnap = await get(ref(db, `favorites/${reviewerId}`));
            if (favSnap.exists()) favData = favSnap.val();
        } catch (e) {
            console.warn('Favorites read blocked — check Firebase rules:', e.message);
        }
        renderFavoritesSection(favData, allMedia, mediaMap, isOwner, db, reviewerId);

        const userReviewsContainer = document.getElementById('userReviews');
        if (allReviews.length > 0) {
            userReviewsContainer.innerHTML = '';
            allReviews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            allReviews.forEach(review => {
                const mediaItem = mediaMap[review.mediaId] || null;
                const feedItem = createFeedItem(review, reviewerForFeed, mediaItem, isOwner);
                userReviewsContainer.appendChild(feedItem);
            });
        } else {
            userReviewsContainer.innerHTML = '<p class="text-slate-500 text-center">This reviewer has not posted any reviews yet.</p>';
        }

        // Fetch and Render Watchlist
        console.log("Fetching watchlist...");
        const watchlistContainer = document.getElementById('userWatchlist');
        if (watchlistContainer) {
            const watchlistRef = ref(db, `watchlist/${reviewerId}`);
            const watchlistSnapshot = await get(watchlistRef);
            
            if (watchlistSnapshot.exists()) {
                const watchlistData = watchlistSnapshot.val();
                const watchlistItems = [];
                
                Object.keys(watchlistData).forEach(mediaKey => {
                    const mediaItem = mediaMap[mediaKey];
                    if (mediaItem) {
                        watchlistItems.push(mediaItem);
                    }
                });

                watchlistContainer.innerHTML = '';
                if (watchlistItems.length > 0) {
                    watchlistContainer.className = 'space-y-2';
                    watchlistItems.forEach(item => {
                        watchlistContainer.appendChild(createWatchlistItem(item));
                    });
                } else {
                    watchlistContainer.innerHTML = '<p class="text-slate-500 text-center col-span-full">Watchlist is empty.</p>';
                }
            } else {
                watchlistContainer.innerHTML = '<p class="text-slate-500 text-center col-span-full">Watchlist is empty.</p>';
            }
        }

    } catch (error) {
        console.error("An error occurred:", error);
        const container = document.getElementById('profile-container');
        if (container) {
            container.innerHTML = `<p class="text-center text-red-500">An error occurred while loading the profile: ${error.message}</p>`;
        }
    }

    lucide.createIcons();
}
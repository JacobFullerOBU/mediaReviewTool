// fetchTMDBReleaseDates.cjs
// Phase 1: Match movies from TMDB's now_playing list (fast, exact titles).
// Phase 2: Search TMDB individually for any remaining inTheatres movies without a date.
// Safe to re-run — skips movies that already have a releaseDate.

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const API_KEY = 'f50a7cd62fa00a24f29a0e3ebb12c130';
const BASE = 'https://api.themoviedb.org/3';
const MOVIE_LIST = path.join(__dirname, '../../Assets/Data/movieList.json');
const DELAY = 260; // ms — stays well under TMDB's 40 req/10s limit

const http = axios.create({ baseURL: BASE, params: { api_key: API_KEY, language: 'en-US' } });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function norm(title) {
    return (title || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

async function fetchNowPlaying() {
    const all = [];
    let page = 1, total = 1;
    do {
        const { data } = await http.get('/movie/now_playing', { params: { page } });
        all.push(...data.results);
        total = data.total_pages;
        page++;
        if (page <= total) await sleep(DELAY);
    } while (page <= total);
    return all;
}

async function searchTitle(title) {
    const { data } = await http.get('/search/movie', { params: { query: title } });
    return data.results || [];
}

async function main() {
    const movies = JSON.parse(fs.readFileSync(MOVIE_LIST, 'utf-8'));
    const targets = movies.filter(m => m.inTheatres === true && !m.releaseDate);
    console.log(`${targets.length} in-theatres movies need a release date.\n`);

    // ── Phase 1: bulk match from now_playing ─────────────────────────────────
    console.log('Phase 1 — fetching TMDB now_playing...');
    const nowPlaying = await fetchNowPlaying();
    console.log(`  ${nowPlaying.length} movies returned from TMDB now_playing.\n`);

    const tmdbByNorm = new Map();
    for (const m of nowPlaying) {
        tmdbByNorm.set(norm(m.title), m);
        if (m.original_title) tmdbByNorm.set(norm(m.original_title), m);
    }

    let phase1 = 0;
    const needsSearch = [];

    for (const movie of targets) {
        const hit = tmdbByNorm.get(norm(movie.title));
        if (hit?.release_date) {
            const entry = movies.find(m => m === movie);
            entry.releaseDate = hit.release_date;
            phase1++;
        } else {
            needsSearch.push(movie);
        }
    }
    console.log(`Phase 1 matched ${phase1} movies.\n`);

    // ── Phase 2: individual search for remainder ──────────────────────────────
    console.log(`Phase 2 — searching TMDB for ${needsSearch.length} remaining movies...`);
    let phase2 = 0;
    const notFound = [];

    for (let i = 0; i < needsSearch.length; i++) {
        const movie = needsSearch[i];
        process.stdout.write(`  [${i + 1}/${needsSearch.length}] ${movie.title} ... `);

        try {
            const results = await searchTitle(movie.title);
            // Prefer 2026 release, then 2025, then whatever TMDB returns first
            const match =
                results.find(r => r.release_date?.startsWith('2026')) ||
                results.find(r => r.release_date?.startsWith('2025')) ||
                results.find(r => r.release_date);

            if (match?.release_date) {
                movie.releaseDate = match.release_date;
                phase2++;
                console.log(match.release_date);
            } else {
                console.log('not found');
                notFound.push(movie.title);
            }
        } catch (err) {
            console.log(`error: ${err.message}`);
            notFound.push(movie.title);
        }

        if ((i + 1) % 50 === 0) {
            fs.writeFileSync(MOVIE_LIST, JSON.stringify(movies, null, 4));
            process.stdout.write('  [saved]\n');
        }

        await sleep(DELAY);
    }

    fs.writeFileSync(MOVIE_LIST, JSON.stringify(movies, null, 4));

    const total = phase1 + phase2;
    console.log(`\n✓ Done. Updated ${total} / ${targets.length} movies.`);
    console.log(`  Phase 1 (now_playing match): ${phase1}`);
    console.log(`  Phase 2 (title search):      ${phase2}`);
    if (notFound.length) {
        console.log(`\n  No date found for ${notFound.length} movies:`);
        notFound.forEach(t => console.log(`    - ${t}`));
    }
}

main().catch(console.error);

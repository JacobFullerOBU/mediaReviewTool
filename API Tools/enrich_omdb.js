// enrich_omdb.js
// Adds imdbRating and rottenTomatoes fields to movieList.json via OMDb API.
// Safe to run multiple times — already-enriched entries are skipped.
// Free tier cap: 1,000 requests/day. Run daily until all movies are covered.

const fs = require('fs');
const axios = require('axios');

const OMDB_API_KEY = 'a24ffa83';
const MOVIE_LIST_PATH = '../Assets/Movies/movieList.json';
const DAILY_LIMIT = 950; // Stay under 1,000 with a small buffer
const REQUEST_DELAY_MS = 200; // 5 req/sec — well within OMDb limits

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchOmdbData(title, year) {
    const base = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(title)}`;

    // Try with year first for precision, fall back to title-only if not found
    if (year) {
        const res = await axios.get(`${base}&y=${year}`, { timeout: 8000 });
        if (res.data.Response !== 'False') return res.data;
    }

    const res = await axios.get(base, { timeout: 8000 });
    return res.data;
}

function extractScores(omdbData) {
    if (!omdbData || omdbData.Response === 'False') return null;

    const scores = {
        imdbRating: omdbData.imdbRating !== 'N/A' ? omdbData.imdbRating : null,
        rottenTomatoes: null,
        metacritic: null,
    };

    if (Array.isArray(omdbData.Ratings)) {
        for (const r of omdbData.Ratings) {
            if (r.Source === 'Rotten Tomatoes') scores.rottenTomatoes = r.Value;
            if (r.Source === 'Metacritic') scores.metacritic = r.Value.replace('/100', '');
        }
    }

    return scores;
}

async function main() {
    const movies = JSON.parse(fs.readFileSync(MOVIE_LIST_PATH, 'utf-8'));

    const unenriched = movies.filter(m => m.imdbRating === undefined);
    console.log(`Total movies: ${movies.length}`);
    console.log(`Already enriched: ${movies.length - unenriched.length}`);
    console.log(`Remaining: ${unenriched.length}`);

    const toProcess = unenriched.slice(0, DAILY_LIMIT);
    console.log(`Processing ${toProcess.length} movies this run...\n`);

    let successCount = 0;
    let notFoundCount = 0;

    for (const movie of toProcess) {
        try {
            const data = await fetchOmdbData(movie.title, movie.year);
            const scores = extractScores(data);

            if (scores) {
                movie.imdbRating = scores.imdbRating;
                movie.rottenTomatoes = scores.rottenTomatoes;
                movie.metacritic = scores.metacritic;
                successCount++;
                console.log(`✓ ${movie.title} (${movie.year}) — IMDB: ${scores.imdbRating}, RT: ${scores.rottenTomatoes}`);
            } else {
                // Mark as attempted so we don't retry on future runs
                movie.imdbRating = null;
                movie.rottenTomatoes = null;
                movie.metacritic = null;
                notFoundCount++;
                console.log(`✗ Not found: ${movie.title} (${movie.year})`);
            }
        } catch (err) {
            console.error(`  Error for "${movie.title}": ${err.message}`);
            // Don't mark — leave unenriched so it retries next run
        }

        await sleep(REQUEST_DELAY_MS);
    }

    fs.writeFileSync(MOVIE_LIST_PATH, JSON.stringify(movies, null, 4));

    console.log(`\nDone. Found: ${successCount}, Not found: ${notFoundCount}`);
    console.log(`Remaining unenriched: ${movies.filter(m => m.imdbRating === undefined).length}`);
    console.log('movieList.json updated.');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});

import { readFileSync, writeFileSync } from 'fs';
import fetch from 'node-fetch';

const TMDB_KEY = 'f50a7cd62fa00a24f29a0e3ebb12c130';
const FILE     = './Assets/Data/movieList.json';
const DELAY_MS = 60; // ~16 req/s — comfortably under TMDB's 40 req/s limit

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function searchTMDB(title, year) {
    const params = new URLSearchParams({ api_key: TMDB_KEY, query: title, language: 'en-US' });
    if (year) params.set('year', year);
    const res  = await fetch(`https://api.themoviedb.org/3/search/movie?${params}`);
    const data = await res.json();
    return data.results?.[0]?.id ?? null;
}

async function fetchCast(tmdbId) {
    const res  = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_KEY}&append_to_response=credits&language=en-US`);
    const data = await res.json();
    return data.credits?.cast?.slice(0, 5).map(a => a.name) ?? [];
}

async function main() {
    const movies  = JSON.parse(readFileSync(FILE, 'utf8'));
    const missing = movies.filter(m => !m.actors).length;

    console.log(`Found ${missing} movies missing actors out of ${movies.length} total.\n`);

    let updated = 0, notFound = 0, errors = 0;

    for (let i = 0; i < movies.length; i++) {
        const movie = movies[i];
        if (movie.actors) continue;

        const label = `${movie.title} (${movie.year || '?'})`;

        try {
            const tmdbId = await searchTMDB(movie.title?.trim(), movie.year);
            await sleep(DELAY_MS);

            if (!tmdbId) {
                console.log(`  [NOT FOUND] ${label}`);
                notFound++;
                continue;
            }

            const cast = await fetchCast(tmdbId);
            await sleep(DELAY_MS);

            if (cast.length) {
                movies[i].actors = cast.join('\n');
                updated++;
                const pct = ((updated + notFound + errors) / missing * 100).toFixed(1);
                console.log(`  [${pct}%] ✓ ${label} → ${cast.join(', ')}`);
            } else {
                console.log(`  [NO CAST] ${label}`);
                notFound++;
            }
        } catch (err) {
            console.error(`  [ERROR] ${label}: ${err.message}`);
            errors++;
            await sleep(1000); // back off on errors
        }

        // Save progress every 100 updates so a crash doesn't lose everything
        if ((updated + notFound + errors) % 100 === 0) {
            writeFileSync(FILE, JSON.stringify(movies, null, 4));
            console.log(`  --- Progress saved (${updated} updated so far) ---\n`);
        }
    }

    writeFileSync(FILE, JSON.stringify(movies, null, 4));
    console.log(`\nDone.`);
    console.log(`  Updated:   ${updated}`);
    console.log(`  Not found: ${notFound}`);
    console.log(`  Errors:    ${errors}`);
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});

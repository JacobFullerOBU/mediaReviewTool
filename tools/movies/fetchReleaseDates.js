// fetchReleaseDates.js
// Fetches actual release dates from Wikipedia for inTheatres movies and adds them to movieList.json.
// Safe to re-run — skips movies that already have a releaseDate.

const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

const path = require('path');
const MOVIE_LIST_PATH = path.join(__dirname, '../../Assets/Data/movieList.json');
const DELAY_MS = 400; // polite rate limit

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getWikipediaUrl(title) {
    const searchQuery = `${title} film`;
    const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchQuery)}&format=json`;
    const res = await axios.get(apiUrl, { timeout: 10000 });
    const page = res.data.query.search.find(p => /film/i.test(p.title)) || res.data.query.search[0];
    if (!page) return null;
    return `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`;
}

function parseDate(text) {
    if (!text) return null;
    // Strip citations like [1], parenthetical regions, newlines
    const cleaned = text.replace(/\[\d+\]/g, '').replace(/\(.*?\)/g, '').replace(/\n/g, ' ').trim();

    // ISO format: 2026-04-25
    const isoMatch = cleaned.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

    // "Month DD, YYYY"
    const longMatch = cleaned.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (longMatch) {
        const month = new Date(`${longMatch[1]} 1 2000`).getMonth() + 1;
        if (!isNaN(month)) {
            return `${longMatch[3]}-${String(month).padStart(2, '0')}-${String(longMatch[2]).padStart(2, '0')}`;
        }
    }

    // "DD Month YYYY"
    const euMatch = cleaned.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    if (euMatch) {
        const month = new Date(`${euMatch[2]} 1 2000`).getMonth() + 1;
        if (!isNaN(month)) {
            return `${euMatch[3]}-${String(month).padStart(2, '0')}-${String(euMatch[1]).padStart(2, '0')}`;
        }
    }

    // Fallback: "Month YYYY" → first of that month
    const monthYearMatch = cleaned.match(/([A-Za-z]+)\s+(\d{4})/);
    if (monthYearMatch) {
        const month = new Date(`${monthYearMatch[1]} 1 2000`).getMonth() + 1;
        if (!isNaN(month)) return `${monthYearMatch[2]}-${String(month).padStart(2, '0')}-01`;
    }

    return null;
}

async function fetchReleaseDate(title) {
    const url = await getWikipediaUrl(title);
    if (!url) return null;

    const res = await axios.get(url, { timeout: 10000 });
    const $ = cheerio.load(res.data);
    const infobox = $('.infobox.vevent');

    const releaseDateRow = infobox.find('tr').filter((_, el) => {
        return $(el).find('th').text().includes('Release date') || $(el).find('th').text().includes('Released');
    }).first();

    const rawText = releaseDateRow.find('td').text().trim();
    return parseDate(rawText);
}

async function main() {
    const movies = JSON.parse(fs.readFileSync(MOVIE_LIST_PATH, 'utf-8'));
    const targets = movies.filter(m => m.inTheatres === true && !m.releaseDate);

    console.log(`Found ${targets.length} in-theatres movies without a releaseDate.`);
    if (targets.length === 0) {
        console.log('Nothing to do.');
        return;
    }

    let updated = 0;
    let failed = [];

    for (let i = 0; i < targets.length; i++) {
        const movie = targets[i];
        process.stdout.write(`[${i + 1}/${targets.length}] ${movie.title} ... `);

        try {
            const date = await fetchReleaseDate(movie.title);
            if (date) {
                // Find this movie in the full array and set releaseDate
                const entry = movies.find(m => m.title === movie.title && m.inTheatres === true);
                if (entry) entry.releaseDate = date;
                updated++;
                console.log(date);
            } else {
                console.log('no date found');
                failed.push(movie.title);
            }
        } catch (err) {
            console.log(`error: ${err.message}`);
            failed.push(movie.title);
        }

        // Save progress every 20 movies
        if ((i + 1) % 20 === 0) {
            fs.writeFileSync(MOVIE_LIST_PATH, JSON.stringify(movies, null, 4));
            console.log(`  -> Progress saved (${updated} updated so far)`);
        }

        await sleep(DELAY_MS);
    }

    fs.writeFileSync(MOVIE_LIST_PATH, JSON.stringify(movies, null, 4));
    console.log(`\nDone. Updated ${updated} movies.`);
    if (failed.length > 0) {
        console.log(`\nCould not find dates for ${failed.length} movies:`);
        failed.forEach(t => console.log(`  - ${t}`));
    }
}

main().catch(console.error);

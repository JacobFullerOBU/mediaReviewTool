// Fetches popular albums from Spotify and writes them to Assets/Data/musicList.json
// Run with: node populate-music.js
// Requires Node 18+

import { writeFileSync, readFileSync, existsSync } from 'fs';

const CLIENT_ID     = '06341c17aea04e328ee5131a371be190';
const CLIENT_SECRET = '418b9ec1661c4f2fad8e1a9dcc40d846'; // update if rotated
const OUTPUT        = './Assets/Data/musicList.json';

const YEARS             = Array.from({ length: 2025 - 1960 + 1 }, (_, i) => 1960 + i); // 1960–2025
const NEW_RELEASE_PAGES = 5;  // 50 per page → 250 new releases
const ALBUMS_PER_QUERY  = 50; // max Spotify allows per request
const PAGES_PER_YEAR    = 3;  // pages per year → 150 albums per year
const BAR_WIDTH         = 30;

// ── Display helpers ───────────────────────────────────────────────────────────

function progressBar(current, total, label = '') {
    const pct   = total ? current / total : 0;
    const filled = Math.round(BAR_WIDTH * pct);
    const bar   = '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled);
    const pctStr = String(Math.round(pct * 100)).padStart(3);
    const truncated = label.length > 40 ? label.slice(0, 37) + '...' : label.padEnd(40);
    process.stdout.write(`  [${bar}] ${pctStr}% (${current}/${total})  ${truncated}\r`);
}

function clearLine() {
    process.stdout.write(' '.repeat(process.stdout.columns || 80) + '\r');
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function getToken() {
    const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
        },
        body: 'grant_type=client_credentials'
    });
    const data = await res.json();
    if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`);
    return data.access_token;
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

async function getNewReleases(token) {
    const albums = [];
    const total  = NEW_RELEASE_PAGES * 50;
    for (let page = 0; page < NEW_RELEASE_PAGES; page++) {
        const res  = await fetch(`https://api.spotify.com/v1/browse/new-releases?limit=50&offset=${page * 50}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!data.albums?.items?.length) break;
        albums.push(...data.albums.items);
        progressBar(albums.length, total, `new releases`);
    }
    clearLine();
    return albums;
}

async function searchByYear(token, year, index) {
    const albums = [];
    for (let page = 0; page < PAGES_PER_YEAR; page++) {
        const offset = page * ALBUMS_PER_QUERY;
        progressBar(index, YEARS.length, `year:${year} (page ${page + 1}/${PAGES_PER_YEAR})`);
        const res   = await fetch(
            `https://api.spotify.com/v1/search?q=year:${year}&type=album&limit=${ALBUMS_PER_QUERY}&offset=${offset}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );
        const data  = await res.json();
        const items = data.albums?.items || [];
        albums.push(...items);
        if (items.length < ALBUMS_PER_QUERY) break;
    }
    return albums;
}

async function getArtistGenres(token, artistIds) {
    const genreMap = {};
    const unique = [...new Set(artistIds.filter(Boolean))];
    for (let i = 0; i < unique.length; i += 50) {
        const chunk = unique.slice(i, i + 50).join(',');
        progressBar(Math.min(i + 50, unique.length), unique.length, 'fetching artist genres');
        const res  = await fetch(`https://api.spotify.com/v1/artists?ids=${chunk}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        (data.artists || []).forEach(a => { if (a) genreMap[a.id] = a.genres || []; });
    }
    clearLine();
    return genreMap;
}

async function getAlbumDetails(token, ids) {
    const results = [];
    for (let i = 0; i < ids.length; i += 20) {
        const chunk   = ids.slice(i, i + 20);
        const res     = await fetch(`https://api.spotify.com/v1/albums?ids=${chunk.join(',')}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data    = await res.json();
        const fetched = data.albums?.filter(Boolean) || [];
        results.push(...fetched);

        const lastName = fetched[fetched.length - 1]?.name || '';
        progressBar(results.length, ids.length, lastName);
    }
    clearLine();
    return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log('Authenticating with Spotify...');
    const token = await getToken();
    console.log('  ✓ Token acquired\n');

    console.log(`Fetching new releases (${NEW_RELEASE_PAGES * 50} max)...`);
    const newReleases = await getNewReleases(token);
    console.log(`  ✓ ${newReleases.length} new releases fetched\n`);

    console.log(`Searching ${YEARS.length} years (${1960}–${2025}, ${PAGES_PER_YEAR} pages each)...`);
    const yearAlbums = [];
    for (let i = 0; i < YEARS.length; i++) {
        const results = await searchByYear(token, YEARS[i], i);
        yearAlbums.push(...results);
    }
    clearLine();
    console.log(`  ✓ ${yearAlbums.length} albums fetched from year searches\n`);

    // Load existing list
    const existing    = existsSync(OUTPUT) ? JSON.parse(readFileSync(OUTPUT, 'utf8')) : [];
    const existingIds = new Set(existing.map(a => a.spotifyId).filter(Boolean));
    console.log(`Existing list: ${existing.length} albums`);

    // Filter to only new albums
    const seen   = new Set(existingIds);
    const unique = [];
    for (const album of [...newReleases, ...yearAlbums]) {
        if (album?.id && !seen.has(album.id)) {
            seen.add(album.id);
            unique.push(album);
        }
    }
    console.log(`New albums found: ${unique.length}\n`);

    // Patch existing entries that have no genres
    const needsPatch = existing.filter(a => a.spotifyId && (!a.genres || a.genres.length === 0));
    if (needsPatch.length > 0) {
        console.log(`Patching genres for ${needsPatch.length} existing albums...`);
        const patchDetails = await getAlbumDetails(token, needsPatch.map(a => a.spotifyId));
        const patchArtistIds = patchDetails.map(a => a?.artists?.[0]?.id).filter(Boolean);
        const patchGenreMap = await getArtistGenres(token, patchArtistIds);
        const patchById = {};
        patchDetails.forEach(a => { if (a) patchById[a.id] = a; });
        needsPatch.forEach(entry => {
            const detail = patchById[entry.spotifyId];
            if (detail) {
                entry.genres = patchGenreMap[detail.artists?.[0]?.id] || [];
            }
        });
        console.log(`  ✓ Genres patched\n`);
    }

    if (unique.length === 0) {
        const merged = [...existing];
        merged.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
        writeFileSync(OUTPUT, JSON.stringify(merged, null, 2));
        console.log('No new albums, but genres were patched. Saved.');
        return;
    }

    console.log(`Fetching full details for ${unique.length} albums...`);
    const detailed = await getAlbumDetails(token, unique.map(a => a.id));
    console.log(`  ✓ Details fetched\n`);

    console.log('Fetching artist genres for new albums...');
    const artistIds = detailed.map(a => a?.artists?.[0]?.id).filter(Boolean);
    const artistGenreMap = await getArtistGenres(token, artistIds);
    console.log(`  ✓ Artist genres fetched\n`);

    const newEntries = detailed
        .filter(a => a?.name)
        .map(album => ({
            title:       album.name,
            artist:      album.artists?.map(a => a.name).join(', ') || '',
            year:        parseInt(album.release_date?.split('-')[0]) || null,
            description: '',
            category:    'music',
            poster:      album.images?.[0]?.url || '',
            image:       album.images?.[0]?.url || '',
            spotifyId:   album.id,
            popularity:  album.popularity ?? 0,
            genres:      artistGenreMap[album.artists?.[0]?.id] || []
        }));

    const merged = [...existing, ...newEntries];
    merged.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));

    writeFileSync(OUTPUT, JSON.stringify(merged, null, 2));

    console.log('─'.repeat(50));
    console.log(`  Added:  ${newEntries.length} new albums`);
    console.log(`  Total:  ${merged.length} albums`);
    console.log(`  Output: ${OUTPUT}`);
    console.log('─'.repeat(50));
}

main().catch(err => { console.error(err); process.exit(1); });

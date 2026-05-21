// Fetches popular albums from Spotify and writes them to Assets/Data/musicList.json
// Run with: node populate-music.js
// Requires Node 18+

import { writeFileSync } from 'fs';

const CLIENT_ID     = '06341c17aea04e328ee5131a371be190';
const CLIENT_SECRET = '79d301815e8c4f73b16ee5d4705b065b'; // update if rotated
const OUTPUT        = './Assets/Data/musicList.json';

const GENRES           = ['pop', 'rock', 'hip-hop', 'electronic', 'jazz', 'country', 'r-n-b', 'metal', 'indie', 'classical', 'latin', 'soul'];
const NEW_RELEASE_PAGES = 5;  // 50 per page → 250 new releases
const ALBUMS_PER_GENRE  = 50; // max Spotify allows per search request

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
    for (let page = 0; page < NEW_RELEASE_PAGES; page++) {
        const res = await fetch(`https://api.spotify.com/v1/browse/new-releases?limit=50&offset=${page * 50}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!data.albums?.items?.length) break;
        albums.push(...data.albums.items);
        process.stdout.write(`  new releases: ${albums.length}\r`);
    }
    return albums;
}

async function searchGenre(token, genre) {
    const res = await fetch(
        `https://api.spotify.com/v1/search?q=genre:${encodeURIComponent(genre)}&type=album&limit=${ALBUMS_PER_GENRE}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const data = await res.json();
    return data.albums?.items || [];
}

async function getAlbumDetails(token, ids) {
    const results = [];
    for (let i = 0; i < ids.length; i += 20) {
        const chunk = ids.slice(i, i + 20).join(',');
        const res = await fetch(`https://api.spotify.com/v1/albums?ids=${chunk}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        results.push(...(data.albums || []));
        process.stdout.write(`  fetching details: ${results.length}/${ids.length}\r`);
    }
    return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log('Authenticating with Spotify...');
    const token = await getToken();

    console.log(`Fetching ${NEW_RELEASE_PAGES * 50} new releases...`);
    const newReleases = await getNewReleases(token);
    console.log(`  → ${newReleases.length} new releases`);

    console.log(`Searching ${GENRES.length} genres (${ALBUMS_PER_GENRE} each)...`);
    const genreAlbums = [];
    for (const genre of GENRES) {
        const results = await searchGenre(token, genre);
        genreAlbums.push(...results);
        console.log(`  ${genre}: ${results.length} albums`);
    }

    // Deduplicate by Spotify ID
    const seen = new Set();
    const unique = [];
    for (const album of [...newReleases, ...genreAlbums]) {
        if (album?.id && !seen.has(album.id)) {
            seen.add(album.id);
            unique.push(album);
        }
    }
    console.log(`\n${unique.length} unique albums found. Fetching full details...`);

    const detailed = await getAlbumDetails(token, unique.map(a => a.id));
    console.log(`\nProcessing and sorting...`);

    // Sort by popularity (highest first)
    detailed.sort((a, b) => (b?.popularity ?? 0) - (a?.popularity ?? 0));

    const musicList = detailed
        .filter(a => a?.name)
        .map(album => ({
            title:      album.name,
            artist:     album.artists?.map(a => a.name).join(', ') || '',
            year:       parseInt(album.release_date?.split('-')[0]) || null,
            description: '',
            category:   'music',
            poster:     album.images?.[0]?.url || '',
            image:      album.images?.[0]?.url || '',
            spotifyId:  album.id,
            popularity: album.popularity ?? 0,
            genres:     album.genres || []
        }));

    writeFileSync(OUTPUT, JSON.stringify(musicList, null, 2));
    console.log(`\nDone! Wrote ${musicList.length} albums to ${OUTPUT}`);
}

main().catch(err => { console.error(err); process.exit(1); });

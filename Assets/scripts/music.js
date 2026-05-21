import { getAlbumData } from './spotify.js';

const PATHS = [
    'Assets/Data/musicList.json',
    './Assets/Data/musicList.json',
    '/mediaReviewTool/Assets/Data/musicList.json',
    '../Data/musicList.json',
    '../../Assets/Data/musicList.json',
];

export async function fetchMusic() {
    let albums = [];
    for (const path of PATHS) {
        try {
            const res = await fetch(path);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    albums = data;
                    break;
                }
            }
        } catch { /* try next path */ }
    }

    const enriched = await Promise.all(albums.map(async album => {
        const base = {
            ...album,
            genre: Array.isArray(album.genres) ? album.genres.join(', ') : (album.genre || '')
        };
        if (album.poster) return base;
        const spotifyData = await getAlbumData(album.title, album.artist);
        if (!spotifyData) return base;
        return { ...base, poster: spotifyData.poster, image: spotifyData.poster, spotifyId: spotifyData.spotifyId };
    }));

    return enriched;
}

// Legacy sync export — kept so any remaining sync imports don't crash
export const music = [];

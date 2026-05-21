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
            if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
                albums = await res.json();
                break;
            }
        } catch { /* try next path */ }
    }

    const enriched = await Promise.all(albums.map(async album => {
        if (album.poster) return album;
        const spotifyData = await getAlbumData(album.title, album.artist);
        if (!spotifyData) return album;
        return { ...album, poster: spotifyData.poster, image: spotifyData.poster, spotifyId: spotifyData.spotifyId };
    }));

    return enriched;
}

// Legacy sync export — kept so any remaining sync imports don't crash
export const music = [];

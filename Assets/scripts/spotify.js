const CLIENT_ID = '06341c17aea04e328ee5131a371be190';
const CLIENT_SECRET = '79d301815e8c4f73b16ee5d4705b065b'; // rotate this after setup

async function getToken() {
    const token = sessionStorage.getItem('sp_token');
    const expiry = sessionStorage.getItem('sp_expiry');
    if (token && expiry && Date.now() < parseInt(expiry)) return token;

    const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)
        },
        body: 'grant_type=client_credentials'
    });
    const data = await res.json();
    sessionStorage.setItem('sp_token', data.access_token);
    sessionStorage.setItem('sp_expiry', Date.now() + (data.expires_in - 60) * 1000);
    return data.access_token;
}

export async function getAlbumData(title, artist) {
    try {
        const token = await getToken();
        const q = encodeURIComponent(`album:${title} artist:${artist}`);
        const res = await fetch(`https://api.spotify.com/v1/search?q=${q}&type=album&limit=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const album = data.albums?.items?.[0];
        if (!album) return null;
        return {
            poster: album.images?.[0]?.url || '',
            spotifyId: album.id,
            spotifyUrl: album.external_urls?.spotify || ''
        };
    } catch {
        return null;
    }
}

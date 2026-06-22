import admin from 'firebase-admin';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const POSTER_BASE = 'https://image.tmdb.org/t/p/w500';
const PAGES = 3; // 20 movies per page = 60 movies total

async function tmdb(path, params = {}) {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set('api_key', process.env.TMDB_API_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${path} → ${res.status}`);
  return res.json();
}

async function main() {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
    databaseURL: 'https://mediareviews-3cf32-default-rtdb.firebaseio.com/',
  });

  const db = admin.database();

  // Load hidden media IDs so the pipeline never re-adds a card the admin deleted
  const hiddenSnap = await db.ref('hiddenMedia').get();
  const hiddenMedia = hiddenSnap.exists() ? hiddenSnap.val() : {};
  const toMediaId = title =>
    'movies_' + (title || '').trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

  // Collect movie IDs from popular pages
  const ids = [];
  for (let page = 1; page <= PAGES; page++) {
    const { results } = await tmdb('/movie/popular', { page });
    ids.push(...results.map(m => m.id));
    console.log(`Page ${page}: got ${results.length} IDs`);
  }

  const movies = {};
  for (const id of ids) {
    try {
      // Single call gets full details + credits together
      const m = await tmdb(`/movie/${id}`, { append_to_response: 'credits' });

      if (hiddenMedia[toMediaId(m.title)]) {
        console.log(`Skipping hidden movie: ${m.title}`);
        continue;
      }

      const director = m.credits.crew.find(p => p.job === 'Director')?.name ?? '';
      const actors = m.credits.cast.slice(0, 5).map(a => a.name).join('\n');
      movies[`tmdb_${id}`] = {
        category: 'movies',
        title: m.title,
        year: m.release_date?.slice(0, 4) ?? '',
        releaseDate: m.release_date ?? '',
        description: m.overview ?? '',
        genre: m.genres.map(g => g.name).join(', '),
        director,
        actors,
        poster: m.poster_path ? `${POSTER_BASE}${m.poster_path}` : '',
        tmdb_id: id,
      };
      // ~6 req/s — well within TMDB's 40/10s rate limit
      await new Promise(r => setTimeout(r, 150));
    } catch (err) {
      console.error(`Skipping movie ${id}: ${err.message}`);
    }
  }

  // update() merges rather than wiping, safe to re-run
  await db.ref('tmdb_movies').update(movies);
  console.log(`Done. Wrote ${Object.keys(movies).length} movies to /tmdb_movies.`);
  await admin.app().delete();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

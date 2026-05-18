const fs = require('fs');
const apiKey = '2669280'; // Replace with your OMDb API key

const movies = JSON.parse(fs.readFileSync('./Movies/movieList.json', 'utf8'));

async function getGenre(title) {
  const url = `http://www.omdbapi.com/?apikey=${apiKey}&t=${encodeURIComponent(title)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.Response === 'False') {
      console.warn(`OMDb API error for \"${title}\": ${data.Error}`);
      return null;
    }
    return {
      genre: data.Genre || '',
      year: data.Year || '',
      plot: data.Plot || ''
    };
  } catch (err) {
    console.error(`Fetch error for \"${title}\":`, err);
    return null;
  }
}


(async () => {
  let updated = 0, skipped = 0, failed = 0;
  for (const movie of movies) {
    if (!movie.title) {
      console.log('Skipped (no title):', movie.poster);
      skipped++;
      continue;
    }
    // Only update if any field is missing
    const needsUpdate = !movie.genre || !movie.year || !movie.description;
    if (!needsUpdate) {
      console.log(`Skipped (already has all fields): \"${movie.title}\"`);
      skipped++;
      continue;
    }
    const info = await getGenre(movie.title);
    if (info) {
      if (!movie.genre) movie.genre = info.genre;
      if (!movie.year) movie.year = info.year;
      if (!movie.description) movie.description = info.plot;
      updated++;
      console.log(`Fetched for \"${movie.title}\": Genre: ${info.genre}, Year: ${info.year}, Plot: ${info.plot}`);
    } else {
      failed++;
      console.warn(`Failed to fetch info for \"${movie.title}\"`);
    }
  }
  fs.writeFileSync('./Movies/movieList.json', JSON.stringify(movies, null, 2));
  console.log(`Fields updated in movieList.json. Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`);
})();
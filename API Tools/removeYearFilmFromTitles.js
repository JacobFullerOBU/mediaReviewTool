// This script removes ' (year film)', ' (year)', and similar patterns from the 'title' field in each entry of movieList.json.
// Usage: node removeYearFilmFromTitles.js

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'Movies', 'movieList.json');

function cleanTitle(title) {
  // Remove patterns like ' (2023 film)', ' (2012 film series)', ' (film series)', ' (2023)', ' (film)', etc. at the end of the title
  return title
    // Remove ' (year film)', ' (year film series)', ' (year)', ' (film series)', ' (film)', ' (series)' at the end
    .replace(/ \((\d{4}) ?film( series)?\)$/i, '')
    .replace(/ \((\d{4}) ?(series)\)$/i, '')
    .replace(/ \((\d{4})\)$/i, '')
    .replace(/ \(film( series)?\)$/i, '')
    .replace(/ \(series\)$/i, '')
    .replace(/ \([^)]+\)$/i, '') // fallback: remove any trailing parenthetical
    .trim();
}

function main() {
  let data = fs.readFileSync(filePath, 'utf8');
  let movies = JSON.parse(data);
  let changed = false;

  movies.forEach(movie => {
    if (movie.title) {
      const cleaned = cleanTitle(movie.title);
      if (cleaned !== movie.title) {
        movie.title = cleaned;
        changed = true;
      }
    }
  });

  if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(movies, null, 2), 'utf8');
    console.log('Titles cleaned and file updated.');
  } else {
    console.log('No titles needed cleaning.');
  }
}

main();

// removeDuplicates.js
// This script removes the second and subsequent instances of duplicate movie titles from movieList.json, keeping only the first occurrence.

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'Movies', 'movieList.json');

function removeDuplicateTitles(jsonPath) {
  let data = fs.readFileSync(jsonPath, 'utf8');
  let movies;
  try {
    movies = JSON.parse(data);
  } catch (e) {
    // Try to fix trailing commas or formatting issues
    data = data.replace(/,\s*([}\]])/g, '$1');
    movies = JSON.parse(data);
  }

  if (!Array.isArray(movies)) {
    // If the file is not a pure array, try to extract the array
    const arrMatch = data.match(/\[.*\]/s);
    if (arrMatch) {
      movies = JSON.parse(arrMatch[0]);
    } else {
      throw new Error('Could not parse movie list as array.');
    }
  }

  // Remove all duplicates, keep only the first occurrence of each title
  const seen = new Set();
  const deduped = movies.filter(movie => {
    if (!movie.title) return true;
    if (seen.has(movie.title)) return false;
    seen.add(movie.title);
    return true;
  });

  fs.writeFileSync(jsonPath, JSON.stringify(deduped, null, 2));
  console.log(`Removed all duplicates. New count: ${deduped.length}`);
}

removeDuplicateTitles(filePath);

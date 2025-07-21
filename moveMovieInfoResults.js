// moveMovieInfoResults.js
// Script to copy all entries from movieInfoResults.json to movieList.json

const fs = require('fs');
const path = require('path');

const resultsPath = path.join(__dirname, 'Movies', 'movieInfoResults.json');
const listPath = path.join(__dirname, 'Movies', 'movieList.json');

function moveEntries() {
    if (!fs.existsSync(resultsPath)) {
        console.error('movieInfoResults.json not found.');
        return;
    }
    const data = fs.readFileSync(resultsPath, 'utf-8');
    fs.writeFileSync(listPath, data);
    console.log('All entries from movieInfoResults.json have been copied to movieList.json.');
}

moveEntries();

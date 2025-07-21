// movieInfoScraper.js
// Script to read movie titles from a file, fetch Wikipedia info, and extract details

const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

const MOVIE_LIST_PATH = 'Movies/listOfMoviesToAdd.txt';

async function getWikipediaUrl(title) {
    // Use Wikipedia search API to get the page URL, prioritizing film articles
    const searchQuery = `${title} film`;
    const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchQuery)}&format=json`;
    const res = await axios.get(apiUrl);
    // Prefer results with 'film' in the title
    const page = res.data.query.search.find(p => /film/i.test(p.title)) || res.data.query.search[0];
    if (!page) return null;
    return `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`;
}

async function scrapeMovieInfo(url) {
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);
    const infobox = $('.infobox.vevent');
    const info = {
        title: $('h1').first().text().trim(),
        year: '',
        description: '',
        genre: '',
        director: '',
        actors: '',
        poster: ''
    };
    // Year Released
    const yearText = infobox.find('tr:contains("Release date") td').text().trim() || infobox.find('tr:contains("Released") td').text().trim();
    const yearMatch = yearText.match(/(\d{4})/);
    info.year = yearMatch ? yearMatch[1] : '';
    // Description
    info.description = $('p').first().text().trim();
    // Genre
    info.genre = infobox.find('tr:contains("Genre") td').text().trim();
    // Director
    info.director = infobox.find('tr:contains("Directed by") td').text().trim();
    // Actors
    info.actors = infobox.find('tr:contains("Starring") td').text().trim();
    // Poster Image
    const img = infobox.find('img').first();
    info.poster = img.length ? 'https:' + img.attr('src') : '';
    return info;
}

async function main() {
    const titles = fs.readFileSync(MOVIE_LIST_PATH, 'utf-8').split('\n').map(t => t.trim()).filter(Boolean);
    const results = [];
    for (const title of titles) {
        console.log(`Processing: ${title}`);
        try {
            const wikiUrl = await getWikipediaUrl(title);
            if (!wikiUrl) {
                console.log(`Wikipedia page not found for: ${title}`);
                continue;
            }
            const info = await scrapeMovieInfo(wikiUrl);
            results.push(info);
            console.log(info);
        } catch (err) {
            console.error(`Error processing ${title}:`, err.message);
        }
    }
    fs.writeFileSync('Movies/movieInfoResults.json', JSON.stringify(results, null, 2));
    console.log('Results saved to Movies/movieInfoResults.json');
}

main();

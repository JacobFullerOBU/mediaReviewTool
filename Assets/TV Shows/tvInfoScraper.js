// tvInfoScraper.js
// Script to read TV show titles from a file, fetch Wikipedia info, and extract details

const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

const TV_LIST_PATH = 'TV/listOfTVShowsToAdd.txt';

async function getWikipediaUrl(title) {
    // Use Wikipedia search API to get the page URL, prioritizing TV series articles
    const searchQuery = `${title} television series`;
    const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchQuery)}&format=json`;
    const res = await axios.get(apiUrl);
    // Prefer results with 'television series' or 'TV series' in the title
    const page = res.data.query.search.find(p => /television series|tv series/i.test(p.title)) || res.data.query.search[0];
    if (!page) return null;
    return `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`;
}

async function scrapeTVInfo(url) {
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);
    const infobox = $('.infobox.vevent, .infobox');
    const info = {
        title: $('h1').first().text().trim(),
        year: '',
        description: '',
        genre: '',
        creator: '',
        actors: '',
        poster: ''
    };
    // Year Aired
    const yearText = infobox.find('tr:contains("Original release") td').text().trim() || infobox.find('tr:contains("First aired") td').text().trim();
    const yearMatch = yearText.match(/(\d{4})/);
    info.year = yearMatch ? yearMatch[1] : '';
    // Description
    info.description = $('p').first().text().trim();
    // Genre
    info.genre = infobox.find('tr:contains("Genre") td').text().trim();
    // Creator (or Developed by)
    info.creator = infobox.find('tr:contains("Created by") td').text().trim() || infobox.find('tr:contains("Developed by") td').text().trim();
    // Actors (Starring)
    info.actors = infobox.find('tr:contains("Starring") td').text().trim();
    // Poster Image
    const img = infobox.find('img').first();
    info.poster = img.length ? 'https:' + img.attr('src') : '';
    return info;
}

async function main() {
    const titles = fs.readFileSync(TV_LIST_PATH, 'utf-8').split('\n').map(t => t.trim()).filter(Boolean);
    const results = [];
    for (const title of titles) {
        console.log(`Processing: ${title}`);
        try {
            const wikiUrl = await getWikipediaUrl(title);
            if (!wikiUrl) {
                console.log(`Wikipedia page not found for: ${title}`);
                continue;
            }
            const info = await scrapeTVInfo(wikiUrl);
            results.push(info);
            console.log(info);
        } catch (err) {
            console.error(`Error processing ${title}:`, err.message);
        }
    }
    fs.writeFileSync('TV/tvInfoResults.json', JSON.stringify(results, null, 2));
    console.log('Results saved to TV/tvInfoResults.json');
}

main();

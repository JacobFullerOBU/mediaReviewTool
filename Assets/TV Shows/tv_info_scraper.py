# tv_info_scraper.py
# This script reads TV show titles from a file, fetches information from Wikipedia,
# and extracts details.

# This script requires the 'requests' and 'beautifulsoup4' libraries.
# You can install them using pip:
# pip install requests beautifulsoup4

import json
import os
import re
import requests
from bs4 import BeautifulSoup

TV_LIST_PATH = 'listOfTVShowsToAdd.txt'
RESULTS_PATH = 'tvInfoResults.json'

def get_wikipedia_url(title):
    """
    Use the Wikipedia search API to get the page URL.
    """
    clean_title = re.sub(r'\s*\(.*\)\s*', '', title).strip()
    
    search_query = f"{clean_title} TV series"
    api_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={search_query}&format=json&srwhat=text"
    
    try:
        response = requests.get(api_url)
        response.raise_for_status()
        data = response.json()
        search_results = data.get('query', {}).get('search', [])
        
        if not search_results:
            # Try a broader search if the first one fails
            search_query = clean_title
            api_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={search_query}&format=json"
            response = requests.get(api_url)
            response.raise_for_status()
            data = response.json()
            search_results = data.get('query', {}).get('search', [])

        if not search_results:
            return None

        # Heuristics to find the best match
        # 1. Exact match on title (case-insensitive)
        for p in search_results:
            if p['title'].lower() == clean_title.lower():
                return f"https://en.wikipedia.org/wiki/{p['title'].replace(' ', '_')}"

        # 2. Title contains "(TV series)" or "(television series)"
        for p in search_results:
            if '(tv series)' in p['title'].lower() or '(television series)' in p['title'].lower():
                return f"https://en.wikipedia.org/wiki/{p['title'].replace(' ', '_')}"

        # 3. Just return the first result
        return f"https://en.wikipedia.org/wiki/{search_results[0]['title'].replace(' ', '_')}"

    except requests.exceptions.RequestException as e:
        print(f"Error fetching Wikipedia search results for '{title}': {e}")
        return None

def scrape_tv_info(url):
    """
    Scrape TV show information from a Wikipedia URL.
    """
    try:
        response = requests.get(url)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        
        infobox = soup.find('table', {'class': ['infobox', 'vevent']}) or soup.find('table', class_='infobox')
        
        info = {
            'title': soup.find('h1').get_text(strip=True),
            'year': '',
            'description': '',
            'genre': '',
            'creator': '',
            'actors': '',
            'poster': ''
        }
        
        if infobox:
            # Year Aired
            year_header = infobox.find('th', string=lambda t: t and 'original release' in t.lower()) or infobox.find('th', string=lambda t: t and 'first aired' in t.lower())
            if year_header:
                year_text = year_header.find_next_sibling('td').get_text(strip=True)
                year_match = re.search(r'(\d{4})', year_text)
                if year_match:
                    info['year'] = year_match.group(1)

            # Genre
            genre_header = infobox.find('th', string='Genre')
            if genre_header:
                info['genre'] = genre_header.find_next_sibling('td').get_text(strip=True)

            # Creator
            creator_header = infobox.find('th', string='Created by') or infobox.find('th', string='Developed by')
            if creator_header:
                info['creator'] = creator_header.find_next_sibling('td').get_text(strip=True)
                
            # Actors
            actors_header = infobox.find('th', string='Starring')
            if actors_header:
                info['actors'] = actors_header.find_next_sibling('td').get_text(strip=True)

            # Poster Image
            image_tag = infobox.find('img')
            if image_tag and image_tag.get('src'):
                info['poster'] = 'https:' + image_tag['src']

        # Description
        first_paragraph = soup.find('p')
        if first_paragraph:
            info['description'] = first_paragraph.get_text(strip=True)
            
        return info

    except requests.exceptions.RequestException as e:
        print(f"Error scraping {url}: {e}")
        return None

def main():
    """
    Main function to run the scraper.
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    tv_list_file = os.path.join(script_dir, TV_LIST_PATH)
    results_file = os.path.join(script_dir, RESULTS_PATH)

    if not os.path.exists(tv_list_file):
        print(f"Error: The file {TV_LIST_PATH} was not found in the same directory.")
        return

    with open(tv_list_file, 'r', encoding='utf-8') as f:
        titles = [line.strip() for line in f if line.strip()]
        
    results = []
    for title in titles:
        print(f"Processing: {title}")
        wiki_url = get_wikipedia_url(title)
        
        if not wiki_url:
            print(f"Wikipedia page not found for: {title}")
            continue
            
        tv_info = scrape_tv_info(wiki_url)
        
        if tv_info:
            results.append(tv_info)
            print(json.dumps(tv_info, indent=2))
        else:
            print(f"Could not scrape info for: {title}")

    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
        
    print(f"Results saved to {RESULTS_PATH}")

if __name__ == '__main__':
    main()

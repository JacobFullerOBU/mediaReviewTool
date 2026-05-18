import json
import requests
import os
import shutil
import time
import re
from datetime import datetime

# --- CONFIGURATION ---
# 1. PASTE YOUR KEY HERE
API_KEY = "f50a7cd62fa00a24f29a0e3ebb12c130"
JS_FILE_PATH = "Assets/TV Shows/tv.js"
CONFIG_FILE = "API Tools/tv_fetch_config.json" # The memory file
PAGES_TO_ADD = 10                     # How many new pages to grab per run

# --- PART 1: MEMORY (TRACKING PAGES) ---
def get_start_page():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f:
                return json.load(f).get('next_page', 1)
        except:
            return 1
    return 1

def update_start_page(last_page_fetched):
    new_start = last_page_fetched + 1
    with open(CONFIG_FILE, 'w') as f:
        json.dump({'next_page': new_start}, f)
    print(f" [Memory] Saved! Next time, script will start at Page {new_start}")

# --- PART 2: FETCHING ---
def fetch_new_shows(start_page):
    end_page = start_page + PAGES_TO_ADD - 1
    print(f"Fetching TV shows from TMDB (Pages {start_page}-{end_page})...")
    
    new_shows = []
    
    # Get Genre Map
    genre_map = {}
    try:
        g_resp = requests.get(f"https://api.themoviedb.org/3/genre/tv/list?api_key={API_KEY}")
        for g in g_resp.json().get('genres', []):
            genre_map[g['id']] = g['name']
    except:
        pass

    fetched_something = False

    for page in range(start_page, end_page + 1):
        url = f"https://api.themoviedb.org/3/tv/popular?api_key={API_KEY}&language=en-US&page={page}"
        
        try:
            resp = requests.get(url)
            data = resp.json()
            
            if 'results' not in data: 
                print("No more results found.")
                break
            
            fetched_something = True
            
            for item in data['results']:
                # Format genres
                genres = [genre_map.get(g_id, "Unknown") for g_id in item.get('genre_ids', [])]
                
                show = {
                    "title": item['name'],
                    "description": item['overview'].replace('"', "'").replace('\n', ' '), # Clean up text
                    "category": "tv",
                    "rating": item['vote_average'],
                    "year": item.get('first_air_date', '')[:4],
                    "reviews": item['vote_count'],
                    "image": f"https://image.tmdb.org/t/p/w500{item['poster_path']}"
                }
                new_shows.append(show)
                
        except Exception as e:
            print(f"Error on page {page}: {e}")

    # Only update memory if we actually succeeded
    if fetched_something:
        update_start_page(end_page)
        
    print(f"Fetched {len(new_shows)} new shows.")
    return new_shows

# --- PART 3: PARSING & SAVING ---
def parse_existing_js(filepath):
    if not os.path.exists(filepath): return set()

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Simple regex to find existing titles so we don't duplicate
    title_matches = re.findall(r'title:\s*["\'](.*?)["\']', content)
    return set(title_matches)

def append_to_js_file(new_shows, existing_titles):
    with open(JS_FILE_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove the last "];" to open the array
    content = content.strip()
    if content.endswith('];'):
        content = content[:-2]

    # Calculate next ID
    ids = [int(m) for m in re.findall(r'id:\s*(\d+)', content)]
    next_id = max(ids) + 1 if ids else 1
    
    added_count = 0
    new_entries_str = ""

    for show in new_shows:
        # Check for duplicates
        if show['title'] in existing_titles:
            continue
            
        entry = f"""
    {{
        id: {next_id},
        title: "{show['title']}",
        description: "{show['description']}",
        category: "tv",
        rating: {show['rating']},
        year: "{show['year']}",
        reviews: {show['reviews']},
        image: "{show['image']}"
    }},"""
        new_entries_str += entry
        existing_titles.add(show['title'])
        next_id += 1
        added_count += 1

    # Close the array
    final_content = content + new_entries_str + "\n];"
    
    with open(JS_FILE_PATH, 'w', encoding='utf-8') as f:
        f.write(final_content)
        
    print(f"Success! Added {added_count} new shows to {JS_FILE_PATH}")

# --- MAIN ---
if __name__ == "__main__":
    if os.path.exists(JS_FILE_PATH):
        shutil.copy(JS_FILE_PATH, "tv_backup.js")
    
    start_at = get_start_page()
    
    existing_titles = parse_existing_js(JS_FILE_PATH)
    new_data = fetch_new_shows(start_at)
    
    if new_data:
        append_to_js_file(new_data, existing_titles)
    else:
        print("No new data retrieved.")
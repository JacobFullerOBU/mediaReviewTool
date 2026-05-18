import json
import sys
import requests
import os
import shutil
import time

# --- CONFIGURATION ---
API_KEY = "f50a7cd62fa00a24f29a0e3ebb12c130"
PAGES_TO_ADD = 50             # How many NEW pages to grab each time you run this
MASTER_FILE = 'Assets/Movies/movieList.json' 
BACKUP_FILE = 'Assets/Movies/movieList_backup.json'
CONFIG_FILE = 'Assets/Movies/fetch_config.json' # Stores the memory of where we left off
NEW_DATA_FILE = 'Assets/Movies/media_data.json'

# --- PART 1: MANAGE STATE ---
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

# --- ADD THIS AT THE VERY TOP OF YOUR FILE ---
from datetime import datetime

# --- REPLACE YOUR fetch_new_movies FUNCTION WITH THIS ---
def fetch_new_movies(start_page):
    end_page = start_page + PAGES_TO_ADD - 1
    
    print(f"\n========================================")
    print(f" STARTING FETCH: Pages {start_page} to {end_page}")
    print(f"========================================\n")
    
    # Get Genre List
    genre_map = {}
    try:
        g_resp = requests.get(f"https://api.themoviedb.org/3/genre/movie/list?api_key={API_KEY}")
        for g in g_resp.json().get('genres', []):
            genre_map[g['id']] = g['name']
    except:
        pass

    fetched_movies = []
    
    # Get Today's Date for comparison
    today = datetime.now().date()

    for page_num in range(start_page, end_page + 1):
        print(f"--- Processing Page {page_num}... ---")
        
        url = f"https://api.themoviedb.org/3/movie/popular?api_key={API_KEY}&language=en-US&page={page_num}"
        
        try:
            response = requests.get(url)
            data = response.json()
            
            if 'results' not in data:
                print("   [!] No results found.")
                break

            for item in data['results']:
                # --- DATE CHECK ---
                release_date_str = item.get('release_date', '')
                if not release_date_str:
                    continue # Skip if no date exists

                # Convert string "2025-12-25" to a Date Object
                release_date_obj = datetime.strptime(release_date_str, "%Y-%m-%d").date()

                # IF release date is in the future, SKIP IT
                if release_date_obj > today:
                    print(f" [SKIP] Upcoming Release: {item['title']} ({release_date_str})")
                    continue 

                # Director logic
                director_name = "Unknown"
                try:
                    credits_url = f"https://api.themoviedb.org/3/movie/{item['id']}/credits?api_key={API_KEY}"
                    cred_resp = requests.get(credits_url)
                    crew = cred_resp.json().get('crew', [])
                    director_entry = next((m for m in crew if m['job'] == 'Director'), None)
                    if director_entry:
                        director_name = director_entry['name']
                except:
                    pass

                # Format data
                genre_names = [genre_map.get(g_id, "Unknown") for g_id in item.get('genre_ids', [])]
                genre_string = ", ".join(genre_names)
                
                # --- PRINT THE INFO ---
                print(f" [+] FOUND: {item['title']} ({release_date_str})")
                
                movie_entry = {
                    "title": item['title'],
                    "year": release_date_str[:4],
                    "description": item['overview'],
                    "genre": genre_string,
                    "director": director_name,
                    "poster": f"https://image.tmdb.org/t/p/w500{item['poster_path']}",
                    "category": "movies"
                }
                fetched_movies.append(movie_entry)
                
                time.sleep(0.05) 
                
        except Exception as e:
            print(f"Error on page {page_num}: {e}")

    if fetched_movies:
        update_start_page(end_page)
        
    return fetched_movies

# --- PART 3: MERGING ---
def merge_into_master(new_movies):
    print(f"\n========================================")
    print(f" MERGING DATA")
    print(f"========================================")

    master_list = []
    if os.path.exists(MASTER_FILE):
        try:
            with open(MASTER_FILE, 'r', encoding='utf-8') as f:
                master_list = json.load(f)
        except:
            pass

    if master_list:
        shutil.copy2(MASTER_FILE, BACKUP_FILE)
        print(f" [✔] Backup saved to {BACKUP_FILE}")

    existing_fingerprints = {f"{m['title'].lower().strip()}|{m['year']}" for m in master_list}
    added_count = 0

    for movie in new_movies:
        fingerprint = f"{movie['title'].lower().strip()}|{movie['year']}"
        if fingerprint not in existing_fingerprints:
            master_list.append(movie)
            existing_fingerprints.add(fingerprint)
            added_count += 1
        else:
            # Optional: Print skipped items
            # print(f" [x] Skipped duplicate: {movie['title']}")
            pass

    with open(MASTER_FILE, 'w', encoding='utf-8') as f:
        json.dump(master_list, f, indent=4, ensure_ascii=False)

    print(f"\n [✔] SUCCESS")
    print(f" New Movies Added:   {added_count}")
    print(f" Total Library Size: {len(master_list)}")

# --- MAIN ---
if __name__ == "__main__":
    start_at = get_start_page()
    new_data = fetch_new_movies(start_at)
    
    if new_data:
        merge_into_master(new_data)
    else:
        print("\nNo data fetched.")
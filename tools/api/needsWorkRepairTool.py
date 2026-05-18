import json
import requests
import os
import time

# --- CONFIGURATION ---
API_KEY = "f50a7cd62fa00a24f29a0e3ebb12c130"
NEEDS_WORK_FILE = 'needs_work.json'

def load_json(filename):
    if not os.path.exists(filename): return []
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return []

def save_json(filename, data):
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

def repair_item(item):
    print(f" 🔧 Attempting repair: '{item['title']}'...")
    
    # 1. Set category to 'Movie' for all items
    item['category'] = 'Movie'
    # Determine if it was originally TV (for endpoint logic only)
    category = item.get('category', 'movies').lower()
    is_tv = 'tv' in category
    endpoint = 'tv' if is_tv else 'movie'
    
    # 2. Search TMDB for this specific title
    search_url = f"https://api.themoviedb.org/3/search/{endpoint}?api_key={API_KEY}&query={item['title']}"
    
    try:
        resp = requests.get(search_url)
        results = resp.json().get('results', [])
        
        if not results:
            print(f"    ❌ No results found on TMDB.")
            return item # Return original broken item
            
        # 3. Find the best match (Match Year if possible)
        best_match = results[0] # Default to first result
        
        # If we have a year in our broken data, try to match it exactly
        my_year = str(item.get('year', ''))[:4]
        if my_year:
            for res in results:
                res_date = res.get('first_air_date' if is_tv else 'release_date', '')
                if res_date and res_date[:4] == my_year:
                    best_match = res
                    break

        # 4. Fetch Details (We need Genres and Director/Creator)
        # We assume the search result has enough, but for Director we might need a 2nd call
        # Let's get the genre map first (Optimization: Do this once globally if speed matters)
        g_resp = requests.get(f"https://api.themoviedb.org/3/genre/{endpoint}/list?api_key={API_KEY}")
        genre_map = {g['id']: g['name'] for g in g_resp.json().get('genres', [])}
        
        # Fill in MISSING Data only (Don't overwrite existing good data if you prefer)
        # But usually, API data is better, so we overwrite empty fields.
        
        if not item.get('description'):
            item['description'] = best_match.get('overview', '')

        if not item.get('genre') or item['genre'] == "Unknown":
            g_names = [genre_map.get(gid, "Unknown") for gid in best_match.get('genre_ids', [])]
            item['genre'] = ", ".join(g_names)

        if not item.get('poster') or "wikimedia" in item['poster']: # Replace wiki placeholder
            if best_match.get('poster_path'):
                item['poster'] = f"https://image.tmdb.org/t/p/w500{best_match['poster_path']}"

        if not item.get('year'):
            date_str = best_match.get('first_air_date' if is_tv else 'release_date', '')
            item['year'] = date_str[:4] if date_str else ""

        # Director / Creator (Requires extra call usually)
        if not item.get('director') or item['director'] == "Unknown":
            try:
                if is_tv:
                    det_url = f"https://api.themoviedb.org/3/tv/{best_match['id']}?api_key={API_KEY}"
                    creators = requests.get(det_url).json().get('created_by', [])
                    if creators: item['director'] = creators[0]['name']
                else:
                    cred_url = f"https://api.themoviedb.org/3/movie/{best_match['id']}/credits?api_key={API_KEY}"
                    crew = requests.get(cred_url).json().get('crew', [])
                    director = next((m for m in crew if m['job'] == 'Director'), None)
                    if director: item['director'] = director['name']
            except:
                pass # Fail silently on director

        print(f"    ✅ Repaired!")
        return item

    except Exception as e:
        print(f"    ❌ Error: {e}")
        return item

def run_repairs():
    print(f"--- STARTING AUTO-REPAIR ---")
    
    data = load_json(NEEDS_WORK_FILE)
    if not data:
        print("No items in needs_work.json to repair.")
        return

    repaired_data = []
    
    for item in data:
        # Check if it actually needs repair (missing fields)
        # But essentially we just run the repair logic on everything in this file
        fixed_item = repair_item(item)
        repaired_data.append(fixed_item)
        time.sleep(0.25) # Rate limiting

    save_json(NEEDS_WORK_FILE, repaired_data)
    print(f"\n--- DONE ---")
    print(f"Updated {NEEDS_WORK_FILE}. Please review it, then run 'restore_fixed_items.py'.")

if __name__ == "__main__":
    run_repairs()
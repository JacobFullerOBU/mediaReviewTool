import json
import requests
import time
# 1. PASTE YOUR API KEY HERE
API_KEY = "f50a7cd62fa00a24f29a0e3ebb12c130"
PAGES_TO_FETCH = 30  # Set this to 5 for 100 movies, 10 for 200, etc.

def fetch_large_batch():
    print("1. Fetching Genre List...")
    genre_map = {}
    try:
        g_resp = requests.get(f"https://api.themoviedb.org/3/genre/movie/list?api_key={API_KEY}")
        for g in g_resp.json().get('genres', []):
            genre_map[g['id']] = g['name']
    except Exception as e:
        print(f"   Error fetching genres: {e}")

    formatted_movies = []

    # --- THE LOOP ---
    # We loop from Page 1 up to PAGES_TO_FETCH
    for page_num in range(1, PAGES_TO_FETCH + 1):
        print(f"\n--- Processing Page {page_num} of {PAGES_TO_FETCH} ---")
        
        # Note: We added "&page={page_num}" to the URL
        url = f"https://api.themoviedb.org/3/movie/popular?api_key={API_KEY}&language=en-US&page={page_num}"
        
        try:
            response = requests.get(url)
            data = response.json()
            
            if 'results' not in data:
                print("   No results found on this page.")
                continue

            current_batch = data['results']
            
            for index, item in enumerate(current_batch):
                # Optional: Print progress so you know it's working
                print(f"   Fetching Director for: {item['title']}")
                
                # --- SUB-FETCH: Get Director ---
                director_name = "Unknown"
                try:
                    credits_url = f"https://api.themoviedb.org/3/movie/{item['id']}/credits?api_key={API_KEY}"
                    cred_resp = requests.get(credits_url)
                    crew = cred_resp.json().get('crew', [])
                    
                    director_entry = next((member for member in crew if member['job'] == 'Director'), None)
                    if director_entry:
                        director_name = director_entry['name']
                except:
                    pass # Keep going if director fails

                # --- FORMATTING ---
                genre_names = [genre_map.get(g_id, "Unknown") for g_id in item.get('genre_ids', [])]
                
                movie_entry = {
                    "title": item['title'],
                    "year": item.get('release_date', '')[:4],
                    "description": item['overview'],
                    "genre": ", ".join(genre_names),
                    "director": director_name,
                    "poster": f"https://image.tmdb.org/t/p/w500{item['poster_path']}",
                    "category": "movies"
                }
                
                formatted_movies.append(movie_entry)
                
                # Tiny pause to respect API limits (important when doing hundreds of requests!)
                time.sleep(0.1)

        except Exception as e:
            print(f"Error on page {page_num}: {e}")

    # --- SAVE TO FILE ---
    print(f"\nSAVING... Total movies fetched: {len(formatted_movies)}")
    with open('media_data.json', 'w', encoding='utf-8') as f:
        json.dump(formatted_movies, f, indent=4, ensure_ascii=False)
        
    print("Done! Check media_data.json")

if __name__ == "__main__":
    fetch_large_batch()
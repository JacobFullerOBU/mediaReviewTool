import json
import requests

# 1. PASTE YOUR API KEY HERE
API_KEY = "f50a7cd62fa00a24f29a0e3ebb12c130"

def fetch_formatted_data():
    # --- STEP A: Get the Genre List (Map IDs to Names) ---
    # We need this because movies only give us IDs like "28", not "Action"
    genre_url = f"https://api.themoviedb.org/3/genre/movie/list?api_key={API_KEY}&language=en-US"
    genre_map = {}
    
    try:
        g_response = requests.get(genre_url)
        g_data = g_response.json()
        for g in g_data['genres']:
            genre_map[g['id']] = g['name']
    except Exception as e:
        print(f"Error fetching genres: {e}")

    # --- STEP B: Fetch the Movies ---
    movie_url = f"https://api.themoviedb.org/3/movie/popular?api_key={API_KEY}&language=en-US&page=1"
    
    try:
        response = requests.get(movie_url)
        data = response.json()
        
        formatted_movies = []
        
        for item in data['results']:
            # 1. Convert Genre IDs to a string like "Action, Adventure"
            genre_names = [genre_map.get(g_id, "Unknown") for g_id in item['genre_ids']]
            genre_string = ", ".join(genre_names)

            # 2. Get just the Year from "2023-05-05"
            year_only = item['release_date'][:4] if item.get('release_date') else "Unknown"

            # 3. Build the object in YOUR specific format
            movie_entry = {
                "title": item['title'],
                "year": year_only,
                "description": item['overview'],
                "genre": genre_string,
                "director": "Unknown", # Requires separate API call per movie
                "poster": f"https://image.tmdb.org/t/p/w500{item['poster_path']}",
                "category": "movies"
            }
            
            formatted_movies.append(movie_entry)

        # --- STEP C: Save to JSON ---
        with open('media_data.json', 'w', encoding='utf-8') as f:
            json.dump(formatted_movies, f, indent=4, ensure_ascii=False)
            
        print(f"Success! Formatted {len(formatted_movies)} movies.")

    except Exception as e:
        print(f"Error fetching movies: {e}")

if __name__ == "__main__":
    fetch_formatted_data()
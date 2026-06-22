"""
Filters movieList.json to only include US movies using the OMDB API.
Saves progress to a checkpoint file so it can be resumed across multiple runs.
"""

import json
import time
import os
import urllib.request
import urllib.parse

API_KEY = "2669280"
INPUT_FILE = "movieList.json"
OUTPUT_FILE = "movieList.json"
CHECKPOINT_FILE = "omdb_country_cache.json"

def fetch_country(title, year):
    params = urllib.parse.urlencode({
        "t": title.strip(),
        "y": year.strip(),
        "apikey": API_KEY,
        "type": "movie"
    })
    url = f"http://www.omdbapi.com/?{params}"
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("Response") == "True":
                return data.get("Country", "")
            # Try without year if not found
            params2 = urllib.parse.urlencode({
                "t": title.strip(),
                "apikey": API_KEY,
                "type": "movie"
            })
            url2 = f"http://www.omdbapi.com/?{params2}"
            with urllib.request.urlopen(url2, timeout=10) as resp2:
                data2 = json.loads(resp2.read().decode("utf-8"))
                if data2.get("Response") == "True":
                    return data2.get("Country", "")
            return None  # Not found
    except Exception as e:
        print(f"  Error fetching '{title}': {e}")
        return "ERROR"

def is_us_movie(country):
    if not country:
        return False
    # Keep if country is unknown/error (don't discard on API failure)
    if country in ("ERROR", None):
        return True
    country_lower = country.lower()
    return "united states" in country_lower or "usa" in country_lower

def main():
    with open(INPUT_FILE, encoding="utf-8") as f:
        movies = json.load(f)
    print(f"Loaded {len(movies)} movies.")

    # Load checkpoint
    if os.path.exists(CHECKPOINT_FILE):
        with open(CHECKPOINT_FILE, encoding="utf-8") as f:
            cache = json.load(f)
        print(f"Resuming — {len(cache)} movies already checked.")
    else:
        cache = {}

    checked = 0
    errors = 0
    limit_hit = False

    for movie in movies:
        key = f"{movie['title'].strip()}|{movie.get('year', '').strip()}"
        if key in cache:
            continue

        country = fetch_country(movie["title"], movie.get("year", ""))

        if country == "ERROR":
            errors += 1
        elif country is None:
            cache[key] = ""  # Not found in OMDB — keep it (don't discard)
        else:
            cache[key] = country

        checked += 1

        if checked % 50 == 0:
            with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
                json.dump(cache, f, indent=2)
            print(f"  Progress: {len(cache)}/{len(movies)} checked ({errors} errors)")

        # Check for daily limit (OMDB returns specific error)
        if country == "ERROR" and errors > 5:
            print("Too many errors — may have hit daily API limit. Progress saved.")
            limit_hit = True
            break

        time.sleep(0.1)  # ~10 req/sec, well within limits

    # Save final checkpoint
    with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2)

    if limit_hit:
        print(f"Run again tomorrow to continue. {len(cache)}/{len(movies)} movies checked so far.")
        return

    # Build filtered list
    unchecked = [m for m in movies if f"{m['title'].strip()}|{m.get('year','').strip()}" not in cache]
    if unchecked:
        print(f"\n{len(unchecked)} movies still unchecked — run the script again to finish.")
        return

    filtered = []
    removed = []
    for movie in movies:
        key = f"{movie['title'].strip()}|{movie.get('year', '').strip()}"
        country = cache.get(key, "")
        if is_us_movie(country):
            filtered.append(movie)
        else:
            removed.append((movie["title"], movie.get("year", ""), country))

    print(f"\nKept: {len(filtered)}  |  Removed: {len(removed)}")
    print("\nRemoved movies (sample):")
    for title, year, country in removed[:20]:
        print(f"  {title} ({year}) — {country}")

    confirm = input(f"\nWrite filtered list ({len(filtered)} movies) to {OUTPUT_FILE}? [y/N] ").strip().lower()
    if confirm == "y":
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(filtered, f, indent=4, ensure_ascii=False)
        print(f"Done. Saved {len(filtered)} US movies to {OUTPUT_FILE}.")
    else:
        print("Aborted — no changes made.")

if __name__ == "__main__":
    main()

"""
Filters movieList.json to only include movies with US theatrical releases using TMDB API.
Saves progress to a checkpoint file so it can be resumed across multiple runs.

TMDB release types:
  1 = Premiere
  2 = Theatrical (limited)
  3 = Theatrical
  4 = Digital (streaming)
  5 = Physical
  6 = TV
"""

import json
import time
import os
import urllib.request
import urllib.parse

TMDB_API_KEY = "f50a7cd62fa00a24f29a0e3ebb12c130"
INPUT_FILE = "movieList.json"
OUTPUT_FILE = "movieList.json"
CHECKPOINT_FILE = "tmdb_theatrical_cache.json"

# Movies before this year predate major streaming originals — keep without checking
STREAMING_ERA_START = 2014


def search_tmdb_id(title, year):
    """Return TMDB movie ID for a given title/year, or None if not found."""
    params = urllib.parse.urlencode({
        "api_key": TMDB_API_KEY,
        "query": title.strip(),
        "language": "en-US",
        "include_adult": "false",
    })
    if year:
        params += f"&year={year.strip()}"

    url = f"https://api.themoviedb.org/3/search/movie?{params}"
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            results = data.get("results", [])
            if results:
                return results[0]["id"]
            # Retry without year if nothing found
            if year:
                params2 = urllib.parse.urlencode({
                    "api_key": TMDB_API_KEY,
                    "query": title.strip(),
                    "language": "en-US",
                })
                url2 = f"https://api.themoviedb.org/3/search/movie?{params2}"
                with urllib.request.urlopen(url2, timeout=10) as resp2:
                    data2 = json.loads(resp2.read().decode("utf-8"))
                    results2 = data2.get("results", [])
                    if results2:
                        return results2[0]["id"]
    except Exception as e:
        print(f"  Error searching '{title}': {e}")
        return "ERROR"
    return None


def get_us_release_types(movie_id):
    """Return set of US release type codes for a TMDB movie ID."""
    url = f"https://api.themoviedb.org/3/movie/{movie_id}/release_dates?api_key={TMDB_API_KEY}"
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            for entry in data.get("results", []):
                if entry.get("iso_3166_1") == "US":
                    return {rd["type"] for rd in entry.get("release_dates", [])}
    except Exception as e:
        print(f"  Error getting release dates for ID {movie_id}: {e}")
        return None
    return set()


def has_theatrical_release(title, year):
    """
    Returns 'yes', 'no', or 'unknown'.
    'unknown' means the API failed — caller should keep the movie to avoid false removal.
    """
    try:
        if int(year.strip()) < STREAMING_ERA_START:
            return "yes"
    except (ValueError, AttributeError):
        pass

    movie_id = search_tmdb_id(title, year)
    if movie_id == "ERROR":
        return "unknown"
    if movie_id is None:
        return "unknown"  # Not in TMDB — don't discard

    release_types = get_us_release_types(movie_id)
    if release_types is None:
        return "unknown"

    # Type 2 = Theatrical (limited), Type 3 = Theatrical
    return "yes" if (release_types & {2, 3}) else "no"


def main():
    with open(INPUT_FILE, encoding="utf-8") as f:
        movies = json.load(f)
    print(f"Loaded {len(movies)} movies.")

    if os.path.exists(CHECKPOINT_FILE):
        with open(CHECKPOINT_FILE, encoding="utf-8") as f:
            cache = json.load(f)
        print(f"Resuming — {len(cache)} movies already checked.")
    else:
        cache = {}

    checked = 0
    errors = 0
    consecutive_errors = 0

    for movie in movies:
        key = f"{movie['title'].strip()}|{movie.get('year', '').strip()}"
        if key in cache:
            continue

        year = movie.get("year", "")
        try:
            if int(year.strip()) < STREAMING_ERA_START:
                cache[key] = "yes"
                continue
        except (ValueError, AttributeError):
            pass

        result = has_theatrical_release(movie["title"], year)
        cache[key] = result

        if result == "unknown":
            errors += 1
            consecutive_errors += 1
        else:
            consecutive_errors = 0

        checked += 1

        if checked % 50 == 0:
            with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
                json.dump(cache, f, indent=2)
            print(f"  Progress: {len(cache)}/{len(movies)} checked ({errors} unknowns)")

        if consecutive_errors > 10:
            print("Too many consecutive errors — may have hit API rate limit. Progress saved.")
            with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
                json.dump(cache, f, indent=2)
            return

        time.sleep(0.15)  # ~6 req/sec (2 calls per movie = ~3 movies/sec)

    with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2)

    unchecked = [m for m in movies if f"{m['title'].strip()}|{m.get('year','').strip()}" not in cache]
    if unchecked:
        print(f"\n{len(unchecked)} movies still unchecked — run the script again to finish.")
        return

    theatrical = []
    streaming_only = []
    for movie in movies:
        key = f"{movie['title'].strip()}|{movie.get('year', '').strip()}"
        result = cache.get(key, "unknown")
        if result in ("yes", "unknown"):
            theatrical.append(movie)
        else:
            streaming_only.append(movie)

    print(f"\nTheatrical (kept): {len(theatrical)}  |  Streaming-only (removed): {len(streaming_only)}")
    print("\nRemoved movies (sample):")
    for m in streaming_only[:20]:
        print(f"  {m['title']} ({m.get('year', '?')})")

    confirm = input(f"\nWrite filtered list ({len(theatrical)} movies) to {OUTPUT_FILE}? [y/N] ").strip().lower()
    if confirm == "y":
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(theatrical, f, indent=4, ensure_ascii=False)
        print(f"Done. Saved {len(theatrical)} movies to {OUTPUT_FILE}.")
    else:
        print("Aborted — no changes made.")


if __name__ == "__main__":
    main()

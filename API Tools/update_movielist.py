import json
import os
import shutil
import time
import requests

# ── CONFIGURATION ─────────────────────────────────────────────────────────────
API_KEY = "f50a7cd62fa00a24f29a0e3ebb12c130"
PAGES_TO_FETCH = 30

_SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_SCRIPT_DIR)

MASTER_FILE = os.path.join(_PROJECT_ROOT, "Assets", "Movies", "movieList.json")
BACKUP_FILE = os.path.join(_PROJECT_ROOT, "Assets", "Movies", "movieList_backup.json")

# ── HELPERS ───────────────────────────────────────────────────────────────────
def load_json(path):
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"  Warning: could not read {path}: {e}")
        return []

def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

def fingerprint(item):
    title    = item.get("title",    "").strip().lower()
    year     = str(item.get("year", "")).strip()
    category = item.get("category", "movies").strip().lower()
    return f"{title}|{year}|{category}"

# ── STEP 1: FETCH FROM TMDB ───────────────────────────────────────────────────
def fetch_movies():
    print("\n── STEP 1: FETCHING FROM TMDB ───────────────────────────────────────")
    print("  Mode: now playing in theatres")

    genre_map = {}
    try:
        r = requests.get(f"https://api.themoviedb.org/3/genre/movie/list?api_key={API_KEY}")
        for g in r.json().get("genres", []):
            genre_map[g["id"]] = g["name"]
        print(f"  Genre list loaded ({len(genre_map)} genres).")
    except Exception as e:
        print(f"  Warning: could not fetch genres: {e}")

    fetched = []
    for page in range(1, PAGES_TO_FETCH + 1):
        print(f"\n  Page {page}/{PAGES_TO_FETCH}")
        try:
            resp = requests.get(
                f"https://api.themoviedb.org/3/movie/now_playing"
                f"?api_key={API_KEY}&language=en-US&page={page}"
            )
            data = resp.json()
            total_pages = data.get("total_pages", 1)
            results = data.get("results", [])
            if not results or page > total_pages:
                print(f"  Reached last page ({total_pages}). Stopping early.")
                break

            for item in results:
                print(f"    Fetching director for: {item['title']}")

                director = "Unknown"
                try:
                    cred_resp = requests.get(
                        f"https://api.themoviedb.org/3/movie/{item['id']}/credits?api_key={API_KEY}"
                    )
                    crew = cred_resp.json().get("crew", [])
                    d = next((m for m in crew if m["job"] == "Director"), None)
                    if d:
                        director = d["name"]
                except Exception:
                    pass

                genre_names = [genre_map.get(gid, "Unknown") for gid in item.get("genre_ids", [])]

                fetched.append({
                    "title":       item["title"],
                    "year":        item.get("release_date", "")[:4],
                    "description": item.get("overview", ""),
                    "genre":       ", ".join(genre_names),
                    "director":    director,
                    "poster":      f"https://image.tmdb.org/t/p/w500{item.get('poster_path') or ''}",
                    "category":    "movies",
                })

                time.sleep(0.1)

        except Exception as e:
            print(f"  Error on page {page}: {e}")

    print(f"\n  Fetched {len(fetched)} movies total.")
    return fetched

# ── STEP 2: BACKUP ────────────────────────────────────────────────────────────
def create_backup():
    if not os.path.exists(MASTER_FILE):
        print("  No master file yet — skipping backup.")
        return True
    try:
        shutil.copy2(MASTER_FILE, BACKUP_FILE)
        print(f"  ✔ Backup saved to {BACKUP_FILE}")
        return True
    except Exception as e:
        print(f"  ✖ Backup failed: {e}")
        return False

# ── STEP 3: DEDUP THE MASTER LIST ─────────────────────────────────────────────
def dedup(movies):
    seen, unique, dupes = set(), [], 0
    for item in movies:
        fp = fingerprint(item)
        if fp in seen:
            dupes += 1
        else:
            seen.add(fp)
            unique.append(item)
    return unique, dupes

# ── STEP 4: MERGE NEW MOVIES IN ───────────────────────────────────────────────
def merge(master, new_items):
    existing = {fingerprint(item) for item in master}
    added = skipped = 0
    for item in new_items:
        fp = fingerprint(item)
        if fp in existing:
            skipped += 1
        else:
            master.append(item)
            existing.add(fp)
            added += 1
    return master, added, skipped

# ── MAIN ──────────────────────────────────────────────────────────────────────
def run():
    # 1. Fetch
    new_movies = fetch_movies()
    if not new_movies:
        print("Nothing fetched. Exiting.")
        return

    # 2. Backup
    print("\n── STEP 2: BACKUP ───────────────────────────────────────────────────")
    if not create_backup():
        answer = input("  Backup failed. Continue anyway? (y/n): ")
        if answer.strip().lower() != "y":
            print("  Aborted.")
            return

    # 3. Load master and dedup it
    print("\n── STEP 3: DEDUP MASTER LIST ────────────────────────────────────────")
    master = load_json(MASTER_FILE)
    print(f"  Loaded {len(master)} items from master.")
    master, dupes_removed = dedup(master)
    if dupes_removed:
        print(f"  ✔ Removed {dupes_removed} duplicate(s) from master list.")
    else:
        print("  ✔ No duplicates found in master list.")

    # 4. Merge
    print("\n── STEP 4: MERGING ──────────────────────────────────────────────────")
    master, added, skipped = merge(master, new_movies)

    # 5. Save
    save_json(MASTER_FILE, master)

    print(f"""
── DONE ─────────────────────────────────────────────────────────────
  Added:        {added} new movie(s)
  Skipped:      {skipped} duplicate(s) from this fetch
  Master total: {len(master)} movies
  Saved to:     {MASTER_FILE}
─────────────────────────────────────────────────────────────────────""")

if __name__ == "__main__":
    run()

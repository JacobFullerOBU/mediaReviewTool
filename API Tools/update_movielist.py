import json
import os
import shutil
import time
import requests

# ── CONFIGURATION ─────────────────────────────────────────────────────────────
API_KEY  = "f50a7cd62fa00a24f29a0e3ebb12c130"
PAGES_TO_FETCH = 30
CHECKPOINT_MAX_AGE_HOURS = 12   # auto-discard checkpoints older than this

_SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_SCRIPT_DIR)

MASTER_FILE     = os.path.join(_PROJECT_ROOT, "Assets", "Movies", "movieList.json")
BACKUP_FILE     = os.path.join(_PROJECT_ROOT, "Assets", "Movies", "movieList_backup.json")
CHECKPOINT_FILE = os.path.join(_SCRIPT_DIR, "fetch_checkpoint.json")

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

# ── CHECKPOINT ────────────────────────────────────────────────────────────────
def load_checkpoint():
    if not os.path.exists(CHECKPOINT_FILE):
        return set(), []
    try:
        with open(CHECKPOINT_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)

        saved_at = data.get("saved_at", 0)
        age_hours = (time.time() - saved_at) / 3600
        if age_hours > CHECKPOINT_MAX_AGE_HOURS:
            print(f"  Checkpoint is {age_hours:.1f}h old (limit {CHECKPOINT_MAX_AGE_HOURS}h) — discarding.")
            clear_checkpoint()
            return set(), []

        processed = set(data.get("processed_ids", []))
        fetched   = data.get("fetched", [])
        age_min   = age_hours * 60
        print(f"  ✔ Resuming from checkpoint ({age_min:.0f} min old): "
              f"{len(processed)} IDs processed, {len(fetched)} movie(s) queued.")
        return processed, fetched
    except Exception as e:
        print(f"  Warning: could not read checkpoint ({e}). Starting fresh.")
        return set(), []

def save_checkpoint(processed_ids, fetched):
    try:
        with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
            json.dump({"processed_ids": list(processed_ids),
                       "fetched": fetched,
                       "saved_at": time.time()}, f)
    except Exception as e:
        print(f"  Warning: could not save checkpoint: {e}")

def clear_checkpoint():
    try:
        if os.path.exists(CHECKPOINT_FILE):
            os.remove(CHECKPOINT_FILE)
            print("  ✔ Checkpoint cleared.")
    except Exception as e:
        print(f"  Warning: could not clear checkpoint: {e}")

# ── STEP 1: FETCH FROM TMDB ───────────────────────────────────────────────────
def fetch_movies(existing_fingerprints):
    print("\n── FETCHING FROM TMDB ───────────────────────────────────────────────")
    print("  Mode: now playing in theatres")
    print(f"  Checkpoint file: {CHECKPOINT_FILE}")

    processed_ids, fetched = load_checkpoint()

    genre_map = {}
    try:
        r = requests.get(f"https://api.themoviedb.org/3/genre/movie/list?api_key={API_KEY}")
        for g in r.json().get("genres", []):
            genre_map[g["id"]] = g["name"]
        print(f"  Genre list loaded ({len(genre_map)} genres).")
    except Exception as e:
        print(f"  Warning: could not fetch genres: {e}")

    skipped_existing = skipped_checkpoint = 0
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
                title   = item["title"]
                year    = item.get("release_date", "")[:4]
                tmdb_id = item["id"]
                fp      = f"{title.strip().lower()}|{year}|movies"

                if fp in existing_fingerprints:
                    print(f"    Skipping (already in master): {title}")
                    skipped_existing += 1
                    continue

                if tmdb_id in processed_ids:
                    print(f"    Skipping (checkpoint): {title}")
                    skipped_checkpoint += 1
                    continue

                print(f"    Fetching director for: {title}")

                director = "Unknown"
                try:
                    cred_resp = requests.get(
                        f"https://api.themoviedb.org/3/movie/{tmdb_id}/credits?api_key={API_KEY}"
                    )
                    crew = cred_resp.json().get("crew", [])
                    d = next((m for m in crew if m["job"] == "Director"), None)
                    if d:
                        director = d["name"]
                except Exception:
                    pass

                genre_names = [genre_map.get(gid, "Unknown") for gid in item.get("genre_ids", [])]

                fetched.append({
                    "title":       title,
                    "year":        year,
                    "description": item.get("overview", ""),
                    "genre":       ", ".join(genre_names),
                    "director":    director,
                    "poster":      f"https://image.tmdb.org/t/p/w500{item.get('poster_path') or ''}",
                    "category":    "movies",
                })
                processed_ids.add(tmdb_id)
                save_checkpoint(processed_ids, fetched)
                print(f"      ✔ Checkpoint saved ({len(processed_ids)} processed, {len(fetched)} queued)")
                time.sleep(0.1)

        except Exception as e:
            print(f"  Error on page {page}: {e}")

    print(f"\n  New: {len(fetched)}  |  Skipped (master): {skipped_existing}  |  Skipped (checkpoint): {skipped_checkpoint}")
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
    # 1. Load master and dedup so fetch can skip known movies
    print("\n── LOAD & DEDUP MASTER LIST ─────────────────────────────────────────")
    master = load_json(MASTER_FILE)
    print(f"  Loaded {len(master)} items from master.")
    master, dupes_removed = dedup(master)
    if dupes_removed:
        print(f"  ✔ Removed {dupes_removed} duplicate(s) from master list.")
    else:
        print("  ✔ No duplicates found in master list.")
    existing_fingerprints = {fingerprint(item) for item in master}

    # 2. Fetch (skips master-known movies and checkpoint-processed IDs)
    new_movies = fetch_movies(existing_fingerprints)
    if not new_movies:
        print("No new movies to add. Exiting.")
        clear_checkpoint()
        return

    # 3. Backup
    print("\n── BACKUP ───────────────────────────────────────────────────────────")
    if not create_backup():
        answer = input("  Backup failed. Continue anyway? (y/n): ")
        if answer.strip().lower() != "y":
            print("  Aborted.")
            return

    # 4. Merge
    print("\n── MERGING ──────────────────────────────────────────────────────────")
    master, added, skipped = merge(master, new_movies)

    # 5. Save — clear checkpoint only after a confirmed successful write
    print("\n── SAVING ───────────────────────────────────────────────────────────")
    try:
        save_json(MASTER_FILE, master)
        print(f"  ✔ Saved to {MASTER_FILE}")
    except Exception as e:
        print(f"  ✖ Save failed: {e}")
        print("  Checkpoint kept — re-run to retry.")
        return

    clear_checkpoint()

    print(f"""
── DONE ─────────────────────────────────────────────────────────────
  Added:        {added} new movie(s)
  Skipped:      {skipped} duplicate(s) from this fetch
  Master total: {len(master)} movies
─────────────────────────────────────────────────────────────────────""")

if __name__ == "__main__":
    run()

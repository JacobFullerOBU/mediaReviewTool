import json
import os
import shutil
import time
import requests

# ── CONFIGURATION ─────────────────────────────────────────────────────────────
API_KEY  = "f50a7cd62fa00a24f29a0e3ebb12c130"
PAGES_TO_FETCH = 30
CHECKPOINT_MAX_AGE_HOURS = 12

_SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(os.path.dirname(_SCRIPT_DIR))

MASTER_FILE     = os.path.join(_PROJECT_ROOT, "Assets", "TV Shows", "tvList.json")
BACKUP_FILE     = os.path.join(_PROJECT_ROOT, "Assets", "TV Shows", "tvList_backup.json")
CHECKPOINT_FILE = os.path.join(_SCRIPT_DIR, "tv_fetch_checkpoint.json")

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
    category = item.get("category", "tv").strip().lower()
    return f"{title}|{year}|{category}"

# ── CHECKPOINT ────────────────────────────────────────────────────────────────
def load_checkpoint():
    if not os.path.exists(CHECKPOINT_FILE):
        return set(), []
    try:
        with open(CHECKPOINT_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)

        saved_at  = data.get("saved_at", 0)
        age_hours = (time.time() - saved_at) / 3600
        if age_hours > CHECKPOINT_MAX_AGE_HOURS:
            print(f"  Checkpoint is {age_hours:.1f}h old (limit {CHECKPOINT_MAX_AGE_HOURS}h) — discarding.")
            clear_checkpoint()
            return set(), []

        processed = set(data.get("processed_ids", []))
        fetched   = data.get("fetched", [])
        age_min   = age_hours * 60
        print(f"  ✔ Resuming from checkpoint ({age_min:.0f} min old): "
              f"{len(processed)} IDs processed, {len(fetched)} show(s) queued.")
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
def fetch_shows(existing_fingerprints):
    print("\n── FETCHING FROM TMDB ───────────────────────────────────────────────")
    print("  Mode: currently on the air")
    print(f"  Checkpoint file: {CHECKPOINT_FILE}")

    processed_ids, fetched = load_checkpoint()

    genre_map = {}
    try:
        r = requests.get(f"https://api.themoviedb.org/3/genre/tv/list?api_key={API_KEY}")
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
                f"https://api.themoviedb.org/3/tv/on_the_air"
                f"?api_key={API_KEY}&language=en-US&page={page}"
            )
            data = resp.json()
            total_pages = data.get("total_pages", 1)
            results = data.get("results", [])
            if not results or page > total_pages:
                print(f"  Reached last page ({total_pages}). Stopping early.")
                break

            for item in results:
                title   = item.get("name", "")
                year    = item.get("first_air_date", "")[:4]
                tmdb_id = item["id"]
                fp      = f"{title.strip().lower()}|{year}|tv"

                if fp in existing_fingerprints:
                    print(f"    Skipping (already in master): {title}")
                    skipped_existing += 1
                    continue

                if tmdb_id in processed_ids:
                    print(f"    Skipping (checkpoint): {title}")
                    skipped_checkpoint += 1
                    continue

                print(f"    Fetching details for: {title}")

                creator = "Unknown"
                try:
                    detail_resp = requests.get(
                        f"https://api.themoviedb.org/3/tv/{tmdb_id}?api_key={API_KEY}"
                    )
                    detail = detail_resp.json()
                    creators = detail.get("created_by", [])
                    if creators:
                        creator = ", ".join(c["name"] for c in creators)
                except Exception:
                    pass

                genre_names = [genre_map.get(gid, "Unknown") for gid in item.get("genre_ids", [])]

                fetched.append({
                    "title":       title,
                    "year":        year,
                    "description": item.get("overview", ""),
                    "genre":       ", ".join(genre_names),
                    "creator":     creator,
                    "poster":      f"https://image.tmdb.org/t/p/w500{item.get('poster_path') or ''}",
                    "category":    "tv",
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

# ── STEP 3: DEDUP ─────────────────────────────────────────────────────────────
def dedup(shows):
    seen, unique, dupes = set(), [], 0
    for item in shows:
        fp = fingerprint(item)
        if fp in seen:
            dupes += 1
        else:
            seen.add(fp)
            unique.append(item)
    return unique, dupes

# ── STEP 4: MERGE ─────────────────────────────────────────────────────────────
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
    # 1. Load master and dedup so fetch can skip known shows
    print("\n── LOAD & DEDUP MASTER LIST ─────────────────────────────────────────")
    master = load_json(MASTER_FILE)
    print(f"  Loaded {len(master)} items from master.")
    master, dupes_removed = dedup(master)
    if dupes_removed:
        print(f"  ✔ Removed {dupes_removed} duplicate(s) from master list.")
    else:
        print("  ✔ No duplicates found in master list.")
    existing_fingerprints = {fingerprint(item) for item in master}

    # 2. Fetch (skips master-known shows and checkpoint-processed IDs)
    new_shows = fetch_shows(existing_fingerprints)
    if not new_shows:
        print("No new shows to add. Exiting.")
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
    master, added, skipped = merge(master, new_shows)

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
  Added:        {added} new show(s)
  Skipped:      {skipped} duplicate(s) from this fetch
  Master total: {len(master)} shows
─────────────────────────────────────────────────────────────────────""")

if __name__ == "__main__":
    run()

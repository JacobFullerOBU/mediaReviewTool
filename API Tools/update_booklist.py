import json
import os
import shutil
import time
import requests

# ── CONFIGURATION ─────────────────────────────────────────────────────────────
API_KEY = "AIzaSyB6vCAjCO_wFlAWO2h9kgYnmRrIfXxq8pA"

# Subjects to search — 40 books fetched per subject (Google Books max per request)
SUBJECTS = [
    "fiction", "mystery", "romance", "fantasy", "thriller",
    "biography", "science fiction", "historical fiction",
    "horror", "self help", "nonfiction", "young adult", "classics",
]
RESULTS_PER_SUBJECT  = 40   # Google Books API max per request
CHECKPOINT_MAX_AGE_HOURS = 12

_SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_SCRIPT_DIR)

MASTER_FILE     = os.path.join(_PROJECT_ROOT, "Assets", "Books", "books.json")
BACKUP_FILE     = os.path.join(_PROJECT_ROOT, "Assets", "Books", "books_backup.json")
CHECKPOINT_FILE = os.path.join(_SCRIPT_DIR, "books_fetch_checkpoint.json")

BASE_URL = "https://www.googleapis.com/books/v1/volumes"

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
    category = item.get("category", "books").strip().lower()
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
              f"{len(processed)} IDs processed, {len(fetched)} book(s) queued.")
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

# ── STEP 1: FETCH FROM GOOGLE BOOKS ──────────────────────────────────────────
def fetch_books(existing_fingerprints):
    print("\n── FETCHING FROM GOOGLE BOOKS ───────────────────────────────────────")
    print(f"  Checkpoint file: {CHECKPOINT_FILE}")

    processed_ids, fetched = load_checkpoint()

    skipped_existing = skipped_checkpoint = 0
    for subject in SUBJECTS:
        print(f"\n  Subject: {subject}")
        try:
            resp = requests.get(
                BASE_URL,
                params={
                    "q":          f"subject:{subject}",
                    "orderBy":    "relevance",
                    "maxResults": RESULTS_PER_SUBJECT,
                    "printType":  "books",
                    "langRestrict": "en",
                    "key":        API_KEY,
                },
                timeout=15,
            )
            resp.raise_for_status()
            items = resp.json().get("items", [])
            if not items:
                print(f"  No results for '{subject}'.")
                continue

            for item in items:
                volume_id   = item.get("id", "")
                volume_info = item.get("volumeInfo", {})

                title = volume_info.get("title", "").strip()
                if not title:
                    continue

                published = volume_info.get("publishedDate", "")
                year      = published[:4] if published else ""

                fp = f"{title.lower()}|{year}|books"

                if fp in existing_fingerprints:
                    print(f"    Skipping (already in master): {title}")
                    skipped_existing += 1
                    continue

                if volume_id in processed_ids:
                    print(f"    Skipping (checkpoint): {title}")
                    skipped_checkpoint += 1
                    continue

                print(f"    Adding: {title}")

                authors     = volume_info.get("authors", [])
                author      = ", ".join(authors)

                categories  = volume_info.get("categories", [subject.title()])
                genre       = ", ".join(categories[:3])

                description = volume_info.get("description", "")

                image_links = volume_info.get("imageLinks", {})
                poster      = (image_links.get("thumbnail") or
                               image_links.get("smallThumbnail") or "")
                # Upgrade to HTTPS if needed
                poster = poster.replace("http://", "https://")

                fetched.append({
                    "title":       title,
                    "year":        year,
                    "description": description,
                    "genre":       genre,
                    "author":      author,
                    "poster":      poster,
                    "category":    "books",
                })
                processed_ids.add(volume_id)
                save_checkpoint(processed_ids, fetched)
                print(f"      ✔ Checkpoint saved ({len(processed_ids)} processed, {len(fetched)} queued)")
                time.sleep(0.1)

        except Exception as e:
            print(f"  Error on subject '{subject}': {e}")

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
def dedup(books):
    seen, unique, dupes = set(), [], 0
    for item in books:
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
    # 1. Load master and dedup so fetch can skip known books
    print("\n── LOAD & DEDUP MASTER LIST ─────────────────────────────────────────")
    master = load_json(MASTER_FILE)
    print(f"  Loaded {len(master)} items from master.")
    master, dupes_removed = dedup(master)
    if dupes_removed:
        print(f"  ✔ Removed {dupes_removed} duplicate(s) from master list.")
    else:
        print("  ✔ No duplicates found in master list.")
    existing_fingerprints = {fingerprint(item) for item in master}

    # 2. Fetch (skips master-known books and checkpoint-processed IDs)
    new_books = fetch_books(existing_fingerprints)
    if not new_books:
        print("No new books to add. Exiting.")
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
    master, added, skipped = merge(master, new_books)

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
  Added:        {added} new book(s)
  Skipped:      {skipped} duplicate(s) from this fetch
  Master total: {len(master)} books
─────────────────────────────────────────────────────────────────────""")

if __name__ == "__main__":
    run()

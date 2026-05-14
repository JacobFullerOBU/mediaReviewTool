import json
import os
import shutil
import time
import requests

# ── CONFIGURATION ─────────────────────────────────────────────────────────────
# Open Library trending doesn't paginate — fetch from multiple periods instead
TREND_PERIODS    = ["daily", "weekly", "monthly", "yearly"]
RESULTS_PER_PAGE = 100   # books per period
CHECKPOINT_MAX_AGE_HOURS = 12

_SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_SCRIPT_DIR)

MASTER_FILE     = os.path.join(_PROJECT_ROOT, "Assets", "Books", "books.json")
BACKUP_FILE     = os.path.join(_PROJECT_ROOT, "Assets", "Books", "books_backup.json")
CHECKPOINT_FILE = os.path.join(_SCRIPT_DIR, "books_fetch_checkpoint.json")

BASE_URL   = "https://openlibrary.org"
COVERS_URL = "https://covers.openlibrary.org/b/id"

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

# ── STEP 1: FETCH FROM OPEN LIBRARY ──────────────────────────────────────────
def fetch_books(existing_fingerprints):
    print("\n── FETCHING FROM OPEN LIBRARY ───────────────────────────────────────")
    print("  Mode: weekly trending books")
    print(f"  Checkpoint file: {CHECKPOINT_FILE}")

    processed_ids, fetched = load_checkpoint()

    skipped_existing = skipped_checkpoint = 0
    for period in TREND_PERIODS:
        print(f"\n  Period: {period}")
        try:
            resp = requests.get(
                f"{BASE_URL}/trending/{period}.json?limit={RESULTS_PER_PAGE}",
                headers={"User-Agent": "MediaReviewTool/1.0"}
            )
            if "application/json" not in resp.headers.get("Content-Type", ""):
                print(f"  Non-JSON response for '{period}' — skipping.")
                continue
            works = resp.json().get("works", [])
            if not works:
                print(f"  No results for '{period}'.")
                continue

            for work in works:
                work_key = work.get("key", "")
                title    = work.get("title", "").strip()
                year     = str(work.get("first_publish_year", "")).strip()

                if not title:
                    continue

                fp = f"{title.lower()}|{year}|books"

                if fp in existing_fingerprints:
                    print(f"    Skipping (already in master): {title}")
                    skipped_existing += 1
                    continue

                if work_key in processed_ids:
                    print(f"    Skipping (checkpoint): {title}")
                    skipped_checkpoint += 1
                    continue

                print(f"    Fetching details for: {title}")

                # Fetch work detail page for description
                description = ""
                try:
                    detail = requests.get(
                        f"{BASE_URL}{work_key}.json",
                        headers={"User-Agent": "MediaReviewTool/1.0"}
                    ).json()
                    desc = detail.get("description", "")
                    if isinstance(desc, dict):
                        description = desc.get("value", "")
                    elif isinstance(desc, str):
                        description = desc
                except Exception:
                    pass

                authors = work.get("author_name", [])
                author  = ", ".join(authors)

                subjects    = work.get("subject", [])[:3]
                genre       = ", ".join(subjects) if subjects else ""

                cover_id = work.get("cover_i")
                poster   = f"{COVERS_URL}/{cover_id}-M.jpg" if cover_id else ""

                fetched.append({
                    "title":       title,
                    "year":        year,
                    "description": description,
                    "genre":       genre,
                    "author":      author,
                    "poster":      poster,
                    "category":    "books",
                })
                processed_ids.add(work_key)
                save_checkpoint(processed_ids, fetched)
                print(f"      ✔ Checkpoint saved ({len(processed_ids)} processed, {len(fetched)} queued)")
                time.sleep(0.2)

        except Exception as e:
            print(f"  Error on period '{period}': {e}")

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

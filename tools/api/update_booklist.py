import json
import os
import shutil
import time
import requests

# ── CONFIGURATION ─────────────────────────────────────────────────────────────
API_KEY = "AIzaSyB6vCAjCO_wFlAWO2h9kgYnmRrIfXxq8pA"

# Fantasy and romance — uses subject: and inauthor: which Google Books actually indexes
QUERIES = [
    # ── FANTASY SUBJECTS ─────────────────────────────────────────────────
    "subject:fantasy",
    "subject:epic+fantasy",
    "subject:dark+fantasy",
    "subject:romantasy",
    'inauthor:"Gillian Flynn"',
    'inauthor:"Paula Hawkins"',
    'inauthor:"Jodi Picoult"',
    'inauthor:"Liane Moriarty"',
    'inauthor:"Lisa Jewell"',
    'inauthor:"Tana French"',
    'inauthor:"Kate Quinn"',
    'inauthor:"Lucinda Riley"',
    'inauthor:"Diane Chamberlain"',
    'inauthor:"Barbara Kingsolver"',
    'inauthor:"Amor Towles"',
    'inauthor:"Celeste Ng"',
    'inauthor:"Delia Owens"',
    'inauthor:"Elin Hilderbrand"',
    'inauthor:"Susan Mallery"',
    'inauthor:"Robyn Carr"',
    'inauthor:"Lisa Kleypas"',
    'inauthor:"Julia Quinn"',
    'inauthor:"Eloisa James"',
    'inauthor:"Nalini Singh"',
    'inauthor:"Patricia Briggs"',
    'inauthor:"Ilona Andrews"',
    'inauthor:"Brandon Sanderson"',
    'inauthor:"Patrick Rothfuss"',
    'inauthor:"Robin Hobb"',
    'inauthor:"Joe Abercrombie"',
    'inauthor:"George R.R. Martin"',
    'inauthor:"Terry Pratchett"',
    'inauthor:"Neil Gaiman"',
    'inauthor:"Ursula K. Le Guin"',
    'inauthor:"Isaac Asimov"',
    'inauthor:"Arthur C. Clarke"',
    'inauthor:"Philip K. Dick"',
    'inauthor:"Frank Herbert"',
    'inauthor:"Ray Bradbury"',
    'inauthor:"Andy Weir"',
    'inauthor:"Pierce Brown"',
    'inauthor:"Scott Lynch"',
    'inauthor:"V.E. Schwab"',
    'inauthor:"Leigh Bardugo"',
    'inauthor:"Holly Black"',
    'inauthor:"Cassandra Clare"',
    'inauthor:"Rainbow Rowell"',
    'inauthor:"John Green"',
    'inauthor:"Jenny Han"',
    'inauthor:"Jason Reynolds"',
    'inauthor:"Angie Thomas"',
    'inauthor:"Tomi Adeyemi"',
    'inauthor:"Dhonielle Clayton"',
    'inauthor:"Chimamanda Ngozi Adichie"',
    'inauthor:"Zadie Smith"',
    'inauthor:"Colson Whitehead"',
    'inauthor:"Tayari Jones"',
    'inauthor:"Ocean Vuong"',
    'inauthor:"Tommy Orange"',
    'inauthor:"Louise Erdrich"',
    'inauthor:"Amor Towles"',
    'inauthor:"Anthony Doerr"',
    'inauthor:"Khaled Hosseini"',
    'inauthor:"Gabriel Garcia Marquez"',
    'inauthor:"Isabel Allende"',
    'inauthor:"Haruki Murakami"',
    'inauthor:"Stieg Larsson"',
    'inauthor:"Jo Nesbo"',
    'inauthor:"Henning Mankell"',
    'inauthor:"Fredrik Backman"',
    'inauthor:"Jonas Jonasson"',
    'inauthor:"Michel Houellebecq"',
    'inauthor:"Karl Ove Knausgard"',
    'inauthor:"Elena Ferrante"',
    'inauthor:"Umberto Eco"',
    'inauthor:"Donna Tartt"',
    'inauthor:"Cormac McCarthy"',
    'inauthor:"Don DeLillo"',
    'inauthor:"Jonathan Franzen"',
    'inauthor:"Jeffrey Eugenides"',
    'inauthor:"Michael Connelly"',
    'inauthor:"Dennis Lehane"',
    'inauthor:"James Ellroy"',
    'inauthor:"Thomas Harris"',
    'inauthor:"Patricia Cornwell"',
    'inauthor:"Karin Slaughter"',
    'inauthor:"Lisa Gardner"',
    'inauthor:"Sandra Brown"',
    'inauthor:"Stuart Woods"',
    'inauthor:"Brad Thor"',
    'inauthor:"Vince Flynn"',
    'inauthor:"Daniel Silva"',
    'inauthor:"Nelson DeMille"',
    'inauthor:"Scott Turow"',
    'inauthor:"Lincoln Child"',
    'inauthor:"Douglas Preston"',
    'inauthor:"Matthew Reilly"',
    'inauthor:"Andy McDermott"',
    'inauthor:"Chris Ryan"',
    'inauthor:"Andy McNab"'
]
PAGES_PER_SUBJECT    = 3    # pages per query (3 × 40 = up to 120 each)
RESULTS_PER_PAGE     = 40   # Google Books API hard max per request
CHECKPOINT_MAX_AGE_HOURS = 12

_SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(os.path.dirname(_SCRIPT_DIR))  # tools/api -> tools -> project root

MASTER_FILE          = os.path.join(_PROJECT_ROOT, "Assets", "Data", "books.json")
BACKUP_FILE          = os.path.join(_PROJECT_ROOT, "Assets", "Data", "books_backup.json")
MISSING_COVERS_FILE  = os.path.join(_PROJECT_ROOT, "Assets", "Data", "books_missing_covers.json")
CHECKPOINT_FILE      = os.path.join(_SCRIPT_DIR, "books_fetch_checkpoint.json")

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
    for query in QUERIES:
        print(f"\n  Query: {query}")
        for page in range(PAGES_PER_SUBJECT):
            start_index = page * RESULTS_PER_PAGE
            print(f"    Page {page + 1}/{PAGES_PER_SUBJECT} (startIndex={start_index})")
            try:
                resp = requests.get(
                    BASE_URL,
                    params={
                        "q":            query,
                        "orderBy":      "relevance",
                        "maxResults":   RESULTS_PER_PAGE,
                        "startIndex":   start_index,
                        "printType":    "books",
                        "langRestrict": "en",
                        "key":          API_KEY,
                    },
                    timeout=15,
                )
                resp.raise_for_status()
                data       = resp.json()
                items      = data.get("items", [])
                total_items = data.get("totalItems", 0)
                if not items:
                    print(f"    No results on this page.")
                    break
                # Stop paginating if we've gone past the total available
                if start_index >= total_items:
                    break

            except Exception as e:
                print(f"    Error on query '{query}' page {page + 1}: {e}")
                break

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

                categories  = volume_info.get("categories", ["General"])
                genre       = ", ".join(categories[:3])

                description = volume_info.get("description", "")

                image_links = volume_info.get("imageLinks", {})
                poster      = (image_links.get("extraLarge") or
                               image_links.get("large") or
                               image_links.get("medium") or
                               image_links.get("small") or
                               image_links.get("thumbnail") or
                               image_links.get("smallThumbnail") or "")
                poster = poster.replace("http://", "https://")
                # Strip curl effect and request full-size cover
                if poster and "books.google.com" in poster:
                    poster = poster.replace("&zoom=1", "&zoom=0").replace("&edge=curl", "")

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

# ── COVER ART ─────────────────────────────────────────────────────────────────
def find_missing_covers(books):
    """Split books into (with_cover, missing_cover) and print a summary."""
    with_cover = [b for b in books if b.get("poster", "").strip()]
    missing    = [b for b in books if not b.get("poster", "").strip()]
    print(f"  Cover art present: {len(with_cover)}  |  Missing: {len(missing)}")
    return with_cover, missing

def _fetch_open_library_cover(title, author):
    """Return a cover URL from Open Library, or '' if not found."""
    try:
        params = {"title": title, "limit": 1}
        if author:
            params["author"] = author
        resp = requests.get(
            "https://openlibrary.org/search.json",
            params=params,
            timeout=10,
        )
        resp.raise_for_status()
        docs = resp.json().get("docs", [])
        if not docs:
            return ""
        cover_i = docs[0].get("cover_i")
        if cover_i:
            return f"https://covers.openlibrary.org/b/id/{cover_i}-L.jpg"
    except Exception:
        pass
    return ""

def fill_missing_covers(books):
    """
    For books without a poster, try Open Library.
    Returns (updated_books, still_missing) where still_missing are written
    to MISSING_COVERS_FILE for manual review.
    """
    print("\n── FILLING MISSING COVERS (Open Library) ────────────────────────────")
    _, missing = find_missing_covers(books)
    if not missing:
        print("  Nothing to do — all books have cover art.")
        return books, []

    filled = still_missing = 0
    book_index = {id(b): i for i, b in enumerate(books)}

    for book in missing:
        title  = book.get("title", "")
        author = book.get("author", "")
        print(f"  Trying Open Library: {title} …", end=" ", flush=True)
        url = _fetch_open_library_cover(title, author)
        if url:
            books[book_index[id(book)]]["poster"] = url
            print(f"✔")
            filled += 1
        else:
            print("✖ not found")
            still_missing += 1
        time.sleep(0.2)

    print(f"\n  Filled: {filled}  |  Still missing: {still_missing}")

    _, remaining_missing = find_missing_covers(books)
    if remaining_missing:
        save_json(MISSING_COVERS_FILE, remaining_missing)
        print(f"  ✔ Missing-cover list saved to {MISSING_COVERS_FILE}")

    return books, remaining_missing

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

    # 5. Fill missing cover art, save stragglers for manual review
    master, _ = fill_missing_covers(master)

    # 6. Save — clear checkpoint only after a confirmed successful write
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

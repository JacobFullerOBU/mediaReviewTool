import json
import os
import shutil # Needed for backup

# --- CONFIGURATION ---
TARGET_FILE = 'Assets/Movies/movieList.json'     # The file to edit
BACKUP_FILE = 'movieList_backup.json' # Where to save the original just in case
REMOVED_LOG = 'removed_items.json'    # Log of what got deleted

# 1. FILTER: NON-ENGLISH CHARACTERS
REMOVE_FOREIGN_CHARACTERS = True

# 2. FILTER: EXPLICIT / UNWANTED KEYWORDS (Case Insensitive)
BAD_KEYWORDS = [
    "xxx", "porn", "erotic", "hentai", "nude", "sex", "uncensored","adultery", "fetish","bdsm", "bondage", "voyeur", "incest",
    "infidelity", "prostitution", "striptease", "swimsuit", "lingerie", "topless", "bottomless", "naked", "bareback", "masturbation", "orgy", "threesome", "foursome"
]

# 3. FILTER: UNWANTED GENRES
BAD_GENRES = [
    "Adult", "Erotic"
]

def load_json(filename):
    if not os.path.exists(filename): return []
    with open(filename, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(filename, data):
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

def is_english_text(text):
    try:
        text.encode('latin-1')
        return True
    except UnicodeEncodeError:
        return False

def clean_database():
    print(f"--- STARTING DIRECT CLEANUP OF {TARGET_FILE} ---")
    
    data = load_json(TARGET_FILE)
    if not data:
        print("File not found or empty.")
        return

    # --- STEP 1: SAFETY BACKUP ---
    print(f"Creating safety backup at {BACKUP_FILE}...")
    shutil.copy2(TARGET_FILE, BACKUP_FILE)

    kept_items = []
    removed_items = []

    count_foreign = 0
    count_keyword = 0
    count_genre = 0

    # --- STEP 2: FILTERING ---
    for item in data:
        title = item.get('title', '').strip()
        desc = item.get('description', '').lower()
        genre = item.get('genre', '').lower()
        
        # Check 1: Foreign Characters
        if REMOVE_FOREIGN_CHARACTERS and not is_english_text(title):
            item['reason'] = "Foreign Characters"
            removed_items.append(item)
            count_foreign += 1
            continue

        # Check 2: Keywords
        found_bad = False
        for word in BAD_KEYWORDS:
            if word in title.lower() or word in desc:
                item['reason'] = f"Keyword: {word}"
                removed_items.append(item)
                count_keyword += 1
                found_bad = True
                break
        if found_bad: continue

        # Check 3: Genres
        found_bad_genre = False
        for bad_g in BAD_GENRES:
            if bad_g.lower() in genre:
                item['reason'] = f"Genre: {bad_g}"
                removed_items.append(item)
                count_genre += 1
                found_bad_genre = True
                break
        if found_bad_genre: continue

        kept_items.append(item)

    # --- STEP 3: OVERWRITE ---
    save_json(TARGET_FILE, kept_items)
    save_json(REMOVED_LOG, removed_items)

    print(f"\n--- SUCCESS ---")
    print(f"Updated {TARGET_FILE} directly.")
    print(f"Original Size: {len(data)} -> New Size: {len(kept_items)}")
    print(f"Removed {len(removed_items)} items. (See {REMOVED_LOG} for details)")

if __name__ == "__main__":
    clean_database()
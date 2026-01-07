import json
import os
import shutil

# --- CONFIGURATION ---
FILE_TO_CLEAN = 'Assets\Movies\movieList.json'
BACKUP_FILE = 'movieList_backup_deduped.json'

def load_json(filename):
    if not os.path.exists(filename): return []
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return []

def save_json(filename, data):
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

def clean_duplicates():
    print(f"--- SCANNING FOR DUPLICATES IN {FILE_TO_CLEAN} ---")
    
    data = load_json(FILE_TO_CLEAN)
    if not data:
        print("File is empty or missing.")
        return

    # 1. Create Backup
    shutil.copy2(FILE_TO_CLEAN, BACKUP_FILE)
    print(f"✔ Backup created: {BACKUP_FILE}\n")

    unique_items = []
    seen_fingerprints = set()
    duplicates_found = 0

    # 2. Scan Logic
    for item in data:
        # Create a unique ID based on Title, Year, and Category
        # We strip whitespace and lowercase the title to catch " The Matrix " vs "The Matrix"
        title = item.get('title', '').strip().lower()
        year = str(item.get('year', '')).strip()
        category = item.get('category', 'movies').strip().lower()

        fingerprint = f"{title}|{year}|{category}"

        if fingerprint in seen_fingerprints:
            # This is a duplicate!
            duplicates_found += 1
            print(f" 🗑 Removing Duplicate: '{item.get('title')}' ({item.get('year')})")
        else:
            # This is new, keep it
            seen_fingerprints.add(fingerprint)
            unique_items.append(item)

    # 3. Save Result
    if duplicates_found > 0:
        save_json(FILE_TO_CLEAN, unique_items)
        print(f"\n--- SUCCESS ---")
        print(f"Removed {duplicates_found} duplicate items.")
        print(f"Clean file saved with {len(unique_items)} items.")
    else:
        print("\n✅ Good news! No duplicates were found.")

if __name__ == "__main__":
    clean_duplicates()
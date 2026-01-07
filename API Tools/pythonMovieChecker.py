import json
import os
import shutil

# --- CONFIGURATION ---
MAIN_FILE = 'Assets\Movies\movieList.json'
NEEDS_WORK_FILE = 'needs_work.json'
BACKUP_FILE = 'movieList_backup_before_split.json'

# The fields that MUST be present and not "Unknown"
REQUIRED_KEYS = [
    "title", 
    "year", 
    "description", 
    "genre", 
    "director", 
    "poster", 
    "category"
]

def load_json(filename):
    if not os.path.exists(filename):
        return []
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return []

def save_json(filename, data):
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

def separate_files():
    print(f"--- STARTING SEPARATION ---\n")
    
    # 1. Load Data
    all_data = load_json(MAIN_FILE)
    if not all_data:
        print(f"Could not find data in {MAIN_FILE}")
        return

    # 2. Create Backup (Crucial since we are modifying the main file)
    shutil.copy2(MAIN_FILE, BACKUP_FILE)
    print(f"✔ Backup created: {BACKUP_FILE}")

    clean_items = []
    incomplete_items = []

    # 3. existing needs_work.json data (so we don't overwrite previous work)
    existing_bad_data = load_json(NEEDS_WORK_FILE)
    incomplete_items.extend(existing_bad_data)

    # 4. Scan and Split
    for item in all_data:
        issues = []
        
        for key in REQUIRED_KEYS:
            val = item.get(key)
            # Fail if: Key missing, Value is empty, or Value is "Unknown"
            if val is None or val == "" or val == "Unknown":
                issues.append(key)
        
        if len(issues) > 0:
            print(f" ⚠️  Moving '{item.get('title')}' to needs work (Missing: {', '.join(issues)})")
            incomplete_items.append(item)
        else:
            clean_items.append(item)

    # 5. Save the separated lists
    save_json(MAIN_FILE, clean_items)
    save_json(NEEDS_WORK_FILE, incomplete_items)

    print(f"\n--- DONE ---")
    print(f"✅ Main File ({MAIN_FILE}): Now has {len(clean_items)} perfect items.")
    print(f"🛠  Needs Work ({NEEDS_WORK_FILE}): Now has {len(incomplete_items)} items to fix.")

if __name__ == "__main__":
    separate_files()
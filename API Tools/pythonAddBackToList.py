import json
import os
import shutil

# --- CONFIGURATION ---
MAIN_FILE = 'Assets\Movies\movieList.json'
NEEDS_WORK_FILE = 'needs_work.json'
BACKUP_FILE = 'movieList_backup_before_restore.json'

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

def restore_files():
    print(f"--- CHECKING FOR FIXED ITEMS ---\n")
    
    # 1. Load Files
    main_list = load_json(MAIN_FILE)
    needs_work_list = load_json(NEEDS_WORK_FILE)

    if not needs_work_list:
        print("Good news! The 'needs work' file is empty.")
        return

    # 2. Backup Main File
    shutil.copy2(MAIN_FILE, BACKUP_FILE)

    # 3. Create a Fingerprint Set of Main List (to prevent duplicates)
    #    We use (title|year|category) as the unique ID
    existing_fingerprints = {
        f"{item.get('title', '').lower().strip()}|{item.get('year')}|{item.get('category')}" 
        for item in main_list
    }

    restored_items = []
    still_broken_items = []

    # 4. Scan the "Needs Work" list
    for item in needs_work_list:
        issues = []
        
        # Check validity again
        for key in REQUIRED_KEYS:
            val = item.get(key)
            if val is None or val == "" or val == "Unknown":
                issues.append(key)
        
        if len(issues) == 0:
            # IT IS FIXED!
            fingerprint = f"{item['title'].lower().strip()}|{item['year']}|{item['category']}"
            
            if fingerprint in existing_fingerprints:
                print(f" ⚠️  Skipping '{item['title']}' (Already exists in main list)")
            else:
                main_list.append(item)
                restored_items.append(item)
                existing_fingerprints.add(fingerprint)
                print(f" ✅ RESTORING: '{item['title']}'")
        else:
            # STILL BROKEN
            still_broken_items.append(item)
            # Optional: Print why it failed
            # print(f" ❌ Still broken: '{item.get('title')}' (Missing: {issues})")

    # 5. Save Changes
    if restored_items:
        save_json(MAIN_FILE, main_list)
        save_json(NEEDS_WORK_FILE, still_broken_items)
        
        print(f"\n--- SUCCESS ---")
        print(f"Moved {len(restored_items)} fixed items back to {MAIN_FILE}.")
        print(f"Remaining items in {NEEDS_WORK_FILE}: {len(still_broken_items)}")
    else:
        print("\nNo items were fixed yet. Edit 'needs_work.json' and fill in the blanks!")

if __name__ == "__main__":
    restore_files()
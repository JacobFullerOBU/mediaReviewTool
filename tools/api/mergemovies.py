import json
import os
import shutil # Library for copying files
import datetime

# CONFIGURATION
MASTER_FILE = 'Assets/Movies/movieList.json'   
NEW_DATA_FILE = 'Assets/Movies/media_data.json'
BACKUP_FILE = 'Assets/Movies/movieList_backup.json'

def load_json(filename):
    if not os.path.exists(filename):
        return []
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Warning: Could not read {filename}. Starting with empty list. ({e})")
        return []

def save_json(filename, data):
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

def create_backup():
    if os.path.exists(MASTER_FILE):
        try:
            shutil.copy2(MASTER_FILE, BACKUP_FILE)
            print(f"✔ Backup created: {BACKUP_FILE}")
            return True
        except Exception as e:
            print(f"❌ Error creating backup: {e}")
            return False
    else:
        print("ℹ No master file exists yet, skipping backup.")
        return True

def merge_lists():
    # 1. Load data
    print(f"Loading {MASTER_FILE}...")
    master_list = load_json(MASTER_FILE)
    
    print(f"Loading {NEW_DATA_FILE}...")
    new_items = load_json(NEW_DATA_FILE)

    if not new_items:
        print("No new items found to add.")
        return

    # 2. CREATE BACKUP BEFORE MODIFYING
    if not create_backup():
        response = input("Backup failed. Do you want to continue anyway? (y/n): ")
        if response.lower() != 'y':
            print("Aborting.")
            return

    # 3. Create "Fingerprint" for existing movies (Title + Year)
    existing_fingerprints = set()
    for item in master_list:
        fingerprint = f"{item['title'].lower().strip()}|{item['year']}"
        existing_fingerprints.add(fingerprint)

    # 4. Filter and Merge
    added_count = 0
    skipped_count = 0

    for item in new_items:
        fingerprint = f"{item['title'].lower().strip()}|{item['year']}"
        
        if fingerprint in existing_fingerprints:
            skipped_count += 1
        else:
            master_list.append(item)
            existing_fingerprints.add(fingerprint)
            added_count += 1

    # 5. Save the result
    if added_count > 0:
        save_json(MASTER_FILE, master_list)
        print(f"\nSUCCESS! Added {added_count} new movies.")
        print(f"Skipped {skipped_count} duplicates.")
        print(f"Total movies in {MASTER_FILE}: {len(master_list)}")
    else:
        print("\nNo new movies were added (all were duplicates).")

if __name__ == "__main__":
    merge_lists()
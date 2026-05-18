import json
import os
import difflib

# --- CONFIGURATION ---
# The 'r' before the quote ensures backslashes don't cause errors
JSON_FILE = 'Assets\Movies\movieList.json' 
TEXT_FILE = 'People’s Favorite Movies_.txt'

# Thresholds
HIGH_CONFIDENCE = 0.8  # 80% match (Likely the same movie)
LOW_CONFIDENCE = 0.6   # 60% match (Needs human review)

def load_existing_movies(filepath):
    """Loads JSON and returns a list of titles."""
    if not os.path.exists(filepath): 
        print(f"Error: Could not find database at: {filepath}")
        return []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e: 
        print(f"Error reading JSON: {e}")
        return []

    titles = []
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict):
                # Change 'title' here if your key is different (e.g. 'name')
                t = item.get('title', '').strip()
            else:
                t = str(item).strip()
            if t: titles.append(t)
    return titles

def load_movies_from_text(filepath):
    if not os.path.exists(filepath): 
        print(f"Error: Could not find text file at: {filepath}")
        return []
    with open(filepath, 'r', encoding='utf-8') as f:
        return [line.strip() for line in f.readlines() if line.strip()]

def get_best_match(movie, database):
    """Finds the single best match and its score."""
    matches = difflib.get_close_matches(movie, database, n=1, cutoff=0.0)
    if matches:
        best_match = matches[0]
        score = difflib.SequenceMatcher(None, movie.lower(), best_match.lower()).ratio()
        return best_match, score
    return None, 0

def check_movies():
    print(f"Reading from: {TEXT_FILE}")
    print(f"Checking against: {JSON_FILE}\n")

    database_list = load_existing_movies(JSON_FILE)
    if not database_list:
        print("Database is empty or could not be loaded. Stopping.")
        return

    database_lower_set = set(t.lower() for t in database_list)
    new_movies = load_movies_from_text(TEXT_FILE)

    if not new_movies:
        print("No movies found in text file.")
        return

    # --- Buckets for grouping ---
    exact_matches = []
    high_sim_matches = [] # > 80%
    low_sim_matches = []  # 60% - 80%
    missing_movies = []   # < 60%

    for movie in new_movies:
        # 1. Exact Match Check
        if movie.lower() in database_lower_set:
            exact_matches.append(movie)
            continue

        # 2. Similarity Check
        match_title, score = get_best_match(movie, database_list)
        
        if score >= HIGH_CONFIDENCE:
            high_sim_matches.append((score, movie, match_title))
        elif score >= LOW_CONFIDENCE:
            low_sim_matches.append((score, movie, match_title))
        else:
            missing_movies.append(movie)

    # --- SORTING (Highest % first) ---
    high_sim_matches.sort(key=lambda x: x[0], reverse=True)
    low_sim_matches.sort(key=lambda x: x[0], reverse=True)

    # --- PRINTING OUTPUT ---

    # Group 1: Exact Matches
    if exact_matches:
        print(f"✅ EXACT MATCHES ({len(exact_matches)})")
        print("-" * 40)
        for m in exact_matches:
            print(f"  • {m}")
        print("\n")

    # Group 2: High Confidence Matches
    if high_sim_matches:
        print(f"⚠️  HIGH SIMILARITY (Check these) ({len(high_sim_matches)})")
        print("-" * 60)
        print(f"  {'SCORE':<8} {'YOUR LIST':<25} {'DATABASE'}")
        print("-" * 60)
        for score, original, match in high_sim_matches:
            print(f"  {score:.0%}     {original:<25} -> {match}")
        print("\n")

    # Group 3: Low Confidence / Potential Matches
    if low_sim_matches:
        print(f"❓ LOW SIMILARITY (Unlikely but possible) ({len(low_sim_matches)})")
        print("-" * 60)
        for score, original, match in low_sim_matches:
            print(f"  {score:.0%}     {original:<25} -> {match}")
        print("\n")

    # Group 4: Missing
    if missing_movies:
        print(f"❌ MISSING / NEW MOVIES ({len(missing_movies)})")
        print("-" * 40)
        for m in missing_movies:
            print(f"  • {m}")
        
        # Print JSON array for easy copying
        print("\n[Copy/Paste JSON for Missing Movies]:")
        print(json.dumps(missing_movies, indent=2))

if __name__ == "__main__":
    check_movies()